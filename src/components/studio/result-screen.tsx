"use client";

import { Download, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPkr, usdToPkr } from "@/lib/currency";
import { POSE_PRESETS } from "@/lib/prompt-builder";

export type StudioVersion = {
  id: string;
  imageUrl: string;
  feedback?: string | null;
  costUsd: number;
  modelId: string;
  createdAt?: string | Date;
  parentVersionId?: string | null;
  aiGenerated?: boolean;
  altText?: string | null;
};

const QUICK_CHIPS = [
  "Change shirt colour",
  "Change trouser colour",
  "Change fabric",
  "More embroidery",
  "Less embroidery",
  "Warmer lighting",
  "Real outdoor courtyard background",
  "Marble foyer background",
  "Garden path background",
  "Clearer fabric texture",
] as const;

type ResultScreenProps = {
  designId: string;
  versions: StudioVersion[];
  activeVersionId: string;
  totalCost: number;
  sessionCost?: number;
  usdPkrRate?: number;
  sketchPreviews: string[];
  modelName?: string;
  houseModelName?: string;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  perDesignCeilingUsd?: number | null;
  onSelectVersion: (id: string) => void;
  onRefine: (payload: {
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
    poseOnly?: boolean;
  }) => Promise<void>;
  onSave: () => Promise<void>;
  onStartOver: () => void;
  onRetry?: () => void;
  onLockHeroAngles?: () => Promise<void>;
  onColourways?: (colours: string[]) => Promise<void>;
  onFixHands?: () => Promise<void>;
  onUpscale?: () => Promise<void>;
  onExportSet?: () => Promise<void>;
  onHandoffAks?: () => Promise<void>;
};

function VersionTree({
  versions,
  activeId,
  onSelect,
}: {
  versions: StudioVersion[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 text-xs">
      <p className="font-medium text-foreground">Version history</p>
      <ul className="space-y-1">
        {versions.map((v, i) => {
          const parentIdx = v.parentVersionId
            ? versions.findIndex((p) => p.id === v.parentVersionId)
            : -1;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className={`w-full rounded px-2 py-1 text-left transition hover:bg-background ${
                  v.id === activeId ? "bg-background ring-1 ring-border" : ""
                }`}
              >
                <span className="text-muted-foreground">
                  {parentIdx >= 0 ? `↳ from v${parentIdx + 1} · ` : ""}
                </span>
                v{i + 1}
                {v.feedback ? ` — ${v.feedback.slice(0, 48)}` : " — hero"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ResultScreen({
  designId,
  versions,
  activeVersionId,
  totalCost,
  sessionCost = 0,
  usdPkrRate = 278,
  sketchPreviews,
  modelName,
  houseModelName,
  busy,
  busyLabel,
  error,
  perDesignCeilingUsd,
  onSelectVersion,
  onRefine,
  onSave,
  onStartOver,
  onRetry,
  onLockHeroAngles,
  onColourways,
  onFixHands,
  onUpscale,
  onExportSet,
  onHandoffAks,
}: ResultScreenProps) {
  const [feedback, setFeedback] = useState("");
  const [shirtColour, setShirtColour] = useState("");
  const [trouserColour, setTrouserColour] = useState("");
  const [fabric, setFabric] = useState("");
  const [compare, setCompare] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [colourInput, setColourInput] = useState("deep maroon, ivory, sage");

  const active = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? versions.at(-1),
    [versions, activeVersionId],
  );

  if (!active) return null;

  const designPkr = usdToPkr(totalCost, usdPkrRate);
  const sessionPkr = usdToPkr(sessionCost, usdPkrRate);
  const lastCallPkr = usdToPkr(active.costUsd || 0, usdPkrRate);
  const overDesignCeiling =
    perDesignCeilingUsd != null && totalCost >= perDesignCeilingUsd;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {designId === "draft" ? "Unsaved draft" : `Design ${designId.slice(0, 8)}`}
          </p>
          <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
            Result
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            this design: {formatPkr(designPkr)} · {versions.length} version
            {versions.length === 1 ? "" : "s"}
            {houseModelName ? ` · model ${houseModelName}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            last call: {formatPkr(lastCallPkr)}
            {sessionCost > 0
              ? ` · session total: ${formatPkr(sessionPkr)}`
              : ""}
            {" · "}
            rate Rs {usdPkrRate}/USD
          </p>
          {overDesignCeiling && (
            <p className="mt-1 text-xs text-amber-700">
              Per-design cost ceiling reached (${totalCost.toFixed(2)} / $
              {perDesignCeilingUsd!.toFixed(2)}).
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompare((c) => !c)}
          >
            {compare ? "Hide compare" : "Compare sketch"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onStartOver}
          >
            <RotateCcw className="size-4" />
            Start over
          </Button>
        </div>
      </div>

      <div
        className={`grid gap-4 ${compare && sketchPreviews[0] ? "md:grid-cols-2" : ""}`}
      >
        {compare && sketchPreviews[0] && (
          <div className="overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border">
            <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
              Original sketch
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sketchPreviews[0]}
              alt="Original sketch"
              className="mx-auto max-h-[70vh] w-full object-contain"
            />
          </div>
        )}
        <div className="relative overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border">
          <span className="absolute left-2 top-2 z-10 rounded bg-background/90 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-border">
            AI visualization
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.imageUrl}
            alt={
              active.altText ||
              "AI visualization of garment — not a real product photograph"
            }
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="px-4 text-center">
                <p className="text-sm font-medium text-foreground">
                  {busyLabel || "Generating…"}
                </p>
                {modelName && (
                  <p className="mt-1 text-xs text-muted-foreground">{modelName}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {versions.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectVersion(v.id)}
              className={`shrink-0 overflow-hidden rounded-md ring-2 transition ${
                v.id === active.id
                  ? "ring-foreground"
                  : "ring-transparent opacity-80 hover:opacity-100"
              }`}
              title={v.feedback || `Version ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.imageUrl}
                alt={`Version ${i + 1}`}
                className="h-20 w-14 object-cover"
              />
            </button>
          ))}
        </div>
        <VersionTree
          versions={versions}
          activeId={active.id}
          onSelect={onSelectVersion}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
        <Label>Catalog tools</Label>
        <p className="text-xs text-muted-foreground">
          Lock the active image as hero, then derive angles or colourways for a
          storefront set.
        </p>
        <div className="flex flex-wrap gap-2">
          {onLockHeroAngles && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onLockHeroAngles()}
            >
              Lock hero → angles
            </Button>
          )}
          {onFixHands && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onFixHands()}
            >
              Fix hands / detail
            </Button>
          )}
          {onUpscale && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onUpscale()}
            >
              Upscale final
            </Button>
          )}
          {onExportSet && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onExportSet()}
            >
              Export set JSON
            </Button>
          )}
          {onHandoffAks && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onHandoffAks()}
            >
              Handoff to AKS
            </Button>
          )}
        </div>
        {onColourways && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label htmlFor="colourways">Colourways (comma-separated)</Label>
              <Input
                id="colourways"
                value={colourInput}
                onChange={(e) => setColourInput(e.target.value)}
                disabled={busy}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                void onColourways(
                  colourInput
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                )
              }
            >
              Batch colourways
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="feedback">Feedback</Label>
          <Textarea
            id="feedback"
            placeholder='e.g. "make the shirt deep red and add embroidery"'
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
              onClick={() =>
                setFeedback((prev) =>
                  prev ? `${prev}; ${chip.toLowerCase()}` : chip,
                )
              }
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Pose / angle</Label>
          <p className="text-xs text-muted-foreground">
            Changes pose only — dress colour/design and model face stay locked.
          </p>
          <div className="flex flex-wrap gap-2">
            {POSE_PRESETS.map((pose) => (
              <Button
                key={pose.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void onRefine({ feedback: pose.feedback, poseOnly: true })
                }
              >
                {pose.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-shirt">Shirt colour</Label>
            <Input
              id="r-shirt"
              value={shirtColour}
              onChange={(e) => setShirtColour(e.target.value)}
              disabled={busy}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-trouser">Trouser colour</Label>
            <Input
              id="r-trouser"
              value={trouserColour}
              onChange={(e) => setTrouserColour(e.target.value)}
              disabled={busy}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-fabric">Fabric</Label>
            <Input
              id="r-fabric"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              disabled={busy}
              placeholder="optional"
            />
          </div>
        </div>

        {error && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
            <span role="alert">{error}</span>
            {onRetry && (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              busy ||
              (!feedback.trim() && !shirtColour && !trouserColour && !fabric)
            }
            onClick={() =>
              void onRefine({
                feedback: feedback.trim(),
                shirtColour: shirtColour || undefined,
                trouserColour: trouserColour || undefined,
                fabric: fabric || undefined,
              }).then(() => setFeedback(""))
            }
          >
            Refine
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              const a = document.createElement("a");
              a.href = active.imageUrl;
              a.download = `photoreal-${active.id.slice(0, 8)}.png`;
              a.target = "_blank";
              a.rel = "noopener";
              a.click();
            }}
          >
            <Download className="size-4" />
            Download
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void onSave().then(() => {
                setSavedMsg("Saved to gallery");
                setTimeout(() => setSavedMsg(null), 2500);
              })
            }
          >
            <Save className="size-4" />
            Save
          </Button>
          {savedMsg && (
            <span className="self-center text-xs text-muted-foreground">
              {savedMsg}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
