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
import { buildPrompt } from "@/lib/prompt-builder";
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

    const sketchUrls = [
      ...(body.sketchUrls ?? []),
      ...(body.oldDesignUrl ? [body.oldDesignUrl] : []),
    ];

    if (!sketchUrls.length) {
      return NextResponse.json(
        { error: "Upload at least one sketch or an old-design image." },
        { status: 400 },
      );
    }

    const settings = await getAppSettings();
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
    });

    const built = buildPrompt({
      description: polished.description,
      shirtColour: polished.shirtColour,
      trouserColour: polished.trouserColour,
      fabric: polished.fabric,
      persona,
    });

    const result = await generateFromSketch(
      {
        sketchUrls,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: built.seed,
        modelKey: settings.fal.generateModel,
      },
      settings.fal,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error, modelId: result.modelId }, { status: 502 });
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
    return NextResponse.json({
      version,
      costUsd: result.costUsd,
      costPkr: usdToPkr(result.costUsd, rate),
      totalCost: result.costUsd,
      totalCostPkr: usdToPkr(result.costUsd, rate),
      usdPkrRate: rate,
      modelId: result.modelId,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
