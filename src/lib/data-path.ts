import fs from "node:fs";
import path from "node:path";

/**
 * Writable data directory for JSON settings / gallery.
 * Prefer DATABASE_URL's folder (file:/data/...) then /data, then /tmp, then ./data.
 */
export function resolveDataDir(): string {
  const candidates: string[] = [];

  const raw = process.env.DATABASE_URL;
  if (raw) {
    const filePath = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
    candidates.push(path.dirname(path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)));
  }

  candidates.push("/data", "/tmp/photoreal-data", path.join(process.cwd(), "data"));

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, ".write-test");
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
      return dir;
    } catch {
      /* try next */
    }
  }

  return path.join(process.cwd(), "data");
}
