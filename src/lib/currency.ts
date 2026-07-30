/** Approximate USD→PKR for display. Override with USD_PKR_RATE in env. */
export const DEFAULT_USD_PKR_RATE = 278;

export function getUsdPkrRate(): number {
  const raw = process.env.USD_PKR_RATE;
  const n = raw ? Number(raw) : DEFAULT_USD_PKR_RATE;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_PKR_RATE;
}

export function usdToPkr(usd: number, rate = getUsdPkrRate()): number {
  return usd * rate;
}

export function formatPkr(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** e.g. "Rs 11 · 2 versions" (fal bills in USD; we show PKR to the user). */
export function formatDesignCost(usd: number, versionCount: number, rate = getUsdPkrRate()): string {
  const pkr = formatPkr(usdToPkr(usd, rate));
  const versions = `${versionCount} version${versionCount === 1 ? "" : "s"}`;
  return `this design: ${pkr} · ${versions}`;
}
