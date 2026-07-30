/**
 * Server-side env helpers. Never import this from client components.
 */

export function getFalKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error(
      "FAL_KEY is missing. Add it in Render → Environment (and locally in .env.local).",
    );
  }
  return key;
}

export function isFalKeyConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}
