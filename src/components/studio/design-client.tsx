"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ResultScreen, type StudioVersion } from "@/components/studio/result-screen";
import { SettingsPanel } from "@/components/studio/settings-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { FAL_MODEL_OPTIONS } from "@/lib/fal-config";
import { cn } from "@/lib/utils";

type ApiVersion = StudioVersion & {
  prompt?: string;
  negativePrompt?: string | null;
  seed?: number | null;
  parentVersionId?: string | null;
  requestId?: string | null;
};

type DesignPayload = {
  id: string;
  description?: string | null;
  shirtColour?: string | null;
  trouserColour?: string | null;
  fabric?: string | null;
  oldDesignUrl?: string | null;
  personaJson?: string | null;
  totalCost: number;
  usdPkrRate?: number;
  sketchUrls: string[];
  versions: ApiVersion[];
  error?: string;
};

export function DesignClient({ designId }: { designId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [usdPkrRate, setUsdPkrRate] = useState(278);
  const [sketchUrls, setSketchUrls] = useState<string[]>([]);
  const [meta, setMeta] = useState({
    description: "",
    shirtColour: "",
    trouserColour: "",
    fabric: "",
    oldDesignUrl: undefined as string | undefined,
    houseModelId: "ayesha",
    houseModelName: "Ayesha",
  });
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Refining…");
  const [modelName, setModelName] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastRefinePayload, setLastRefinePayload] = useState<{
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/designs?id=${designId}`);
      const data = (await res.json()) as DesignPayload;
      if (!res.ok) throw new Error(data.error || "Design not found.");
      setVersions(data.versions);
      setActiveVersionId(data.versions.at(-1)?.id ?? "");
      setTotalCost(data.totalCost);
      if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
      setSketchUrls(data.sketchUrls);
      let houseModelId = "ayesha";
      let houseModelName = "Ayesha";
      try {
        if (data.personaJson) {
          const parsed = JSON.parse(data.personaJson) as {
            houseModelId?: string;
            houseModelName?: string;
          };
          if (parsed.houseModelId) houseModelId = parsed.houseModelId;
          if (parsed.houseModelName) houseModelName = parsed.houseModelName;
        }
      } catch {
        /* ignore */
      }
      setMeta({
        description: data.description ?? "",
        shirtColour: data.shirtColour ?? "",
        trouserColour: data.trouserColour ?? "",
        fabric: data.fabric ?? "",
        oldDesignUrl: data.oldDesignUrl ?? undefined,
        houseModelId,
        houseModelName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load design.");
    } finally {
      setLoading(false);
    }
  }, [designId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefine = async (payload: {
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  }) => {
    const active = versions.find((v) => v.id === activeVersionId);
    if (!active) return;
    setLastRefinePayload(payload);
    setBusy(true);
    setBusyLabel("Refining…");
    setError(null);
    try {
      const settingsRes = await fetch("/api/settings");
      const settings = (await settingsRes.json()) as {
        fal: { refineModel: keyof typeof FAL_MODEL_OPTIONS };
      };
      setModelName(
        FAL_MODEL_OPTIONS[settings.fal.refineModel]?.label ?? "fal model",
      );

      const nextShirt = payload.shirtColour ?? meta.shirtColour;
      const nextTrouser = payload.trouserColour ?? meta.trouserColour;
      const nextFabric = payload.fabric ?? meta.fabric;

      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseImageUrl: active.imageUrl,
          sketchUrls,
          oldDesignUrl: meta.oldDesignUrl,
          parentVersionId: active.id,
          description: meta.description,
          shirtColour: nextShirt,
          trouserColour: nextTrouser,
          fabric: nextFabric,
          feedback: payload.feedback,
          previousTotalCost: totalCost,
          houseModelId: meta.houseModelId,
        }),
      });
      const data = (await res.json()) as {
        version: ApiVersion;
        totalCost: number;
        usdPkrRate?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Refine failed.");
      setMeta((m) => ({
        ...m,
        shirtColour: nextShirt,
        trouserColour: nextTrouser,
        fabric: nextFabric,
      }));
      setVersions((prev) => [...prev, data.version]);
      setActiveVersionId(data.version.id);
      setTotalCost(data.totalCost);
      if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designId,
        description: meta.description,
        shirtColour: meta.shirtColour,
        trouserColour: meta.trouserColour,
        fabric: meta.fabric,
        sketchUrls,
        oldDesignUrl: meta.oldDesignUrl,
        personaJson: JSON.stringify({
          houseModelId: meta.houseModelId,
          houseModelName: meta.houseModelName,
        }),
        versions: versions.map((v) => ({
          id: v.id,
          parentVersionId: v.parentVersionId,
          imageUrl: v.imageUrl,
          prompt: v.prompt || "",
          negativePrompt: v.negativePrompt,
          seed: v.seed,
          modelId: v.modelId,
          feedback: v.feedback,
          costUsd: v.costUsd,
          requestId: v.requestId,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || "Save failed.");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f3efe8_0%,_#faf9f7_45%,_#f5f5f4_100%)]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/gallery"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-4" />
            Gallery
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        )}
        {!loading && versions.length > 0 && (
          <ResultScreen
            designId={designId}
            versions={versions}
            activeVersionId={activeVersionId}
            totalCost={totalCost}
            usdPkrRate={usdPkrRate}
            sketchPreviews={sketchUrls}
            modelName={modelName}
            houseModelName={meta.houseModelName}
            busy={busy}
            busyLabel={busyLabel}
            error={error}
            onSelectVersion={setActiveVersionId}
            onRefine={handleRefine}
            onSave={handleSave}
            onStartOver={() => {
              window.location.href = "/";
            }}
            onRetry={
              lastRefinePayload
                ? () => void handleRefine(lastRefinePayload)
                : undefined
            }
          />
        )}
        {!loading && !versions.length && error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
