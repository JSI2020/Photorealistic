import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getUsdPkrRate, usdToPkr } from "@/lib/currency";
import { polishUserPrompt } from "@/lib/deepseek";
import { generateFromSketch } from "@/lib/fal";
import {
  houseModelToPersona,
  resolveHouseModel,
  type HouseModelSelection,
} from "@/lib/model-persona";
import { buildPrompt, resolvePromptMode } from "@/lib/prompt-builder";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import { getAppSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sketchUrls?: string[];
      oldDesignUrl?: string;
      description?: string;
      shirtColour?: string;
      trouserColour?: string;
      fabric?: string;
      houseModelId?: HouseModelSelection;
    };

    const sketchOnly = (body.sketchUrls ?? []).filter(Boolean);
    const mode = resolvePromptMode({
      sketchUrls: sketchOnly,
      oldDesignUrl: body.oldDesignUrl,
    });

    // Old-design restyle: use the photo alone. Sketch mode: sketches (+ optional old photo as extra ref).
    const imageUrls =
      mode === "old-design"
        ? [body.oldDesignUrl!].filter(Boolean)
        : [
            ...sketchOnly,
            ...(body.oldDesignUrl ? [body.oldDesignUrl] : []),
          ];

    if (!imageUrls.length) {
      return NextResponse.json(
        { error: "Upload at least one sketch or an old-design image." },
        { status: 400 },
      );
    }

    let settings = DEFAULT_APP_SETTINGS;
    try {
      settings = await getAppSettings();
    } catch (err) {
      console.warn("[api/generate] settings failed, using defaults:", err);
    }
    const houseModel = resolveHouseModel(
      body.houseModelId ?? settings.preferredHouseModelId,
    );
    const persona = houseModelToPersona(houseModel);

    const polished = await polishUserPrompt({
      description: body.description,
      shirtColour: body.shirtColour,
      trouserColour: body.trouserColour,
      fabric: body.fabric,
      mode: "generate",
      inputMode: mode,
    });

    const built = buildPrompt({
      description: polished.description,
      shirtColour: polished.shirtColour,
      trouserColour: polished.trouserColour,
      fabric: polished.fabric,
      persona,
      mode,
    });

    // Old-design needs more deviation so we don't get a near-photocopy on pass 1.
    const strength = mode === "old-design" ? 0.82 : undefined;

    const result = await generateFromSketch(
      {
        sketchUrls: imageUrls,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: built.seed,
        modelKey: settings.fal.generateModel,
        strength,
      },
      settings.fal,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, modelId: result.modelId },
        { status: 502 },
      );
    }

    const version = {
      id: randomUUID(),
      parentVersionId: null as string | null,
      imageUrl: result.imageUrl,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      seed: result.seed ?? null,
      modelId: result.modelId,
      feedback: null as string | null,
      costUsd: result.costUsd,
      requestId: result.requestId,
    };

    const rate = getUsdPkrRate();
    const costPkr = usdToPkr(result.costUsd, rate);
    return NextResponse.json({
      version,
      costUsd: result.costUsd,
      costPkr,
      totalCost: result.costUsd,
      totalCostPkr: costPkr,
      usdPkrRate: rate,
      modelId: result.modelId,
      promptMode: mode,
      houseModel: {
        id: houseModel.id,
        name: houseModel.name,
        cue: houseModel.cue,
        seed: houseModel.seed,
      },
      promptPolish: {
        polished: polished.polished,
        model: polished.model,
        description: polished.description,
        shirtColour: polished.shirtColour,
        trouserColour: polished.trouserColour,
        fabric: polished.fabric,
        warning: polished.error,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    console.error("[api/generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
