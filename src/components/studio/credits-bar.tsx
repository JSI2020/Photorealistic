"use client";

import { useCallback, useEffect, useState } from "react";

type ProviderBalance =
  | {
      ok: true;
      balance: number;
      currency: string;
      isAvailable?: boolean;
    }
  | { ok: false; error: string };

type SpendSnapshot = {
  monthSpendUsd: number;
  monthlySpendCapUsd: number | null;
  remainingUsd: number | null;
  overCap: boolean;
};

type CreditsPayload = {
  fal: ProviderBalance;
  deepseek: ProviderBalance;
  spend?: SpendSnapshot;
  error?: string;
};

function formatMoney(amount: number, currency: string): string {
  if (currency === "CNY" || currency === "¥") {
    return `¥${amount.toFixed(2)}`;
  }
  return `$${amount.toFixed(2)}`;
}

function ProviderChip({
  name,
  data,
}: {
  name: string;
  data: ProviderBalance | null;
}) {
  if (!data) {
    return (
      <span className="text-muted-foreground">
        {name} …
      </span>
    );
  }
  if (!data.ok) {
    return (
      <span className="text-muted-foreground" title={data.error}>
        {name} —
      </span>
    );
  }
  return (
    <span title={data.isAvailable === false ? "Balance may be insufficient" : undefined}>
      {name}{" "}
      <span className="font-medium text-foreground">
        {formatMoney(data.balance, data.currency)}
      </span>
    </span>
  );
}

export function CreditsBar({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<CreditsPayload | null>(null);

  const load = useCallback(() => {
    void fetch("/api/credits")
      .then(async (r) => {
        const json = (await r.json()) as CreditsPayload;
        if (!r.ok) throw new Error(json.error || "Credits failed");
        setData(json);
      })
      .catch(() => {
        setData({
          fal: { ok: false, error: "unavailable" },
          deepseek: { ok: false, error: "unavailable" },
        });
      });
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load, refreshKey]);

  const spend = data?.spend;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground sm:text-xs">
      <ProviderChip name="fal" data={data?.fal ?? null} />
      <span className="text-border">·</span>
      <ProviderChip name="deepseek" data={data?.deepseek ?? null} />
      {spend && spend.monthlySpendCapUsd != null && (
        <>
          <span className="text-border">·</span>
          <span
            className={spend.overCap ? "text-destructive" : undefined}
            title="App-tracked fal spend this UTC month vs Settings cap"
          >
            month ${spend.monthSpendUsd.toFixed(2)} / $
            {spend.monthlySpendCapUsd.toFixed(0)}
          </span>
        </>
      )}
    </div>
  );
}
