/**
 * Live provider credit balances (fal + DeepSeek). Soft-fail per provider.
 */

import { getFalKey, isFalKeyConfigured } from "@/lib/env";

export type ProviderBalanceOk = {
  ok: true;
  balance: number;
  currency: string;
  label: string;
  isAvailable?: boolean;
};

export type ProviderBalanceErr = {
  ok: false;
  error: string;
};

export type ProviderBalance = ProviderBalanceOk | ProviderBalanceErr;

export type ProviderBalances = {
  fal: ProviderBalance;
  deepseek: ProviderBalance;
  fetchedAt: string;
};

function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export async function fetchFalBalance(): Promise<ProviderBalance> {
  if (!isFalKeyConfigured()) {
    return { ok: false, error: "FAL_KEY not set" };
  }

  try {
    const key = getFalKey();
    const res = await fetch(
      "https://api.fal.ai/v1/account/billing?expand=credits",
      {
        headers: { Authorization: `Key ${key}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `fal ${res.status}: ${text.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as {
      credits?: { current_balance?: number; currency?: string };
    };
    const balance = data.credits?.current_balance;
    if (typeof balance !== "number") {
      return { ok: false, error: "fal: no credits in response" };
    }
    return {
      ok: true,
      balance,
      currency: data.credits?.currency || "USD",
      label: "fal",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fal balance failed",
    };
  }
}

export async function fetchDeepSeekBalance(): Promise<ProviderBalance> {
  if (!deepseekConfigured()) {
    return { ok: false, error: "DEEPSEEK_API_KEY not set" };
  }

  try {
    const base =
      process.env.DEEPSEEK_BASE_URL?.replace(/\/$/, "") ||
      "https://api.deepseek.com";
    const res = await fetch(`${base}/user/balance`, {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `deepseek ${res.status}: ${text.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as {
      is_available?: boolean;
      balance_infos?: Array<{
        currency?: string;
        total_balance?: string;
      }>;
    };
    const info =
      data.balance_infos?.find((b) => b.currency === "USD") ||
      data.balance_infos?.[0];
    const balance = Number(info?.total_balance);
    if (!Number.isFinite(balance)) {
      return { ok: false, error: "deepseek: no balance in response" };
    }
    return {
      ok: true,
      balance,
      currency: info?.currency || "USD",
      label: "deepseek",
      isAvailable: data.is_available,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "deepseek balance failed",
    };
  }
}

export async function fetchProviderBalances(): Promise<ProviderBalances> {
  const [fal, deepseek] = await Promise.all([
    fetchFalBalance(),
    fetchDeepSeekBalance(),
  ]);
  return { fal, deepseek, fetchedAt: new Date().toISOString() };
}
