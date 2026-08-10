import fs from "node:fs";
import path from "node:path";

import { resolveDataDir } from "@/lib/data-path";
import { DEFAULT_MODEL_PERSONA } from "@/lib/model-persona";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_STRENGTH_SETTINGS,
  isFalModelKey,
  normalizeHouseModelSelection,
  type AppSettings,
  type StrengthSettings,
} from "@/lib/settings";

function settingsPath(): string {
  return path.join(resolveDataDir(), "settings.json");
}

function normalizeStrengths(
  raw: Partial<StrengthSettings> | undefined,
): StrengthSettings {
  const clamp = (n: unknown, fallback: number) => {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(1, Math.max(0.05, v));
  };
  return {
    poseOnly: clamp(raw?.poseOnly, DEFAULT_STRENGTH_SETTINGS.poseOnly),
    refineSketch: clamp(
      raw?.refineSketch,
      DEFAULT_STRENGTH_SETTINGS.refineSketch,
    ),
    refineDefault: clamp(
      raw?.refineDefault,
      DEFAULT_STRENGTH_SETTINGS.refineDefault,
    ),
    backgroundSketch: clamp(
      raw?.backgroundSketch,
      DEFAULT_STRENGTH_SETTINGS.backgroundSketch,
    ),
    backgroundDefault: clamp(
      raw?.backgroundDefault,
      DEFAULT_STRENGTH_SETTINGS.backgroundDefault,
    ),
    oldDesignGenerate: clamp(
      raw?.oldDesignGenerate,
      DEFAULT_STRENGTH_SETTINGS.oldDesignGenerate,
    ),
  };
}

function normalize(raw: Partial<AppSettings> | null | undefined): AppSettings {
  if (!raw) {
    return {
      ...DEFAULT_APP_SETTINGS,
      persona: { ...DEFAULT_MODEL_PERSONA },
      fal: { ...DEFAULT_APP_SETTINGS.fal },
      strengths: { ...DEFAULT_STRENGTH_SETTINGS },
    };
  }

  // Migrate: if only reminder was set historically, treat it as the hard cap too.
  const cap =
    raw.monthlySpendCapUsd !== undefined
      ? raw.monthlySpendCapUsd
      : raw.monthlySpendReminderUsd !== undefined
        ? raw.monthlySpendReminderUsd
        : null;

  return {
    persona: {
      description:
        raw.persona?.description?.trim() || DEFAULT_MODEL_PERSONA.description,
      seed:
        typeof raw.persona?.seed === "number"
          ? raw.persona.seed
          : DEFAULT_MODEL_PERSONA.seed,
      lockSeed:
        typeof raw.persona?.lockSeed === "boolean"
          ? raw.persona.lockSeed
          : DEFAULT_MODEL_PERSONA.lockSeed,
    },
    preferredHouseModelId: normalizeHouseModelSelection(
      raw.preferredHouseModelId,
    ),
    fal: {
      generateModel:
        raw.fal?.generateModel && isFalModelKey(raw.fal.generateModel)
          ? raw.fal.generateModel
          : DEFAULT_APP_SETTINGS.fal.generateModel,
      refineModel:
        raw.fal?.refineModel && isFalModelKey(raw.fal.refineModel)
          ? raw.fal.refineModel
          : DEFAULT_APP_SETTINGS.fal.refineModel,
    },
    monthlySpendReminderUsd:
      raw.monthlySpendReminderUsd === undefined
        ? null
        : raw.monthlySpendReminderUsd,
    monthlySpendCapUsd: cap,
    perDesignCostCeilingUsd:
      raw.perDesignCostCeilingUsd === undefined
        ? null
        : raw.perDesignCostCeilingUsd,
    strengths: normalizeStrengths(raw.strengths),
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) return normalize(null);
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<AppSettings>;
    return normalize(raw);
  } catch (err) {
    console.warn("[settings] read failed, using defaults:", err);
    return normalize(null);
  }
}

export async function saveAppSettings(next: AppSettings): Promise<AppSettings> {
  const normalized = normalize(next);
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}
