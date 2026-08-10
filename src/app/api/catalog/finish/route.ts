import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getUsdPkrRate, usdToPkr } from "@/lib/currency";
import { upscaleImage, refineImage } from "@/lib/fal";
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
 * A7 upscale + A8 hand/detail repair.
 * action: "upscale" | "fix-hands"
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: "upscale" | "fix-hands";
      baseImageUrl: string;
      parentVersionId?: string;
      houseModelId?: string;
      description?: string;
      previousTotalCost?: number;
    };

    if (!body.baseImageUrl || !body.action) {
      return NextResponse.json(
        { error: "action and baseImageUrl required" },
        { status: 400 },
      );
    }

    const settings = await getAppSettings();
    const gate = await assertWithinSpendCap({
      modelKey: settings.fal.refineModel,
    });
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error, code: "SPEND_CAP", spend: gate.snapshot },
        { status: 402 },
      );
    }

    if (body.action === "upscale") {
      const result = await upscaleImage(body.baseImageUrl);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      const persisted = await persistRemoteImage(result.imageUrl);
      const version = {
        id: randomUUID(),
        parentVersionId: body.parentVersionId ?? null,
        imageUrl: persisted.url,
        prompt: "Upscale approved catalog image",
        negativePrompt: null,
        seed: null,
        modelId: result.modelId,
        feedback: "Upscaled (final)",
        costUsd: result.costUsd,
        requestId: result.requestId,
        aiGenerated: true,
      };
      const totalCost = (body.previousTotalCost ?? 0) + result.costUsd;
      const rate = getUsdPkrRate();
      return NextResponse.json({
        version,
        totalCost,
        costUsd: result.costUsd,
        costPkr: usdToPkr(result.costUsd, rate),
        totalCostPkr: usdToPkr(totalCost, rate),
        usdPkrRate: rate,
      });
    }

    // fix-hands
    const houseModel =
      (body.houseModelId && getHouseModelById(body.houseModelId)) ||
      DEFAULT_HOUSE_MODEL;
    const persona = houseModelToPersona(houseModel);
    const feedback =
      "Fix only the hands and fine garment edge details: natural fingers, correct count, no melted digits, clean cuffs and embroidery edges. Keep the exact same face, pose, colours, and background.";

    const built = buildPrompt({
      description: body.description,
      feedback,
      persona,
      mode: "sketch",
      isRefine: true,
    });

    const result = await refineImage(
      {
        baseImageUrl: body.baseImageUrl,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: built.seed,
        modelKey: settings.fal.refineModel,
        strength: Math.min(settings.strengths.refineDefault, 0.45),
      },
      settings.fal,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
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
      feedback: "Fix hands / detail",
      costUsd: result.costUsd,
      requestId: result.requestId,
      aiGenerated: true,
    };
    const totalCost = (body.previousTotalCost ?? 0) + result.costUsd;
    const rate = getUsdPkrRate();
    return NextResponse.json({
      version,
      totalCost,
      costUsd: result.costUsd,
      costPkr: usdToPkr(result.costUsd, rate),
      totalCostPkr: usdToPkr(totalCost, rate),
      usdPkrRate: rate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Repair failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
