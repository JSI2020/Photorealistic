import { NextResponse } from "next/server";

import {
  getDesign,
  listSavedDesigns,
  parseSketchUrls,
  saveDesignToDatabase,
  type SaveDesignInput,
} from "@/lib/design-store";
import { getUsdPkrRate, usdToPkr } from "@/lib/currency";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const rate = getUsdPkrRate();

  if (id) {
    const design = getDesign(id);
    if (!design || !design.saved) {
      return NextResponse.json({ error: "Design not found." }, { status: 404 });
    }
    return NextResponse.json({
      ...design,
      sketchUrls: parseSketchUrls(design),
      totalCostPkr: usdToPkr(design.totalCost, rate),
      usdPkrRate: rate,
    });
  }

  const designs = listSavedDesigns().map((d) => {
    const full = getDesign(d.id);
    const cover = full?.versions.at(-1)?.imageUrl ?? null;
    return {
      ...d,
      coverUrl: cover,
      versionCount: full?.versions.length ?? 0,
      sketchUrls: parseSketchUrls(d),
      totalCostPkr: usdToPkr(d.totalCost, rate),
    };
  });

  return NextResponse.json({ designs, usdPkrRate: rate });
}

/** Save final design + full version history to the database. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveDesignInput;
    if (!body.versions?.length) {
      return NextResponse.json(
        { error: "Nothing to save — generate at least one version first." },
        { status: 400 },
      );
    }

    const saved = saveDesignToDatabase({
      designId: body.designId,
      title: body.title,
      description: body.description,
      shirtColour: body.shirtColour,
      trouserColour: body.trouserColour,
      fabric: body.fabric,
      sketchUrls: body.sketchUrls ?? [],
      oldDesignUrl: body.oldDesignUrl,
      personaJson: body.personaJson,
      versions: body.versions,
    });

    const rate = getUsdPkrRate();
    return NextResponse.json({
      ok: true,
      designId: saved.id,
      saved: true,
      totalCost: saved.totalCost,
      totalCostPkr: usdToPkr(saved.totalCost, rate),
      versionCount: saved.versions.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
