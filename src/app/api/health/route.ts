import { NextResponse } from "next/server";

import { resolveDataDir } from "@/lib/data-path";
import { isFalKeyConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public liveness + config probe (no secrets). */
export async function GET() {
  let dataDir = "";
  let dataWritable = false;
  try {
    dataDir = resolveDataDir();
    dataWritable = true;
  } catch (err) {
    dataDir = err instanceof Error ? err.message : "unwritable";
  }

  return NextResponse.json({
    ok: true,
    buildId: process.env.BUILD_ID ?? "unknown",
    node: process.version,
    falKey: isFalKeyConfigured(),
    deepseekKey: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    enableSharp: process.env.ENABLE_SHARP === "1",
    dataDir,
    dataWritable,
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
}
