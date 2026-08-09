import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getUsdPkrRate, usdToPkr } from "@/lib/currency";
import { polishUserPrompt } from "@/lib/deepseek";
import { refineImage } from "@/lib/fal";
import {
  getHouseModelById,
  houseModelToPersona,
  DEFAULT_HOUSE_MODEL,
} from "@/lib/model-persona";
import {
  buildPrompt,
  feedbackRequestsBackground,
  feedbackRequestsPose,
  resolvePromptMode,
  type PromptMode,
} from "@/lib/prompt-builder";
import { getAppSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      baseImageUrl: string;
      sketchUrls?: string[];
      oldDesignUrl?: string;
      parentVersionId?: string;
      description?: string;
      shirtColour?: string;
      trouserColour?: string;
      fabric?: string;
      feedback?: string;
      previousTotalCost?: number;
      houseModelId?: string;
      promptMode?: PromptMode;
      /** Pose buttons: change stance only — lock dress + face. */
      poseOnly?: boolean;
    };

    if (!body.baseImageUrl) {
      return NextResponse.json({ error: "baseImageUrl is required." }, { status: 400 });
    }

    const mode: PromptMode =
      body.promptMode ??
      resolvePromptMode({
        sketchUrls: body.sketchUrls,
        oldDesignUrl: body.oldDesignUrl,
      });

    const houseModel =
      (body.houseModelId && getHouseModelById(body.houseModelId)) ||
      DEFAULT_HOUSE_MODEL;
    const persona = houseModelToPersona(houseModel);

    const poseOnly =
      Boolean(body.poseOnly) ||
      (feedbackRequestsPose(body.feedback) &&
        !feedbackRequestsBackground(body.feedback) &&
        !body.shirtColour?.trim() &&
        !body.trouserColour?.trim() &&
        !body.fabric?.trim());

    // Pose-only: skip DeepSeek so it cannot "improve" colours into a redesign.
    const polished = poseOnly
      ? {
          description: body.description?.trim() || undefined,
          shirtColour: body.shirtColour?.trim() || undefined,
          trouserColour: body.trouserColour?.trim() || undefined,
          fabric: body.fabric?.trim() || undefined,
          feedback: body.feedback?.trim() || undefined,
          polished: false,
        }
      : await polishUserPrompt({
          description: body.description,
          shirtColour: body.shirtColour,
          trouserColour: body.trouserColour,
          fabric: body.fabric,
          feedback: body.feedback,
          mode: "refine",
          inputMode: mode,
        });

    const settings = await getAppSettings();
    const built = buildPrompt({
      description: polished.description,
      shirtColour: polished.shirtColour,
      trouserColour: polished.trouserColour,
      fabric: polished.fabric,
      feedback: polished.feedback,
      persona,
      mode,
      isRefine: true,
      poseOnly,
      keepPose: !poseOnly && !feedbackRequestsPose(polished.feedback),
    });

    // Always edit from the previous result. Sketch refs only when not pose-only
    // (extra refs can fight identity lock on pose restage).
    const referenceUrls =
      !poseOnly && mode === "sketch"
        ? (body.sketchUrls ?? []).slice(0, 2)
        : [];

    const wantsBg = feedbackRequestsBackground(polished.feedback ?? body.feedback);

    // Pose-only needs moderate strength: enough to restage, low enough to keep colours/face.
    let strength = mode === "sketch" ? 0.5 : 0.58;
    if (poseOnly) strength = 0.42;
    else if (wantsBg) strength = mode === "sketch" ? 0.72 : 0.78;

    const result = await refineImage(
      {
        baseImageUrl: body.baseImageUrl,
        referenceUrls,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: built.seed,
        modelKey: settings.fal.refineModel,
        strength,
      },
      settings.fal,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error, modelId: result.modelId }, { status: 502 });
    }

    const version = {
      id: randomUUID(),
      parentVersionId: body.parentVersionId ?? null,
      imageUrl: result.imageUrl,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      seed: result.seed ?? null,
      modelId: result.modelId,
      feedback: polished.feedback ?? body.feedback ?? null,
      costUsd: result.costUsd,
      requestId: result.requestId,
    };

    const totalCost = (body.previousTotalCost ?? 0) + result.costUsd;
    const rate = getUsdPkrRate();
    const costPkr = usdToPkr(result.costUsd, rate);

    return NextResponse.json({
      version,
      costUsd: result.costUsd,
      costPkr,
      totalCost,
      totalCostPkr: usdToPkr(totalCost, rate),
      usdPkrRate: rate,
      modelId: result.modelId,
      promptMode: mode,
      poseOnly,
      houseModel: {
        id: houseModel.id,
        name: houseModel.name,
        cue: houseModel.cue,
        seed: houseModel.seed,
      },
      promptPolish: {
        polished: polished.polished,
        feedback: polished.feedback,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refine failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
