import { fal } from "@fal-ai/client";

import { getFalKey } from "@/lib/env";
import {
  DEFAULT_FAL_RUNTIME,
  FAL_TEXT_TO_IMAGE,
  getFalModel,
  type FalModelConfig,
  type FalModelKey,
  type FalRuntimeConfig,
} from "@/lib/fal-config";

export type FalSuccess = {
  ok: true;
  imageUrl: string;
  seed: number | undefined;
  costUsd: number;
  modelId: string;
  requestId: string;
};

export type FalFailure = {
  ok: false;
  error: string;
  modelId?: string;
};

export type FalResult = FalSuccess | FalFailure;

export type GenerateFromSketchInput = {
  sketchUrls: string[];
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  modelKey?: FalModelKey;
  aspectRatio?: string;
  strength?: number;
};

export type GenerateFromTextInput = {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
};

export type RefineImageInput = {
  baseImageUrl: string;
  referenceUrls?: string[];
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  modelKey?: FalModelKey;
  strength?: number;
  aspectRatio?: string;
};

type FalImagePayload = {
  images?: Array<{ url?: string }>;
  image?: { url?: string };
  seed?: number;
};

function configureFal(): void {
  fal.config({ credentials: getFalKey() });
}

function withNegativePrompt(
  prompt: string,
  negativePrompt: string | undefined,
  model: FalModelConfig,
): { prompt: string; negative_prompt?: string } {
  const neg = negativePrompt?.trim();
  if (!neg) return { prompt };

  if (model.supportsNegativePrompt) {
    return { prompt, negative_prompt: neg };
  }

  return {
    prompt: `${prompt} Avoid: ${neg}.`,
  };
}

function extractImageUrl(data: FalImagePayload): string | undefined {
  return data.images?.[0]?.url ?? data.image?.url;
}

async function runModel(params: {
  modelKey: FalModelKey;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  imageUrls: string[];
  strength?: number;
  aspectRatio?: string;
}): Promise<FalResult> {
  const model = getFalModel(params.modelKey);

  if (!params.imageUrls.length) {
    return {
      ok: false,
      error: "At least one reference image URL is required.",
      modelId: model.id,
    };
  }

  configureFal();

  const promptFields = withNegativePrompt(
    params.prompt,
    params.negativePrompt,
    model,
  );

  try {
    const input: Record<string, unknown> = {
      ...promptFields,
      num_images: 1,
      output_format: "png",
    };

    if (params.seed !== undefined && model.supportsSeed) {
      input.seed = params.seed;
    }

    if (model.imageInput === "image_urls") {
      input.image_urls = params.imageUrls;
      if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
      if (params.strength !== undefined) input.strength = params.strength;
    } else {
      input.image_url = params.imageUrls[0];
      if (params.strength !== undefined) input.strength = params.strength;
      if (input.strength === undefined) input.strength = 0.65;
    }

    const result = await fal.subscribe(model.id, {
      input,
      logs: false,
    });

    const data = result.data as FalImagePayload;
    const imageUrl = extractImageUrl(data);

    if (!imageUrl) {
      return {
        ok: false,
        error: "Generation finished but no image URL was returned.",
        modelId: model.id,
      };
    }

    return {
      ok: true,
      imageUrl,
      seed: typeof data.seed === "number" ? data.seed : params.seed,
      costUsd: model.estimatedCostUsd,
      modelId: model.id,
      requestId: result.requestId,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown fal generation error.";

    return {
      ok: false,
      error: message,
      modelId: model.id,
    };
  }
}

export async function generateFromSketch(
  input: GenerateFromSketchInput,
  runtime: FalRuntimeConfig = DEFAULT_FAL_RUNTIME,
): Promise<FalResult> {
  return runModel({
    modelKey: input.modelKey ?? runtime.generateModel,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    seed: input.seed,
    imageUrls: input.sketchUrls,
    aspectRatio: input.aspectRatio ?? "2:3",
    strength: input.strength,
  });
}

/** Text-only generation (no sketch / old design). */
export async function generateFromText(
  input: GenerateFromTextInput,
): Promise<FalResult> {
  configureFal();
  const modelId = FAL_TEXT_TO_IMAGE.id;
  const neg = input.negativePrompt?.trim();
  const prompt = neg ? `${input.prompt} Avoid: ${neg}.` : input.prompt;

  try {
    const falInput = {
      prompt,
      num_images: 1 as const,
      output_format: "png" as const,
      image_size: "portrait_4_3" as const,
      enable_safety_checker: true,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    };

    const result = await fal.subscribe(modelId, {
      input: falInput,
      logs: false,
    });

    const data = result.data as FalImagePayload;
    const imageUrl = extractImageUrl(data);
    if (!imageUrl) {
      return {
        ok: false,
        error: "Generation finished but no image URL was returned.",
        modelId,
      };
    }

    return {
      ok: true,
      imageUrl,
      seed: typeof data.seed === "number" ? data.seed : input.seed,
      costUsd: FAL_TEXT_TO_IMAGE.estimatedCostUsd,
      modelId,
      requestId: result.requestId,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown fal generation error.";
    return { ok: false, error: message, modelId };
  }
}

export async function refineImage(
  input: RefineImageInput,
  runtime: FalRuntimeConfig = DEFAULT_FAL_RUNTIME,
): Promise<FalResult> {
  const refs = [input.baseImageUrl, ...(input.referenceUrls ?? [])];
  return runModel({
    modelKey: input.modelKey ?? runtime.refineModel,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    seed: input.seed,
    imageUrls: refs,
    strength: input.strength ?? 0.55,
    aspectRatio: input.aspectRatio ?? "auto",
  });
}

export async function uploadToFal(file: Blob): Promise<string> {
  configureFal();
  try {
    return await fal.storage.upload(file);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "fal storage upload failed.";
    throw new Error(`fal upload failed: ${message}`);
  }
}
