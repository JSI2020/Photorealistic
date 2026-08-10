/**
 * Optional face-lock reference URLs per persona (A4).
 * Drop portraits into /public/personas/{id}.jpg and set PERSONA_ANCHOR_BASE
 * or fill ANCHOR_BY_ID below.
 */

import type { HouseModel } from "@/lib/model-persona";

const ANCHOR_BY_ID: Record<string, string> = {
  // Example: ayesha: "/personas/ayesha.jpg",
};

/**
 * Absolute or site-relative URL for a persona identity anchor image.
 * Returns undefined when no portrait is configured yet.
 */
export function getPersonaAnchorUrl(
  model: Pick<HouseModel, "id">,
  origin?: string,
): string | undefined {
  const path = ANCHOR_BY_ID[model.id];
  if (!path) {
    const base = process.env.PERSONA_ANCHOR_BASE?.replace(/\/$/, "");
    if (!base) return undefined;
    return `${base}/${model.id}.jpg`;
  }
  if (path.startsWith("http")) return path;
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  return path;
}
