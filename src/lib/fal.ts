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
import { ensureFalFetchableUrl } from "@/lib/media-store";

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
  numImages?: number;
};

export type GenerateFromTextInput = {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  numImages?: number;
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

function extractAllImageUrls(data: FalImagePayload): string[] {
  if (data.images?.length) {
    return data.images.map((i) => i.url).filter((u): u is string => Boolean(u));
  }
  const one = data.image?.url;
  return one ? [one] : [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientError(message: string): boolean {
  return /timeout|429|502|503|504|ECONNRESET|ETIMEDOUT|fetch failed|rate.?limit/i.test(
    message,
  );
}

function formatFalError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & {
      status?: number;
      body?: unknown;
      message?: string;
    };
    const body = anyErr.body;
    if (body && typeof body === "object") {
      try {
        return `${anyErr.message}: ${JSON.stringify(body).slice(0, 400)}`;
      } catch {
        /* fall through */
      }
    }
    return anyErr.message;
  }
  if (typeof err === "string") return err;
  return "Unknown fal error";
}

/**
 * Submit to fal queue and poll until complete. Retries transient failures.
 */
async function runQueuedModel(params: {
  modelId: string;
  input: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<{ data: FalImagePayload; requestId: string }> {
  configureFal();
  const maxAttempts = params.maxAttempts ?? 3;
  let lastError = "fal queue failed";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const submitted = await fal.queue.submit(params.modelId, {
        input: params.input,
      });
      const requestId = submitted.request_id;

      const started = Date.now();
      const maxWaitMs = 4 * 60_000;
      let delay = 800;

      while (Date.now() - started < maxWaitMs) {
        const status = await fal.queue.status(params.modelId, {
          requestId,
          logs: false,
        });

        const st = status.status as string;
        if (st === "COMPLETED") {
          const result = await fal.queue.result(params.modelId, { requestId });
          return {
            data: result.data as FalImagePayload,
            requestId,
          };
        }

        if (st === "FAILED") {
          throw new Error("fal job failed");
        }

        await sleep(delay);
        delay = Math.min(delay * 1.35, 4000);
      }

      throw new Error("fal job timed out after 4 minutes");
    } catch (err) {
      lastError = formatFalError(err);
      if (attempt < maxAttempts && isTransientError(lastError)) {
        await sleep(500 * attempt * attempt);
        continue;
      }
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

async function resolveImageUrlsForFal(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    out.push(await ensureFalFetchableUrl(url, uploadToFal));
  }
  return out;
}

async function runModel(params: {
  modelKey: FalModelKey;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  imageUrls: string[];
  strength?: number;
  aspectRatio?: string;
  numImages?: number;
}): Promise<FalResult> {
  const model = getFalModel(params.modelKey);

  if (!params.imageUrls.length) {
    return {
      ok: false,
      error: "At least one reference image URL is required.",
      modelId: model.id,
    };
  }

  const promptFields = withNegativePrompt(
    params.prompt,
    params.negativePrompt,
    model,
  );

  try {
    const imageUrls = await resolveImageUrlsForFal(params.imageUrls);

    const input: Record<string, unknown> = {
      ...promptFields,
      num_images: Math.min(Math.max(params.numImages ?? 1, 1), 4),
      output_format: "png",
    };

    if (params.seed !== undefined && model.supportsSeed) {
      input.seed = params.seed;
    }

    if (model.imageInput === "image_urls") {
      input.image_urls = imageUrls;
      if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
      // Nano Banana rejects unknown `strength` with 422 Unprocessable Entity
      if (model.supportsStrength && params.strength !== undefined) {
        input.strength = params.strength;
      }
    } else {
      input.image_url = imageUrls[0];
      if (model.supportsStrength) {
        input.strength =
          params.strength !== undefined ? params.strength : 0.65;
      }
    }

    const { data, requestId } = await runQueuedModel({
      modelId: model.id,
      input,
    });

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
      costUsd:
        model.estimatedCostUsd * (Number(input.num_images) || 1),
      modelId: model.id,
      requestId,
    };
  } catch (err) {
    const message = formatFalError(err);

    return {
      ok: false,
      error: message,
      modelId: model.id,
    };
  }
}

/** Multi-candidate helper — returns all image URLs when the model supports it. */
export async function generateFromSketchMulti(
  input: GenerateFromSketchInput,
  runtime: FalRuntimeConfig = DEFAULT_FAL_RUNTIME,
): Promise<FalResult & { imageUrls?: string[] }> {
  const modelKey = input.modelKey ?? runtime.generateModel;
  const model = getFalModel(modelKey);
  const promptFields = withNegativePrompt(
    input.prompt,
    input.negativePrompt,
    model,
  );
  const num = Math.min(Math.max(input.numImages ?? 1, 1), 3);

  try {
    const imageUrls = await resolveImageUrlsForFal(input.sketchUrls);
    const falInput: Record<string, unknown> = {
      ...promptFields,
      num_images: num,
      output_format: "png",
    };
    if (input.seed !== undefined && model.supportsSeed) {
      falInput.seed = input.seed;
    }
    if (model.imageInput === "image_urls") {
      falInput.image_urls = imageUrls;
      falInput.aspect_ratio = input.aspectRatio ?? "2:3";
      if (model.supportsStrength && input.strength !== undefined) {
        falInput.strength = input.strength;
      }
    } else {
      falInput.image_url = imageUrls[0];
      if (model.supportsStrength) {
        falInput.strength = input.strength ?? 0.65;
      }
    }

    const { data, requestId } = await runQueuedModel({
      modelId: model.id,
      input: falInput,
    });
    const urls = extractAllImageUrls(data);
    if (!urls.length) {
      return {
        ok: false,
        error: "No images returned.",
        modelId: model.id,
      };
    }
    return {
      ok: true,
      imageUrl: urls[0]!,
      imageUrls: urls,
      seed: typeof data.seed === "number" ? data.seed : input.seed,
      costUsd: model.estimatedCostUsd * urls.length,
      modelId: model.id,
      requestId,
    };
  } catch (err) {
    return {
      ok: false,
      error: formatFalError(err),
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
    numImages: input.numImages,
  });
}

/** Text-only generation (no sketch / old design). */
export async function generateFromText(
  input: GenerateFromTextInput,
): Promise<FalResult> {
  const modelId = FAL_TEXT_TO_IMAGE.id;
  const neg = input.negativePrompt?.trim();
  const prompt = neg ? `${input.prompt} Avoid: ${neg}.` : input.prompt;
  const num = Math.min(Math.max(input.numImages ?? 1, 1), 3);

  try {
    const falInput = {
      prompt,
      num_images: num,
      output_format: "png" as const,
      image_size: "portrait_4_3" as const,
      enable_safety_checker: true,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    };

    const { data, requestId } = await runQueuedModel({
      modelId,
      input: falInput,
    });

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
      costUsd: FAL_TEXT_TO_IMAGE.estimatedCostUsd * num,
      modelId,
      requestId,
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

/** Optional fal upscale for approved finals. */
export async function upscaleImage(imageUrl: string): Promise<FalResult> {
  const modelId = "fal-ai/esrgan";
  try {
    const { data, requestId } = await runQueuedModel({
      modelId,
      input: { image_url: imageUrl, scale: 2 },
    });
    const out = extractImageUrl(data);
    if (!out) {
      return { ok: false, error: "Upscale returned no image.", modelId };
    }
    return {
      ok: true,
      imageUrl: out,
      seed: undefined,
      costUsd: 0.01,
      modelId,
      requestId,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upscale failed",
      modelId,
    };
  }
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
