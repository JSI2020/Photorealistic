import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getUsdPkrRate, usdToPkr } from "@/lib/currency";
import { refineImage } from "@/lib/fal";
import { persistRemoteImage } from "@/lib/media-store";
import {
  DEFAULT_HOUSE_MODEL,
  getHouseModelById,
  houseModelToPersona,
} from "@/lib/model-persona";
import { buildPrompt } from "@/lib/prompt-builder";
import { getAppSettings } from "@/lib/settings-store";
import { assertWithinSpendCap } from "@/lib/spend-gate";

export const runtime = "nodejs";

const ANGLE_PROMPTS = [
  {
    id: "three-quarter",
    label: "3/4 lookbook",
    feedback:
      "Pose only: restage to a three-quarter lookbook turn with weight shift, face toward camera. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "back",
    label: "Back / over shoulder",
    feedback:
      "Pose only: restage body angled away showing the back and dupatta fall, looking back over one shoulder. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "side",
    label: "Side silhouette",
    feedback:
      "Pose only: restage to a clear side silhouette so sleeve length and drape read cleanly. Keep the exact same dress colours/design and the exact same model face.",
  },
] as const;

/**
 * Lock hero → derive consistent angle set (C1).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      heroImageUrl: string;
      parentVersionId?: string;
      houseModelId?: string;
      description?: string;
      shirtColour?: string;
      trouserColour?: string;
      fabric?: string;
      previousTotalCost?: number;
      angles?: string[];
    };

    if (!body.heroImageUrl) {
      return NextResponse.json(
        { error: "heroImageUrl is required." },
        { status: 400 },
      );
    }

    const settings = await getAppSettings();
    const wanted = body.angles?.length
      ? ANGLE_PROMPTS.filter((a) => body.angles!.includes(a.id))
      : ANGLE_PROMPTS;

    const houseModel =
      (body.houseModelId && getHouseModelById(body.houseModelId)) ||
      DEFAULT_HOUSE_MODEL;
    const persona = houseModelToPersona(houseModel);

    const versions = [];
    let totalCost = body.previousTotalCost ?? 0;

    for (const angle of wanted) {
      const gate = await assertWithinSpendCap({
        modelKey: settings.fal.refineModel,
      });
      if (!gate.ok) {
        return NextResponse.json(
          {
            error: gate.error,
            code: "SPEND_CAP",
            versions,
            totalCost,
            spend: gate.snapshot,
          },
          { status: 402 },
        );
      }

      const built = buildPrompt({
        description: body.description,
        shirtColour: body.shirtColour,
        trouserColour: body.trouserColour,
        fabric: body.fabric,
        feedback: angle.feedback,
        persona,
        mode: "sketch",
        isRefine: true,
        poseOnly: true,
      });

      const result = await refineImage(
        {
          baseImageUrl: body.heroImageUrl,
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          seed: built.seed,
          modelKey: settings.fal.refineModel,
          strength: settings.strengths.poseOnly,
        },
        settings.fal,
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: `${angle.label}: ${result.error}`, versions, totalCost },
          { status: 502 },
        );
      }

      const persisted = await persistRemoteImage(result.imageUrl);
      const version = {
        id: randomUUID(),
        parentVersionId: body.parentVersionId ?? null,
        imageUrl: persisted.url,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: result.seed ?? null,
        modelId: result.modelId,
        feedback: angle.label,
        costUsd: result.costUsd,
        requestId: result.requestId,
        angleId: angle.id,
        aiGenerated: true,
      };
      versions.push(version);
      totalCost += result.costUsd;
    }

    const rate = getUsdPkrRate();
    return NextResponse.json({
      versions,
      totalCost,
      totalCostPkr: usdToPkr(totalCost, rate),
      usdPkrRate: rate,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Angle set generation failed.";
    console.error("[api/catalog/angles]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
