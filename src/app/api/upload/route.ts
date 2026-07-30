import { NextResponse } from "next/server";

import { uploadToFal } from "@/lib/fal";
import { bufferToPngBlob, preprocessSketch } from "@/lib/image-preprocess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const kind = String(form.get("kind") ?? "sketch");

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const uploaded: Array<{
      originalName: string;
      url: string;
      lineArtUrl?: string;
      width: number;
      height: number;
    }> = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());

      if (kind === "old-design") {
        const blob = new File([new Uint8Array(bytes)], file.name || "old-design.png", {
          type: file.type || "image/png",
        });
        const url = await uploadToFal(blob);
        uploaded.push({
          originalName: file.name,
          url,
          width: 0,
          height: 0,
        });
        continue;
      }

      const processed = await preprocessSketch(bytes);
      const mainBlob = await bufferToPngBlob(processed.processed, "sketch.png");
      const lineBlob = await bufferToPngBlob(processed.lineArt, "sketch-line.png");
      const [url, lineArtUrl] = await Promise.all([
        uploadToFal(mainBlob),
        uploadToFal(lineBlob),
      ]);

      uploaded.push({
        originalName: file.name,
        url,
        lineArtUrl,
        width: processed.width,
        height: processed.height,
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
