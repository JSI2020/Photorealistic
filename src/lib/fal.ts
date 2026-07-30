import { fal } from "@fal-ai/client";

import { getFalKey } from "@/lib/env";
import {
  DEFAULT_FAL_RUNTIME,
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
};

export type RefineImageInput = {
  baseImageUrl: string;
  /** Optional extra refs (e.g. original sketch) to keep structure stable. */
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

  // Models without a negative_prompt field still benefit from explicit avoidances.
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
    return { ok: false, error: "At least one reference image URL is required.", modelId: model.id };
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
    } else {
      input.image_url = params.imageUrls[0];
      if (params.strength !== undefined) input.strength = params.strength;
      // Keep enough of the reference for identity; lower = closer to source.
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

/** Image-to-image / edit: sketches as structural references. */
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
  });
}

/**
 * Refine using the previous result as the primary reference so identity stays stable.
 * Optional sketch refs can be appended to reinforce garment structure.
 */
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

/** Upload a local File/Blob/Buffer to fal storage; returns a public URL. */
export async function uploadToFal(file: Blob): Promise<string> {
  configureFal();
  return fal.storage.upload(file);
}
