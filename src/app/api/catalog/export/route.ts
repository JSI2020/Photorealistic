import { NextResponse } from "next/server";

import { getDesign, parseSketchUrls } from "@/lib/design-store";

export const runtime = "nodejs";

/**
 * Consistent set export (C3) — hero + versions as a named product image set.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const title = searchParams.get("title") || undefined;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const design = getDesign(id);
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const hero = design.versions[0];
  const payload = {
    productKey: design.id,
    title: title || design.title || "Untitled design",
    description: design.description,
    shirtColour: design.shirtColour,
    trouserColour: design.trouserColour,
    fabric: design.fabric,
    sketchUrls: parseSketchUrls(design),
    aiVisualization: true,
    notice:
      "AI visualization — not a photograph of the finished garment. Use real photography for sale-critical hero shots.",
    images: design.versions.map((v, i) => ({
      role: i === 0 ? "hero" : v.feedback || `version-${i + 1}`,
      url: v.imageUrl,
      altText:
        `${design.title || "Outfit"} — AI catalog visualization` +
        (v.feedback ? ` (${v.feedback})` : ""),
      parentVersionId: v.parentVersionId,
      costUsd: v.costUsd,
      modelId: v.modelId,
      seed: v.seed,
      createdAt: v.createdAt,
    })),
    totalCostUsd: design.totalCost,
    exportedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="product-set-${design.id.slice(0, 8)}.json"`,
    },
  });
}

/**
 * Body: { title, versions: [{ imageUrl, role?, feedback?, altText? }], ... }
 * For unsaved drafts.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      versions: Array<{
        imageUrl: string;
        feedback?: string | null;
        parentVersionId?: string | null;
        altText?: string | null;
      }>;
    };

    if (!body.versions?.length) {
      return NextResponse.json(
        { error: "versions required" },
        { status: 400 },
      );
    }

    const payload = {
      productKey: `draft-${Date.now()}`,
      title: body.title || "Untitled draft set",
      description: body.description ?? null,
      aiVisualization: true,
      notice:
        "AI visualization — not a photograph of the finished garment.",
      images: body.versions.map((v, i) => ({
        role: i === 0 ? "hero" : v.feedback || `version-${i + 1}`,
        url: v.imageUrl,
        altText:
          v.altText ||
          `${body.title || "Outfit"} — AI catalog visualization`,
        parentVersionId: v.parentVersionId ?? null,
      })),
      exportedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
