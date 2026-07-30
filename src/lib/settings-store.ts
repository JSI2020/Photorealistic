import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { DEFAULT_MODEL_PERSONA } from "@/lib/model-persona";
import {
  DEFAULT_APP_SETTINGS,
  isFalModelKey,
  normalizeHouseModelSelection,
  type AppSettings,
} from "@/lib/settings";

function rowToSettings(
  row: typeof appSettings.$inferSelect | undefined,
): AppSettings {
  if (!row) {
    return {
      ...DEFAULT_APP_SETTINGS,
      persona: { ...DEFAULT_MODEL_PERSONA },
    };
  }

  return {
    persona: {
      description: row.personaDescription ?? DEFAULT_MODEL_PERSONA.description,
      seed: row.seed ?? DEFAULT_MODEL_PERSONA.seed,
      lockSeed: row.lockSeed ?? true,
    },
    preferredHouseModelId: normalizeHouseModelSelection(
      row.preferredHouseModelId,
    ),
    fal: {
      generateModel: isFalModelKey(row.generateModel)
        ? row.generateModel
        : DEFAULT_APP_SETTINGS.fal.generateModel,
      refineModel: isFalModelKey(row.refineModel)
        ? row.refineModel
        : DEFAULT_APP_SETTINGS.fal.refineModel,
    },
    monthlySpendReminderUsd: row.monthlySpendReminderUsd ?? null,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const row = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, "default"))
    .get();
  return rowToSettings(row);
}

export async function saveAppSettings(next: AppSettings): Promise<AppSettings> {
  const existing = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, "default"))
    .get();

  const values = {
    id: "default" as const,
    personaDescription: next.persona.description,
    seed: next.persona.seed,
    lockSeed: next.persona.lockSeed,
    generateModel: next.fal.generateModel,
    refineModel: next.fal.refineModel,
    preferredHouseModelId: next.preferredHouseModelId,
    monthlySpendReminderUsd: next.monthlySpendReminderUsd,
    updatedAt: new Date(),
  };

  if (existing) {
    db.update(appSettings).set(values).where(eq(appSettings.id, "default")).run();
  } else {
    db.insert(appSettings).values(values).run();
  }

  return next;
}
