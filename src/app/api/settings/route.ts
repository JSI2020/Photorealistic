import { NextResponse } from "next/server";

import { getAppSettings, saveAppSettings } from "@/lib/settings-store";
import {
  isFalModelKey,
  normalizeHouseModelSelection,
  type AppSettings,
} from "@/lib/settings";
import { HOUSE_MODELS } from "@/lib/model-persona";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json({
      ...settings,
      houseModels: HOUSE_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        cue: m.cue,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load settings.";
    console.error("[api/settings GET]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppSettings> & {
      persona?: Partial<AppSettings["persona"]>;
      fal?: Partial<AppSettings["fal"]>;
    };

    const current = await getAppSettings();
    const next: AppSettings = {
      persona: {
        description:
          body.persona?.description?.trim() || current.persona.description,
        seed:
          typeof body.persona?.seed === "number"
            ? body.persona.seed
            : current.persona.seed,
        lockSeed:
          typeof body.persona?.lockSeed === "boolean"
            ? body.persona.lockSeed
            : current.persona.lockSeed,
      },
      preferredHouseModelId: normalizeHouseModelSelection(
        body.preferredHouseModelId ?? current.preferredHouseModelId,
      ),
      fal: {
        generateModel:
          body.fal?.generateModel && isFalModelKey(body.fal.generateModel)
            ? body.fal.generateModel
            : current.fal.generateModel,
        refineModel:
          body.fal?.refineModel && isFalModelKey(body.fal.refineModel)
            ? body.fal.refineModel
            : current.fal.refineModel,
      },
      monthlySpendReminderUsd:
        body.monthlySpendReminderUsd === undefined
          ? current.monthlySpendReminderUsd
          : body.monthlySpendReminderUsd,
      monthlySpendCapUsd:
        body.monthlySpendCapUsd === undefined
          ? current.monthlySpendCapUsd
          : body.monthlySpendCapUsd,
      perDesignCostCeilingUsd:
        body.perDesignCostCeilingUsd === undefined
          ? current.perDesignCostCeilingUsd
          : body.perDesignCostCeilingUsd,
      strengths: {
        ...current.strengths,
        ...(body.strengths ?? {}),
      },
    };

    // Keep persona fields synced to the preferred fixed model when not random.
    if (next.preferredHouseModelId !== "random") {
      const picked = HOUSE_MODELS.find((m) => m.id === next.preferredHouseModelId);
      if (picked) {
        next.persona = {
          description: picked.description,
          seed: picked.seed,
          lockSeed: picked.lockSeed,
        };
      }
    }

    const saved = await saveAppSettings(next);
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
