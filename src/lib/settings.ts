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

export type AppSettings = {
  persona: ModelPersona;
  /** Default house-model pick for new designs: "random" or a model id. */
  preferredHouseModelId: HouseModelSelection;
  fal: FalRuntimeConfig;
  monthlySpendReminderUsd: number | null;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  persona: { ...DEFAULT_MODEL_PERSONA },
  preferredHouseModelId: RANDOM_HOUSE_MODEL_ID,
  fal: { ...DEFAULT_FAL_RUNTIME },
  monthlySpendReminderUsd: null,
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
