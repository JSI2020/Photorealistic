import { NextResponse } from "next/server";

import { listAllDesignsForSpend, listSavedDesigns, getDesign } from "@/lib/design-store";
import { getUsdPkrRate, usdToPkr } from "@/lib/currency";
import { getSpendSnapshot } from "@/lib/spend-gate";
import { getAppSettings } from "@/lib/settings-store";

export const runtime = "nodejs";

/** E3 spend dashboard — month totals, by model, cost per saved design. */
export async function GET() {
  try {
    const [spend, settings] = await Promise.all([
      getSpendSnapshot(),
      getAppSettings(),
    ]);
    const rate = getUsdPkrRate();

    const byModel: Record<string, { count: number; costUsd: number }> = {};
    const start = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        1,
      ),
    ).getTime();

    for (const d of listAllDesignsForSpend()) {
      // We don't have modelId on spend helper — pull from saved designs
      void d;
    }

    const saved = listSavedDesigns();
    let approvedCost = 0;
    let approvedCount = 0;
    for (const d of saved) {
      const full = getDesign(d.id);
      if (!full) continue;
      for (const v of full.versions) {
        const t = new Date(v.createdAt).getTime();
        if (t < start) continue;
        approvedCost += v.costUsd || 0;
        approvedCount += 1;
        const key = v.modelId || "unknown";
        if (!byModel[key]) byModel[key] = { count: 0, costUsd: 0 };
        byModel[key].count += 1;
        byModel[key].costUsd += v.costUsd || 0;
      }
    }

    return NextResponse.json({
      spend,
      monthSpendPkr: usdToPkr(spend.monthSpendUsd, rate),
      capPkr:
        spend.monthlySpendCapUsd != null
          ? usdToPkr(spend.monthlySpendCapUsd, rate)
          : null,
      byModel,
      approvedImagesThisMonth: approvedCount,
      costPerApprovedUsd:
        approvedCount > 0
          ? Math.round((approvedCost / approvedCount) * 1000) / 1000
          : null,
      perDesignCostCeilingUsd: settings.perDesignCostCeilingUsd,
      usdPkrRate: rate,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Spend dashboard failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
