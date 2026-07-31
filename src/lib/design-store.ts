import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveDataDir } from "@/lib/data-path";

export type DesignRecord = {
  id: string;
  title: string | null;
  description: string | null;
  shirtColour: string | null;
  trouserColour: string | null;
  fabric: string | null;
  sketchUrlsJson: string;
  oldDesignUrl: string | null;
  personaJson: string | null;
  createdAt: Date;
  updatedAt: Date;
  totalCost: number;
  saved: boolean;
};

export type VersionRecord = {
  id: string;
  designId: string;
  parentVersionId: string | null;
  imageUrl: string;
  prompt: string;
  negativePrompt: string | null;
  seed: number | null;
  modelId: string;
  feedback: string | null;
  costUsd: number;
  requestId: string | null;
  createdAt: Date;
};

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

type StoredDesign = {
  id: string;
  title: string | null;
  description: string | null;
  shirtColour: string | null;
  trouserColour: string | null;
  fabric: string | null;
  sketchUrlsJson: string;
  oldDesignUrl: string | null;
  personaJson: string | null;
  createdAt: string;
  updatedAt: string;
  totalCost: number;
  saved: boolean;
  versions: Array<{
    id: string;
    designId: string;
    parentVersionId: string | null;
    imageUrl: string;
    prompt: string;
    negativePrompt: string | null;
    seed: number | null;
    modelId: string;
    feedback: string | null;
    costUsd: number;
    requestId: string | null;
    createdAt: string;
  }>;
};

function storePath(): string {
  return path.join(resolveDataDir(), "designs.json");
}

function toRecord(d: StoredDesign): DesignRecord {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    shirtColour: d.shirtColour,
    trouserColour: d.trouserColour,
    fabric: d.fabric,
    sketchUrlsJson: d.sketchUrlsJson,
    oldDesignUrl: d.oldDesignUrl,
    personaJson: d.personaJson,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
    totalCost: d.totalCost,
    saved: d.saved,
  };
}

function toVersion(v: StoredDesign["versions"][number]): VersionRecord {
  return {
    id: v.id,
    designId: v.designId,
    parentVersionId: v.parentVersionId,
    imageUrl: v.imageUrl,
    prompt: v.prompt,
    negativePrompt: v.negativePrompt,
    seed: v.seed,
    modelId: v.modelId,
    feedback: v.feedback,
    costUsd: v.costUsd,
    requestId: v.requestId,
    createdAt: new Date(v.createdAt),
  };
}

function readAll(): StoredDesign[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as StoredDesign[];
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn("[designs] read failed:", err);
    return [];
  }
}

function writeAll(designs: StoredDesign[]): void {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(designs, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function listSavedDesigns(): DesignRecord[] {
  return readAll()
    .filter((d) => d.saved)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .map(toRecord);
}

export function getDesign(id: string): DesignWithVersions | null {
  const found = readAll().find((d) => d.id === id);
  if (!found) return null;
  const versions = [...found.versions]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map(toVersion);
  return { ...toRecord(found), versions };
}

export function saveDesignToDatabase(input: SaveDesignInput): DesignWithVersions {
  if (!input.versions.length) {
    throw new Error("Cannot save a design with no versions.");
  }

  const now = new Date().toISOString();
  const totalCost = input.versions.reduce((sum, v) => sum + (v.costUsd || 0), 0);
  const all = readAll();
  const existingIdx = input.designId
    ? all.findIndex((d) => d.id === input.designId)
    : -1;
  const existing = existingIdx >= 0 ? all[existingIdx] : undefined;
  const id = existing?.id ?? randomUUID();

  const versions = input.versions.map((v) => ({
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
  }));

  const next: StoredDesign = {
    id,
    title:
      input.title?.slice(0, 80) ||
      input.description?.slice(0, 80) ||
      existing?.title ||
      "Untitled design",
    description: input.description ?? existing?.description ?? null,
    shirtColour: input.shirtColour ?? existing?.shirtColour ?? null,
    trouserColour: input.trouserColour ?? existing?.trouserColour ?? null,
    fabric: input.fabric ?? existing?.fabric ?? null,
    sketchUrlsJson: JSON.stringify(input.sketchUrls),
    oldDesignUrl: input.oldDesignUrl ?? existing?.oldDesignUrl ?? null,
    personaJson: input.personaJson ?? existing?.personaJson ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    totalCost,
    saved: true,
    versions,
  };

  if (existingIdx >= 0) all[existingIdx] = next;
  else all.push(next);

  writeAll(all);
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
