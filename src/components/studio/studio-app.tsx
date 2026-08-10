"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Images, Settings2 } from "lucide-react";

import { CreditsBar } from "@/components/studio/credits-bar";
import { InputScreen } from "@/components/studio/input-screen";
import { ResultScreen, type StudioVersion } from "@/components/studio/result-screen";
import { SettingsPanel } from "@/components/studio/settings-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPkr, usdToPkr } from "@/lib/currency";
import { FAL_MODEL_OPTIONS } from "@/lib/fal-config";
import { readJsonSafe, fetchSafe, networkErrorMessage } from "@/lib/http";
import {
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "@/lib/model-persona";
import type { PromptMode } from "@/lib/prompt-builder";
import { cn } from "@/lib/utils";

type Phase = "input" | "result";

type DraftMeta = {
  description: string;
  shirtColour: string;
  trouserColour: string;
  fabric: string;
  sketchUrls: string[];
  oldDesignUrl?: string;
  houseModelId: string;
  houseModelName: string;
  promptMode: PromptMode;
};

type ApiVersion = StudioVersion & {
  prompt?: string;
  negativePrompt?: string | null;
  seed?: number | null;
  parentVersionId?: string | null;
  requestId?: string;
};

export function StudioApp() {
  const [phase, setPhase] = useState<Phase>("input");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Generating…");
  const [modelName, setModelName] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [totalCost, setTotalCost] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [usdPkrRate, setUsdPkrRate] = useState(278);
  const [sketchPreviews, setSketchPreviews] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftMeta | null>(null);
  const [defaultHouseModelId, setDefaultHouseModelId] =
    useState<HouseModelSelection>(RANDOM_HOUSE_MODEL_ID);
  const [creditsRefresh, setCreditsRefresh] = useState(0);
  const [lastRefinePayload, setLastRefinePayload] = useState<{
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
    poseOnly?: boolean;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((data: { preferredHouseModelId?: HouseModelSelection }) => {
        if (data.preferredHouseModelId) {
          setDefaultHouseModelId(data.preferredHouseModelId);
        }
      })
      .catch(() => undefined);
  }, []);

  const startOver = useCallback(() => {
    setPhase("input");
    setSavedDesignId(null);
    setVersions([]);
    setActiveVersionId("");
    setTotalCost(0);
    setSketchPreviews([]);
    setDraft(null);
    setError(null);
    setBusy(false);
    setLastRefinePayload(null);
  }, []);

  const handleGenerate = useCallback(
    async (payload: {
      sourceMode: PromptMode;
      sketchUrls: string[];
      oldDesignUrls: string[];
      oldDesignUrl?: string;
      fabricUrl?: string;
      description: string;
      shirtColour: string;
      trouserColour: string;
      fabric: string;
      sketchPreviews: string[];
      houseModelId: HouseModelSelection;
      numCandidates?: number;
    }) => {
      setBusy(true);
      setBusyLabel("Generating…");
      setError(null);
      setSketchPreviews(payload.sketchPreviews);
      setSavedDesignId(null);
      try {
        try {
          const settingsParsed = await readJsonSafe<{
            fal: { generateModel: keyof typeof FAL_MODEL_OPTIONS };
          }>(await fetchSafe("/api/settings"));
          if (settingsParsed.ok && settingsParsed.data?.fal?.generateModel) {
            setModelName(
              FAL_MODEL_OPTIONS[settingsParsed.data.fal.generateModel]?.label ??
                "fal model",
            );
          } else {
            setModelName("fal model");
          }
        } catch {
          setModelName("fal model");
        }

        const res = await fetchSafe("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceMode: payload.sourceMode,
            sketchUrls: payload.sketchUrls,
            oldDesignUrls: payload.oldDesignUrls,
            oldDesignUrl: payload.oldDesignUrl ?? payload.oldDesignUrls[0],
            fabricUrl: payload.fabricUrl,
            description: payload.description,
            shirtColour: payload.shirtColour,
            trouserColour: payload.trouserColour,
            fabric: payload.fabric,
            houseModelId: payload.houseModelId,
            numCandidates: payload.numCandidates ?? 1,
          }),
        });
        const parsed = await readJsonSafe<{
          version: ApiVersion;
          totalCost: number;
          costUsd?: number;
          usdPkrRate?: number;
          promptMode?: PromptMode;
          houseModel?: { id: string; name: string };
          error?: string;
        }>(res);
        if (!parsed.ok || !parsed.data?.version) {
          throw new Error(parsed.error || "Generation failed.");
        }
        const data = parsed.data;
        const callCost = data.costUsd ?? data.version.costUsd ?? data.totalCost;

        setDraft({
          description: payload.description,
          shirtColour: payload.shirtColour,
          trouserColour: payload.trouserColour,
          fabric: payload.fabric,
          sketchUrls: payload.sketchUrls,
          oldDesignUrl: payload.oldDesignUrl ?? payload.oldDesignUrls[0],
          houseModelId: data.houseModel?.id ?? "ayesha",
          houseModelName: data.houseModel?.name ?? "Ayesha",
          promptMode: data.promptMode ?? payload.sourceMode,
        });
        setVersions([data.version]);
        setActiveVersionId(data.version.id);
        setTotalCost(data.totalCost);
        setSessionCost((s) => s + callCost);
        if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
        setCreditsRefresh((n) => n + 1);
        setPhase("result");
      } catch (err) {
        setError(networkErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleRefine = useCallback(
    async (payload: {
      feedback: string;
      shirtColour?: string;
      trouserColour?: string;
      fabric?: string;
      poseOnly?: boolean;
    }) => {
      const active = versions.find((v) => v.id === activeVersionId);
      if (!active || !draft) return;
      setLastRefinePayload(payload);
      setBusy(true);
      setBusyLabel(payload.poseOnly ? "Changing pose…" : "Refining…");
      setError(null);
      try {
        try {
          const settingsParsed = await readJsonSafe<{
            fal: { refineModel: keyof typeof FAL_MODEL_OPTIONS };
          }>(await fetchSafe("/api/settings"));
          if (settingsParsed.ok && settingsParsed.data?.fal?.refineModel) {
            setModelName(
              FAL_MODEL_OPTIONS[settingsParsed.data.fal.refineModel]?.label ??
                "fal model",
            );
          }
        } catch {
          /* keep previous label */
        }

        const nextShirt = payload.shirtColour ?? draft.shirtColour;
        const nextTrouser = payload.trouserColour ?? draft.trouserColour;
        const nextFabric = payload.fabric ?? draft.fabric;

        const res = await fetchSafe("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseImageUrl: active.imageUrl,
            sketchUrls: draft.sketchUrls,
            oldDesignUrl: draft.oldDesignUrl,
            parentVersionId: active.id,
            description: draft.description,
            shirtColour: nextShirt,
            trouserColour: nextTrouser,
            fabric: nextFabric,
            feedback: payload.feedback,
            previousTotalCost: totalCost,
            houseModelId: draft.houseModelId,
            promptMode: draft.promptMode,
            poseOnly: Boolean(payload.poseOnly),
          }),
        });
        const parsed = await readJsonSafe<{
          version: ApiVersion;
          totalCost: number;
          costUsd?: number;
          usdPkrRate?: number;
          error?: string;
        }>(res);
        if (!parsed.ok || !parsed.data?.version) {
          throw new Error(parsed.error || "Refine failed.");
        }
        const data = parsed.data;
        const callCost = data.costUsd ?? data.version.costUsd ?? 0;

        setDraft((d) =>
          d
            ? {
                ...d,
                shirtColour: nextShirt,
                trouserColour: nextTrouser,
                fabric: nextFabric,
              }
            : d,
        );
        setVersions((prev) => [...prev, data.version]);
        setActiveVersionId(data.version.id);
        setTotalCost(data.totalCost);
        setSessionCost((s) => s + callCost);
        if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
        setCreditsRefresh((n) => n + 1);
      } catch (err) {
        setError(networkErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [versions, activeVersionId, draft, totalCost],
  );

  const appendVersions = useCallback(
    (next: ApiVersion[], nextTotal: number) => {
      setVersions((prev) => [...prev, ...next]);
      if (next[0]) setActiveVersionId(next[next.length - 1]!.id);
      setTotalCost(nextTotal);
      const added = next.reduce((s, v) => s + (v.costUsd || 0), 0);
      setSessionCost((s) => s + added);
      setCreditsRefresh((n) => n + 1);
    },
    [],
  );

  const handleLockHeroAngles = useCallback(async () => {
    const active = versions.find((v) => v.id === activeVersionId);
    if (!active || !draft) return;
    setBusy(true);
    setBusyLabel("Deriving angles…");
    setError(null);
    try {
      const res = await fetchSafe("/api/catalog/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroImageUrl: active.imageUrl,
          parentVersionId: active.id,
          houseModelId: draft.houseModelId,
          description: draft.description,
          shirtColour: draft.shirtColour,
          trouserColour: draft.trouserColour,
          fabric: draft.fabric,
          previousTotalCost: totalCost,
        }),
      });
      const parsed = await readJsonSafe<{
        versions: ApiVersion[];
        totalCost: number;
        error?: string;
      }>(res);
      if (!parsed.ok || !parsed.data?.versions?.length) {
        throw new Error(parsed.error || "Angle set failed.");
      }
      appendVersions(parsed.data.versions, parsed.data.totalCost);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [versions, activeVersionId, draft, totalCost, appendVersions]);

  const handleColourways = useCallback(
    async (colours: string[]) => {
      const active = versions.find((v) => v.id === activeVersionId);
      if (!active || !draft || !colours.length) return;
      setBusy(true);
      setBusyLabel("Colourway batch…");
      setError(null);
      try {
        const res = await fetchSafe("/api/catalog/colourways", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heroImageUrl: active.imageUrl,
            parentVersionId: active.id,
            houseModelId: draft.houseModelId,
            description: draft.description,
            fabric: draft.fabric,
            colours,
            previousTotalCost: totalCost,
          }),
        });
        const parsed = await readJsonSafe<{
          versions: ApiVersion[];
          totalCost: number;
          error?: string;
        }>(res);
        if (!parsed.ok || !parsed.data?.versions?.length) {
          throw new Error(parsed.error || "Colourways failed.");
        }
        appendVersions(parsed.data.versions, parsed.data.totalCost);
      } catch (err) {
        setError(networkErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [versions, activeVersionId, draft, totalCost, appendVersions],
  );

  const handleFinishAction = useCallback(
    async (action: "upscale" | "fix-hands") => {
      const active = versions.find((v) => v.id === activeVersionId);
      if (!active || !draft) return;
      setBusy(true);
      setBusyLabel(action === "upscale" ? "Upscaling…" : "Fixing hands…");
      setError(null);
      try {
        const res = await fetchSafe("/api/catalog/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            baseImageUrl: active.imageUrl,
            parentVersionId: active.id,
            houseModelId: draft.houseModelId,
            description: draft.description,
            previousTotalCost: totalCost,
          }),
        });
        const parsed = await readJsonSafe<{
          version: ApiVersion;
          totalCost: number;
          costUsd?: number;
          error?: string;
        }>(res);
        if (!parsed.ok || !parsed.data?.version) {
          throw new Error(parsed.error || "Finish action failed.");
        }
        appendVersions([parsed.data.version], parsed.data.totalCost);
      } catch (err) {
        setError(networkErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [versions, activeVersionId, draft, totalCost, appendVersions],
  );

  const handleExportSet = useCallback(async () => {
    if (savedDesignId) {
      window.open(`/api/catalog/export?id=${savedDesignId}`, "_blank");
      return;
    }
    const res = await fetch("/api/catalog/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft?.description?.slice(0, 80),
        description: draft?.description,
        versions: versions.map((v) => ({
          imageUrl: v.imageUrl,
          feedback: v.feedback,
          parentVersionId: v.parentVersionId,
        })),
      }),
    });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-set.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [savedDesignId, draft, versions]);

  const handleHandoffAks = useCallback(async () => {
    setBusy(true);
    setBusyLabel("Handing off…");
    setError(null);
    try {
      const res = await fetchSafe("/api/catalog/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId: savedDesignId ?? undefined,
          title: draft?.description?.slice(0, 80),
          images: versions.map((v, i) => ({
            url: v.imageUrl,
            role: i === 0 ? "hero" : v.feedback || `v${i + 1}`,
            altText: `AI visualization — ${draft?.description?.slice(0, 60) || "garment"}`,
          })),
        }),
      });
      const parsed = await readJsonSafe<{
        ok?: boolean;
        dryRun?: boolean;
        error?: string;
        message?: string;
      }>(res);
      if (!parsed.ok) throw new Error(parsed.error || "Handoff failed.");
      setError(
        parsed.data?.dryRun
          ? parsed.data.message || "AKS dry-run OK (webhook not configured)."
          : "Handed off to AKS.",
      );
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [savedDesignId, draft, versions]);

  const handleSave = useCallback(async () => {
    if (!draft || !versions.length) return;
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designId: savedDesignId ?? undefined,
        description: draft.description,
        shirtColour: draft.shirtColour,
        trouserColour: draft.trouserColour,
        fabric: draft.fabric,
        sketchUrls: draft.sketchUrls,
        oldDesignUrl: draft.oldDesignUrl,
        personaJson: JSON.stringify({
          houseModelId: draft.houseModelId,
          houseModelName: draft.houseModelName,
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
    const data = (await res.json()) as { designId?: string; error?: string };
    if (!res.ok) throw new Error(data.error || "Save failed.");
    if (data.designId) setSavedDesignId(data.designId);
  }, [draft, versions, savedDesignId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f3efe8_0%,_#faf9f7_45%,_#f5f5f4_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 font-serif text-lg tracking-tight">
            Sketch → Photoreal
          </Link>
          <CreditsBar refreshKey={creditsRefresh} />
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {sessionCost > 0 && (
              <span
                className="hidden text-xs text-muted-foreground lg:inline"
                title={`Rate Rs ${usdPkrRate} / USD`}
              >
                session {formatPkr(usdToPkr(sessionCost, usdPkrRate))}
              </span>
            )}
            <Link
              href="/gallery"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
            >
              <Images className="size-4" />
              Gallery
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-4" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 sm:py-10">
        {phase === "input" && (
          <>
            <InputScreen
              disabled={busy}
              defaultHouseModelId={defaultHouseModelId}
              sessionCostPkr={
                sessionCost > 0 ? usdToPkr(sessionCost, usdPkrRate) : undefined
              }
              onGenerate={handleGenerate}
            />
            {busy && (
              <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted-foreground">
                Generating with {modelName || "fal"}… this can take a short while.
              </p>
            )}
            {error && (
              <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}

        {phase === "result" && (
          <ResultScreen
            designId={savedDesignId ?? "draft"}
            versions={versions}
            activeVersionId={activeVersionId}
            totalCost={totalCost}
            sessionCost={sessionCost}
            usdPkrRate={usdPkrRate}
            sketchPreviews={sketchPreviews}
            modelName={modelName}
            houseModelName={draft?.houseModelName}
            busy={busy}
            busyLabel={busyLabel}
            error={error}
            onSelectVersion={setActiveVersionId}
            onRefine={handleRefine}
            onSave={handleSave}
            onStartOver={startOver}
            onRetry={
              lastRefinePayload
                ? () => void handleRefine(lastRefinePayload)
                : undefined
            }
            onLockHeroAngles={handleLockHeroAngles}
            onColourways={handleColourways}
            onFixHands={() => handleFinishAction("fix-hands")}
            onUpscale={() => handleFinishAction("upscale")}
            onExportSet={handleExportSet}
            onHandoffAks={handleHandoffAks}
          />
        )}
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
