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
  /** Running session total across designs (USD). */
  sessionCost?: number;
  usdPkrRate?: number;
  sketchPreviews: string[];
  modelName?: string;
  houseModelName?: string;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onSelectVersion: (id: string) => void;
  onRefine: (payload: {
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  }) => Promise<void>;
  onSave: () => Promise<void>;
  onStartOver: () => void;
  onRetry?: () => void;
};

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
  onSelectVersion,
  onRefine,
  onSave,
  onStartOver,
  onRetry,
}: ResultScreenProps) {
  const [feedback, setFeedback] = useState("");
  const [shirtColour, setShirtColour] = useState("");
  const [trouserColour, setTrouserColour] = useState("");
  const [fabric, setFabric] = useState("");
  const [compare, setCompare] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const active = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? versions.at(-1),
    [versions, activeVersionId],
  );

  if (!active) return null;

  const designPkr = usdToPkr(totalCost, usdPkrRate);
  const sessionPkr = usdToPkr(sessionCost, usdPkrRate);
  const lastCallPkr = usdToPkr(active.costUsd || 0, usdPkrRate);

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.imageUrl}
            alt="Generated result"
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
                setFeedback((prev) => (prev ? `${prev}; ${chip.toLowerCase()}` : chip))
              }
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Pose / angle</Label>
          <p className="text-xs text-muted-foreground">
            Runs a refine with a new real fashion-photography stance (same dress +
            house model).
          </p>
          <div className="flex flex-wrap gap-2">
            {POSE_PRESETS.map((pose) => (
              <Button
                key={pose.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void onRefine({ feedback: pose.feedback })}
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
            disabled={busy || (!feedback.trim() && !shirtColour && !trouserColour && !fabric)}
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
