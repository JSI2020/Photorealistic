import { NextResponse } from "next/server";

/**
 * Handoff approved set to AKS catalog (F4).
 * Configure AKS_CATALOG_WEBHOOK_URL — POSTs design_renders-shaped JSON.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      designId?: string;
      title?: string;
      images: Array<{
        url: string;
        role?: string;
        altText?: string;
      }>;
      metadata?: Record<string, unknown>;
    };

    if (!body.images?.length) {
      return NextResponse.json(
        { error: "images array required" },
        { status: 400 },
      );
    }

    const webhook = process.env.AKS_CATALOG_WEBHOOK_URL?.trim();
    const payload = {
      design_renders: body.images.map((img, i) => ({
        sort_order: i,
        role: img.role || (i === 0 ? "hero" : "angle"),
        image_url: img.url,
        alt_text: img.altText || "AI visualization of garment",
        is_ai_visualization: true,
      })),
      design_id: body.designId ?? null,
      title: body.title ?? null,
      metadata: body.metadata ?? {},
      source: "sketch-photoreal",
      handed_off_at: new Date().toISOString(),
    };

    if (!webhook) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        message:
          "AKS_CATALOG_WEBHOOK_URL not set — returning payload only (dry run).",
        payload,
      });
    }

    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.AKS_CATALOG_WEBHOOK_TOKEN
          ? {
              Authorization: `Bearer ${process.env.AKS_CATALOG_WEBHOOK_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `AKS webhook ${res.status}: ${text.slice(0, 300)}`,
          payload,
        },
        { status: 502 },
      );
    }

    let responseJson: unknown = text;
    try {
      responseJson = JSON.parse(text);
    } catch {
      /* keep text */
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      aksResponse: responseJson,
      payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Handoff failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
