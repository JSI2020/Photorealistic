/**
 * Monthly spend hard cap — refuse generate/refine when over budget.
 */

import { listAllDesignsForSpend } from "@/lib/design-store";
import {
  FAL_MODEL_OPTIONS,
  FAL_TEXT_TO_IMAGE,
  type FalModelKey,
} from "@/lib/fal-config";
import { getAppSettings } from "@/lib/settings-store";

export type SpendSnapshot = {
  monthKey: string;
  monthSpendUsd: number;
  monthlySpendCapUsd: number | null;
  remainingUsd: number | null;
  overCap: boolean;
};

export type SpendGateResult =
  | { ok: true; snapshot: SpendSnapshot; estimatedCallUsd: number }
  | {
      ok: false;
      error: string;
      snapshot: SpendSnapshot;
      estimatedCallUsd: number;
    };

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Sum estimated fal costs for versions created this UTC month. */
export function sumMonthSpendUsd(now = new Date()): number {
  const start = startOfUtcMonth(now).getTime();
  const designs = listAllDesignsForSpend();
  let total = 0;
  for (const d of designs) {
    for (const v of d.versions) {
      const t = new Date(v.createdAt).getTime();
      if (Number.isFinite(t) && t >= start) {
        total += v.costUsd || 0;
      }
    }
  }
  return Math.round(total * 1000) / 1000;
}

export async function getSpendSnapshot(now = new Date()): Promise<SpendSnapshot> {
  const settings = await getAppSettings();
  const monthSpendUsd = sumMonthSpendUsd(now);
  const cap = settings.monthlySpendCapUsd;
  const remainingUsd =
    cap == null ? null : Math.max(0, Math.round((cap - monthSpendUsd) * 1000) / 1000);
  return {
    monthKey: monthKey(now),
    monthSpendUsd,
    monthlySpendCapUsd: cap,
    remainingUsd,
    overCap: cap != null && monthSpendUsd >= cap,
  };
}

export function estimateCallCostUsd(opts: {
  modelKey?: FalModelKey;
  textToImage?: boolean;
}): number {
  if (opts.textToImage) return FAL_TEXT_TO_IMAGE.estimatedCostUsd;
  const key = opts.modelKey ?? "nano-banana-edit";
  return FAL_MODEL_OPTIONS[key]?.estimatedCostUsd ?? 0.04;
}

/**
 * Check whether the next call would exceed the monthly cap.
 * Cap null = unlimited.
 */
export async function assertWithinSpendCap(opts: {
  modelKey?: FalModelKey;
  textToImage?: boolean;
}): Promise<SpendGateResult> {
  const estimatedCallUsd = estimateCallCostUsd(opts);
  const snapshot = await getSpendSnapshot();

  if (snapshot.monthlySpendCapUsd == null) {
    return { ok: true, snapshot, estimatedCallUsd };
  }

  const projected = snapshot.monthSpendUsd + estimatedCallUsd;
  if (projected > snapshot.monthlySpendCapUsd + 1e-9) {
    return {
      ok: false,
      estimatedCallUsd,
      snapshot,
      error: `Monthly spend cap reached ($${snapshot.monthSpendUsd.toFixed(2)} / $${snapshot.monthlySpendCapUsd.toFixed(2)} this month). Raise the cap in Settings or wait until next month.`,
    };
  }

  return { ok: true, snapshot, estimatedCallUsd };
}
