import {
  DEFAULT_HOUSE_MODEL,
  DEFAULT_MODEL_PERSONA,
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
  type ModelPersona,
} from "@/lib/model-persona";
import {
  DEFAULT_FAL_RUNTIME,
  type FalModelKey,
  type FalRuntimeConfig,
} from "@/lib/fal-config";

export type StrengthSettings = {
  poseOnly: number;
  refineSketch: number;
  refineDefault: number;
  backgroundSketch: number;
  backgroundDefault: number;
  oldDesignGenerate: number;
};

export const DEFAULT_STRENGTH_SETTINGS: StrengthSettings = {
  poseOnly: 0.42,
  refineSketch: 0.5,
  refineDefault: 0.58,
  backgroundSketch: 0.72,
  backgroundDefault: 0.78,
  oldDesignGenerate: 0.82,
};

export type AppSettings = {
  persona: ModelPersona;
  /** Default house-model pick for new designs: "random" or a model id. */
  preferredHouseModelId: HouseModelSelection;
  fal: FalRuntimeConfig;
  /** Soft UI reminder threshold (optional). */
  monthlySpendReminderUsd: number | null;
  /** Hard monthly spend cap in USD. null = unlimited. */
  monthlySpendCapUsd: number | null;
  /** Per-design cost ceiling warning (USD). null = no warn. */
  perDesignCostCeilingUsd: number | null;
  /** Tunable img2img strengths (A5). */
  strengths: StrengthSettings;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  persona: { ...DEFAULT_MODEL_PERSONA },
  preferredHouseModelId: RANDOM_HOUSE_MODEL_ID,
  fal: { ...DEFAULT_FAL_RUNTIME },
  monthlySpendReminderUsd: null,
  monthlySpendCapUsd: null,
  perDesignCostCeilingUsd: null,
  strengths: { ...DEFAULT_STRENGTH_SETTINGS },
};

export function isFalModelKey(value: string): value is FalModelKey {
  return (
    value === "nano-banana-edit" ||
    value === "nano-banana-2-edit" ||
    value === "flux-dev-img2img"
  );
}

export function normalizeHouseModelSelection(
  value: string | null | undefined,
): HouseModelSelection {
  if (!value || value === RANDOM_HOUSE_MODEL_ID) return RANDOM_HOUSE_MODEL_ID;
  return value;
}

export { DEFAULT_HOUSE_MODEL };
