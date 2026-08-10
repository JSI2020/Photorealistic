/**
 * Persist fal CDN images to local /data so gallery URLs don't expire.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveDataDir } from "@/lib/data-path";

function imagesDir(): string {
  const dir = path.join(resolveDataDir(), "images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function mediaFilePath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(imagesDir(), `${safe}.png`);
}

export function mediaPublicUrl(id: string): string {
  return `/api/media/${id}`;
}

/**
 * Download a remote image (typically fal CDN) and store it durably.
 * Returns the local public URL. On failure, returns the original URL.
 */
export async function persistRemoteImage(
  remoteUrl: string,
  preferredId?: string,
): Promise<{ id: string; url: string; durable: boolean }> {
  const id = preferredId || randomUUID();
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      console.warn("[media] download failed", res.status, remoteUrl);
      return { id, url: remoteUrl, durable: false };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(mediaFilePath(id), buf);
    return { id, url: mediaPublicUrl(id), durable: true };
  } catch (err) {
    console.warn("[media] persist failed:", err);
    return { id, url: remoteUrl, durable: false };
  }
}

export function readMediaFile(id: string): Buffer | null {
  const file = mediaFilePath(id);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}
