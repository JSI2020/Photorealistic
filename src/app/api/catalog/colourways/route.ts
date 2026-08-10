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

/**
 * Colourway batch from one approved hero (C2).
 * Body.colours: string[] e.g. ["deep maroon", "ivory", "sage green"]
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      heroImageUrl: string;
      parentVersionId?: string;
      houseModelId?: string;
      description?: string;
      fabric?: string;
      colours: string[];
      previousTotalCost?: number;
    };

    if (!body.heroImageUrl) {
      return NextResponse.json(
        { error: "heroImageUrl is required." },
        { status: 400 },
      );
    }
    const colours = (body.colours ?? [])
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!colours.length) {
      return NextResponse.json(
        { error: "Provide at least one colourway." },
        { status: 400 },
      );
    }

    const settings = await getAppSettings();
    const houseModel =
      (body.houseModelId && getHouseModelById(body.houseModelId)) ||
      DEFAULT_HOUSE_MODEL;
    const persona = houseModelToPersona(houseModel);

    const versions = [];
    let totalCost = body.previousTotalCost ?? 0;

    for (const colour of colours) {
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

      const feedback = `Recolour the outfit to ${colour}. Keep the exact same silhouette, embroidery placement, model face, pose, and background — only change garment colours to ${colour}.`;

      const built = buildPrompt({
        description: body.description,
        shirtColour: colour,
        fabric: body.fabric,
        feedback,
        persona,
        mode: "old-design",
        isRefine: true,
      });

      const result = await refineImage(
        {
          baseImageUrl: body.heroImageUrl,
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          seed: built.seed,
          modelKey: settings.fal.refineModel,
          strength: settings.strengths.refineDefault,
        },
        settings.fal,
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: `${colour}: ${result.error}`, versions, totalCost },
          { status: 502 },
        );
      }

      const persisted = await persistRemoteImage(result.imageUrl);
      versions.push({
        id: randomUUID(),
        parentVersionId: body.parentVersionId ?? null,
        imageUrl: persisted.url,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: result.seed ?? null,
        modelId: result.modelId,
        feedback: `Colourway: ${colour}`,
        costUsd: result.costUsd,
        requestId: result.requestId,
        colourway: colour,
        aiGenerated: true,
      });
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
      err instanceof Error ? err.message : "Colourway batch failed.";
    console.error("[api/catalog/colourways]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
