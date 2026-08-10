import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getUsdPkrRate, usdToPkr } from "@/lib/currency";
import { polishUserPrompt } from "@/lib/deepseek";
import { generateFromSketch, generateFromText } from "@/lib/fal";
import { persistRemoteImage } from "@/lib/media-store";
import {
  houseModelToPersona,
  resolveHouseModel,
  type HouseModelSelection,
} from "@/lib/model-persona";
import { getPersonaAnchorUrl } from "@/lib/persona-anchors";
import {
  buildPrompt,
  resolvePromptMode,
  type PromptMode,
} from "@/lib/prompt-builder";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";
import { getAppSettings } from "@/lib/settings-store";
import { assertWithinSpendCap } from "@/lib/spend-gate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sketchUrls?: string[];
      oldDesignUrl?: string;
      oldDesignUrls?: string[];
      fabricUrl?: string;
      description?: string;
      shirtColour?: string;
      trouserColour?: string;
      fabric?: string;
      houseModelId?: HouseModelSelection;
      sourceMode?: PromptMode;
      numCandidates?: number;
    };

    const sketchOnly = (body.sketchUrls ?? []).filter(Boolean);
    const oldDesigns = [
      ...(body.oldDesignUrls ?? []),
      ...(body.oldDesignUrl ? [body.oldDesignUrl] : []),
    ].filter(Boolean);
    // de-dupe while preserving order
    const oldOnly = [...new Set(oldDesigns)];

    const hasDescription = Boolean(body.description?.trim());

    const mode = resolvePromptMode({
      sketchUrls: sketchOnly,
      oldDesignUrl: oldOnly[0],
      oldDesignUrls: oldOnly,
      sourceMode: body.sourceMode,
      hasDescription,
    });

    if (mode === "description" && !hasDescription) {
      return NextResponse.json(
        {
          error:
            "Description mode needs a written description. Colours and fabric are optional.",
        },
        { status: 400 },
      );
    }

    if (mode === "sketch" && !sketchOnly.length) {
      return NextResponse.json(
        { error: "Upload at least one sketch." },
        { status: 400 },
      );
    }

    if (mode === "old-design" && !oldOnly.length) {
      return NextResponse.json(
        { error: "Upload at least one old design photo." },
        { status: 400 },
      );
    }

    const imageUrls = [
      ...(mode === "old-design"
        ? oldOnly
        : mode === "sketch"
          ? sketchOnly
          : []),
      ...(body.fabricUrl?.trim() ? [body.fabricUrl.trim()] : []),
    ];

    const numCandidates = Math.min(
      Math.max(Number(body.numCandidates) || 1, 1),
      3,
    );

    let settings = DEFAULT_APP_SETTINGS;
    try {
      settings = await getAppSettings();
    } catch (err) {
      console.warn("[api/generate] settings failed, using defaults:", err);
    }

    const gate = await assertWithinSpendCap({
      modelKey: settings.fal.generateModel,
      textToImage: mode === "description",
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.error,
          code: "SPEND_CAP",
          spend: gate.snapshot,
        },
        { status: 402 },
      );
    }

    const houseModel = resolveHouseModel(
      body.houseModelId ?? settings.preferredHouseModelId,
    );
    const persona = houseModelToPersona(houseModel);

    const origin = new URL(request.url).origin;
    const faceAnchor = getPersonaAnchorUrl(houseModel, origin);
    if (faceAnchor && mode !== "description") {
      imageUrls.push(faceAnchor);
    }

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
      feedback: body.fabricUrl
        ? "Use the attached fabric swatch photo as the true colour and texture reference for the garment cloth."
        : undefined,
    });

    const result =
      mode === "description"
        ? await generateFromText({
            prompt: built.prompt,
            negativePrompt: built.negativePrompt,
            seed: built.seed,
            numImages: numCandidates,
          })
        : await generateFromSketch(
            {
              sketchUrls: imageUrls,
              prompt: built.prompt,
              negativePrompt: built.negativePrompt,
              seed: built.seed,
              modelKey: settings.fal.generateModel,
              strength:
                mode === "old-design"
                  ? settings.strengths.oldDesignGenerate
                  : undefined,
              numImages: numCandidates,
            },
            settings.fal,
          );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, modelId: result.modelId },
        { status: 502 },
      );
    }

    const persisted = await persistRemoteImage(result.imageUrl);

    const version = {
      id: randomUUID(),
      parentVersionId: null as string | null,
      imageUrl: persisted.url,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      seed: result.seed ?? null,
      modelId: result.modelId,
      feedback: null as string | null,
      costUsd: result.costUsd,
      requestId: result.requestId,
      aiGenerated: true as const,
      altText: null as string | null,
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
      pose: built.poseId
        ? { id: built.poseId, label: built.poseLabel }
        : undefined,
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
