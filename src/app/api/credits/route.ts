import { NextResponse } from "next/server";

import { fetchProviderBalances } from "@/lib/provider-balances";
import { getSpendSnapshot } from "@/lib/spend-gate";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [balances, spend] = await Promise.all([
      fetchProviderBalances(),
      getSpendSnapshot(),
    ]);
    return NextResponse.json({ ...balances, spend });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load credits.";
    console.error("[api/credits]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
