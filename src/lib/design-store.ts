import { asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { designVersions, designs } from "@/db/schema";

export type DesignRecord = typeof designs.$inferSelect;
export type VersionRecord = typeof designVersions.$inferSelect;

export type DesignWithVersions = DesignRecord & {
  versions: VersionRecord[];
};

export type SaveVersionInput = {
  id?: string;
  parentVersionId?: string | null;
  imageUrl: string;
  prompt: string;
  negativePrompt?: string | null;
  seed?: number | null;
  modelId: string;
  feedback?: string | null;
  costUsd: number;
  requestId?: string | null;
};

export type SaveDesignInput = {
  /** If set and exists, replace that design's versions. */
  designId?: string;
  title?: string;
  description?: string;
  shirtColour?: string;
  trouserColour?: string;
  fabric?: string;
  sketchUrls: string[];
  oldDesignUrl?: string;
  personaJson?: string;
  versions: SaveVersionInput[];
};

export function listSavedDesigns(): DesignRecord[] {
  return db
    .select()
    .from(designs)
    .where(eq(designs.saved, true))
    .orderBy(desc(designs.updatedAt))
    .all();
}

export function getDesign(id: string): DesignWithVersions | null {
  const design = db.select().from(designs).where(eq(designs.id, id)).get();
  if (!design) return null;
  const versions = db
    .select()
    .from(designVersions)
    .where(eq(designVersions.designId, id))
    .orderBy(asc(designVersions.createdAt))
    .all();
  return { ...design, versions };
}

/**
 * Persist a finished design only when the user clicks Save.
 * Working generations stay in the browser until then.
 */
export function saveDesignToDatabase(input: SaveDesignInput): DesignWithVersions {
  if (!input.versions.length) {
    throw new Error("Cannot save a design with no versions.");
  }

  const now = new Date();
  const totalCost = input.versions.reduce((sum, v) => sum + (v.costUsd || 0), 0);
  const existingId = input.designId;
  const existing = existingId
    ? db.select().from(designs).where(eq(designs.id, existingId)).get()
    : undefined;

  const id = existing?.id ?? randomUUID();

  if (existing) {
    db.delete(designVersions).where(eq(designVersions.designId, id)).run();
    db.update(designs)
      .set({
        title: input.title?.slice(0, 80) || input.description?.slice(0, 80) || existing.title,
        description: input.description ?? existing.description,
        shirtColour: input.shirtColour ?? existing.shirtColour,
        trouserColour: input.trouserColour ?? existing.trouserColour,
        fabric: input.fabric ?? existing.fabric,
        sketchUrlsJson: JSON.stringify(input.sketchUrls),
        oldDesignUrl: input.oldDesignUrl ?? existing.oldDesignUrl,
        personaJson: input.personaJson ?? existing.personaJson,
        totalCost,
        saved: true,
        updatedAt: now,
      })
      .where(eq(designs.id, id))
      .run();
  } else {
    db.insert(designs)
      .values({
        id,
        title: input.title?.slice(0, 80) || input.description?.slice(0, 80) || "Untitled design",
        description: input.description ?? null,
        shirtColour: input.shirtColour ?? null,
        trouserColour: input.trouserColour ?? null,
        fabric: input.fabric ?? null,
        sketchUrlsJson: JSON.stringify(input.sketchUrls),
        oldDesignUrl: input.oldDesignUrl ?? null,
        personaJson: input.personaJson ?? null,
        createdAt: now,
        updatedAt: now,
        totalCost,
        saved: true,
      })
      .run();
  }

  for (const v of input.versions) {
    db.insert(designVersions)
      .values({
        id: v.id || randomUUID(),
        designId: id,
        parentVersionId: v.parentVersionId ?? null,
        imageUrl: v.imageUrl,
        prompt: v.prompt,
        negativePrompt: v.negativePrompt ?? null,
        seed: v.seed ?? null,
        modelId: v.modelId,
        feedback: v.feedback ?? null,
        costUsd: v.costUsd,
        requestId: v.requestId ?? null,
        createdAt: now,
      })
      .run();
  }

  return getDesign(id)!;
}

export function parseSketchUrls(design: DesignRecord): string[] {
  try {
    const parsed = JSON.parse(design.sketchUrlsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string")
      : [];
  } catch {
    return [];
  }
}
