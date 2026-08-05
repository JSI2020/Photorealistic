/**
 * fal model IDs and pricing — verified from fal docs (Jul 2026).
 * Swap IDs here without touching call sites.
 *
 * Nano Banana Edit: https://fal.ai/models/fal-ai/nano-banana/edit
 * Nano Banana 2 Edit: https://fal.ai/models/fal-ai/nano-banana-2/edit
 * FLUX.1 [dev] img2img: https://fal.ai/models/fal-ai/flux/dev/image-to-image
 */

export type FalModelConfig = {
  id: string;
  label: string;
  /** Approximate USD per image at default settings (docs-listed list price). */
  estimatedCostUsd: number;
  /** How reference images are passed to this endpoint. */
  imageInput: "image_urls" | "image_url";
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
};

export const FAL_MODEL_OPTIONS = {
  "nano-banana-edit": {
    id: "fal-ai/nano-banana/edit",
    label: "Nano Banana Edit",
    estimatedCostUsd: 0.039,
    imageInput: "image_urls",
    supportsNegativePrompt: false,
    supportsSeed: true,
  },
  "nano-banana-2-edit": {
    id: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2 Edit",
    estimatedCostUsd: 0.08,
    imageInput: "image_urls",
    supportsNegativePrompt: false,
    supportsSeed: true,
  },
  "flux-dev-img2img": {
    id: "fal-ai/flux/dev/image-to-image",
    label: "FLUX.1 [dev] Image-to-Image",
    estimatedCostUsd: 0.025,
    imageInput: "image_url",
    supportsNegativePrompt: true,
    supportsSeed: true,
  },
} as const satisfies Record<string, FalModelConfig>;

export type FalModelKey = keyof typeof FAL_MODEL_OPTIONS;

export type FalRuntimeConfig = {
  generateModel: FalModelKey;
  refineModel: FalModelKey;
};

export const DEFAULT_FAL_RUNTIME: FalRuntimeConfig = {
  generateModel: "nano-banana-edit",
  refineModel: "nano-banana-edit",
};

export const FAL_TEXT_TO_IMAGE = {
  id: "fal-ai/flux/dev",
  label: "FLUX.1 [dev] Text-to-Image",
  estimatedCostUsd: 0.025,
} as const;

export function getFalModel(key: FalModelKey): FalModelConfig {
  return FAL_MODEL_OPTIONS[key];
}
