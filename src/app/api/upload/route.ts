import { NextResponse } from "next/server";

import { uploadToFal } from "@/lib/fal";
import { bufferToPngBlob, preprocessSketch } from "@/lib/image-preprocess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const kind = String(form.get("kind") ?? "sketch");
    const role = String(form.get("role") ?? kind);

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const uploaded: Array<{
      originalName: string;
      url: string;
      lineArtUrl?: string;
      width: number;
      height: number;
      role: string;
    }> = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const shouldPreprocess = kind === "sketch" || role === "front" || role === "back";

      if (shouldPreprocess) {
        const prepared = await preprocessSketch(bytes);
        const processedFile = await bufferToPngBlob(
          prepared.processed,
          file.name?.replace(/\.\w+$/, "") + "-processed.png" || "sketch.png",
        );
        const url = await uploadToFal(processedFile);
        let lineArtUrl: string | undefined;
        if (
          prepared.lineArt !== prepared.processed &&
          prepared.width > 0
        ) {
          const lineFile = await bufferToPngBlob(
            prepared.lineArt,
            "sketch-lineart.png",
          );
          lineArtUrl = await uploadToFal(lineFile);
        }
        uploaded.push({
          originalName: file.name,
          url,
          lineArtUrl,
          width: prepared.width,
          height: prepared.height,
          role,
        });
      } else {
        const blob = new File(
          [new Uint8Array(bytes)],
          file.name || `${kind}.png`,
          { type: file.type || "image/png" },
        );
        const url = await uploadToFal(blob);
        uploaded.push({
          originalName: file.name,
          url,
          width: 0,
          height: 0,
          role,
        });
      }
    }

    return NextResponse.json({ files: uploaded });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    console.error("[api/upload]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
