import { NextResponse } from "next/server";

import { uploadToFal } from "@/lib/fal";

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
      width: number;
      height: number;
    }> = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const blob = new File(
        [new Uint8Array(bytes)],
        file.name || (kind === "old-design" ? "old-design.png" : "sketch.png"),
        { type: file.type || "image/png" },
      );
      const url = await uploadToFal(blob);
      uploaded.push({
        originalName: file.name,
        url,
        width: 0,
        height: 0,
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    console.error("[api/upload]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
