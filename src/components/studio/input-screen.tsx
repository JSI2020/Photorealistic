"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPkr } from "@/lib/currency";
import { readJsonSafe, fetchSafe } from "@/lib/http";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "@/lib/model-persona";
import {
  INPUT_SOURCE_TABS,
  type PromptMode,
} from "@/lib/prompt-builder";
import { cn } from "@/lib/utils";

export type UploadedAsset = {
  localPreview: string;
  url: string;
  lineArtUrl?: string;
  name: string;
  role?: string;
};

type InputScreenProps = {
  disabled?: boolean;
  defaultHouseModelId?: HouseModelSelection;
  sessionCostPkr?: number;
  onGenerate: (payload: {
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
  }) => Promise<void>;
};

async function uploadFiles(
  files: File[],
  kind: "sketch" | "old-design" | "fabric",
  role?: string,
): Promise<UploadedAsset[]> {
  const form = new FormData();
  form.set("kind", kind);
  if (role) form.set("role", role);
  for (const file of files) form.append("files", file);

  const res = await fetchSafe("/api/upload", { method: "POST", body: form });
  const parsed = await readJsonSafe<{
    files?: Array<{
      originalName: string;
      url: string;
      lineArtUrl?: string;
      role?: string;
    }>;
    error?: string;
  }>(res);
  if (!parsed.ok || !parsed.data?.files?.length) {
    throw new Error(parsed.error || "Upload failed.");
  }

  return parsed.data.files.map((f, i) => ({
    localPreview: URL.createObjectURL(files[i]!),
    url: f.url,
    lineArtUrl: f.lineArtUrl,
    name: f.originalName,
    role: f.role,
  }));
}

export function InputScreen({
  disabled,
  defaultHouseModelId = RANDOM_HOUSE_MODEL_ID,
  sessionCostPkr,
  onGenerate,
}: InputScreenProps) {
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const oldInputRef = useRef<HTMLInputElement>(null);
  const fabricInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<PromptMode>("sketch");
  const [sketches, setSketches] = useState<UploadedAsset[]>([]);
  const [oldDesigns, setOldDesigns] = useState<UploadedAsset[]>([]);
  const [fabricSwatch, setFabricSwatch] = useState<UploadedAsset | null>(null);
  const [description, setDescription] = useState("");
  const [shirtColour, setShirtColour] = useState("");
  const [trouserColour, setTrouserColour] = useState("");
  const [fabric, setFabric] = useState("");
  const [numCandidates, setNumCandidates] = useState(1);
  const [houseModelId, setHouseModelId] =
    useState<HouseModelSelection>(defaultHouseModelId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [duplicateId, setDuplicateId] = useState("");
  const [dupMsg, setDupMsg] = useState<string | null>(null);

  useEffect(() => {
    setHouseModelId(defaultHouseModelId);
  }, [defaultHouseModelId]);

  /** Option 3 requires a written description; colours/fabric stay optional. */
  const canGenerate =
    sourceMode === "sketch"
      ? sketches.length > 0
      : sourceMode === "old-design"
        ? oldDesigns.length > 0
        : Boolean(description.trim());

  const addSketches = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(list, "sketch");
      setSketches((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sketch upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const addOldDesigns = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(list, "old-design");
      setOldDesigns((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Old design upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const resetInputs = () => {
    sketches.forEach((s) => URL.revokeObjectURL(s.localPreview));
    oldDesigns.forEach((s) => URL.revokeObjectURL(s.localPreview));
    if (fabricSwatch) URL.revokeObjectURL(fabricSwatch.localPreview);
    setSketches([]);
    setOldDesigns([]);
    setFabricSwatch(null);
    setDescription("");
    setShirtColour("");
    setTrouserColour("");
    setFabric("");
    setNumCandidates(1);
    setError(null);
    setDupMsg(null);
  };

  const loadDuplicateBrief = async () => {
    const id = duplicateId.trim();
    if (!id) return;
    setDupMsg(null);
    try {
      const res = await fetch(`/api/designs?id=${encodeURIComponent(id)}`);
      const data = (await res.json()) as {
        description?: string | null;
        shirtColour?: string | null;
        trouserColour?: string | null;
        fabric?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Design not found");
      setDescription(data.description ?? "");
      setShirtColour(data.shirtColour ?? "");
      setTrouserColour(data.trouserColour ?? "");
      setFabric(data.fabric ?? "");
      setDupMsg("Brief copied — upload a new sketch/photo to generate.");
    } catch (err) {
      setDupMsg(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
          Sketch → Photoreal
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Pick one starting option below. Catalogue model is always used;
          description and colours are optional except on Description.
        </p>
        {sessionCostPkr != null && sessionCostPkr > 0 && (
          <p className="text-xs text-muted-foreground">
            Session total use: {formatPkr(sessionCostPkr)}
          </p>
        )}
      </header>

      <div
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/30 p-1"
        role="tablist"
        aria-label="How to start"
      >
        {INPUT_SOURCE_TABS.map((tab) => {
          const active = sourceMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => {
                setSourceMode(tab.id);
                setError(null);
              }}
              className={cn(
                "rounded-lg px-2 py-2.5 text-center transition",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block text-sm font-medium">{tab.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-snug sm:block">
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* —— Option 1: sketches —— */}
      {sourceMode === "sketch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Required:</strong>{" "}
            one or more sketches. Description, shirt/trouser colour and fabric
            are optional.
          </p>
          <div
            className={`rounded-xl border border-dashed px-4 py-10 text-center transition-colors ${
              dragOver
                ? "border-foreground/40 bg-muted/40"
                : "border-border bg-muted/20"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addSketches(e.dataTransfer.files);
            }}
          >
            <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-foreground">Drop sketches here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, WEBP — multiple files OK
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={disabled || uploading}
              onClick={() => sketchInputRef.current?.click()}
            >
              Choose sketches
            </Button>
            <input
              ref={sketchInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addSketches(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {sketches.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {sketches.map((s, i) => (
                <div key={`${s.url}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.localPreview}
                    alt={s.name}
                    className="size-24 rounded-md object-cover ring-1 ring-border"
                  />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                    aria-label="Remove sketch"
                    onClick={() => {
                      URL.revokeObjectURL(s.localPreview);
                      setSketches((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* —— Option 2: old design(s) —— */}
      {sourceMode === "old-design" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Required:</strong>{" "}
            one or more old design photos. Description, shirt/trouser colour and
            fabric are optional. The house model replaces the girl in the photo.
          </p>
          <div
            className={`rounded-xl border border-dashed px-4 py-10 text-center transition-colors ${
              dragOver
                ? "border-foreground/40 bg-muted/40"
                : "border-border bg-muted/20"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addOldDesigns(e.dataTransfer.files);
            }}
          >
            <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-foreground">Drop old design photos here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, WEBP — multiple files OK
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={disabled || uploading}
              onClick={() => oldInputRef.current?.click()}
            >
              Choose old designs
            </Button>
            <input
              ref={oldInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addOldDesigns(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {oldDesigns.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {oldDesigns.map((s, i) => (
                <div key={`${s.url}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.localPreview}
                    alt={s.name}
                    className="size-24 rounded-md object-cover ring-1 ring-border"
                  />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                    aria-label="Remove old design"
                    onClick={() => {
                      URL.revokeObjectURL(s.localPreview);
                      setOldDesigns((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      );
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* —— Option 3: description only —— */}
      {sourceMode === "description" && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Required:</strong>{" "}
            catalogue model + written description. Shirt/trouser colour and
            fabric are optional. No sketch or photo upload.
          </p>
        </div>
      )}

      {/* Shared: always catalogue model */}
      <div className="space-y-2">
        <Label htmlFor="house-model">Catalogue model *</Label>
        <select
          id="house-model"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={houseModelId}
          disabled={disabled}
          onChange={(e) =>
            setHouseModelId(e.target.value as HouseModelSelection)
          }
        >
          <option value={RANDOM_HOUSE_MODEL_ID}>
            Random each design (recommended)
          </option>
          {HOUSE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.cue}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Same model stays locked while you refine one design.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Description
          {sourceMode === "description" ? " *" : " (optional)"}
        </Label>
        <Textarea
          id="description"
          placeholder={
            sourceMode === "description"
              ? 'Required — e.g. "emerald lawn kameez with ivory palazzo, light gold embroidery on neckline"'
              : 'Optional — e.g. "make it festive, warmer lighting"'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={sourceMode === "description" ? 4 : 3}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="shirt">Shirt colour (optional)</Label>
          <Input
            id="shirt"
            placeholder="emerald"
            value={shirtColour}
            onChange={(e) => setShirtColour(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trouser">Trouser colour (optional)</Label>
          <Input
            id="trouser"
            placeholder="ivory"
            value={trouserColour}
            onChange={(e) => setTrouserColour(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fabric">Fabric (optional)</Label>
          <Input
            id="fabric"
            placeholder="lawn"
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fabric swatch photo (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Real cloth photo used as colour/texture reference.
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => fabricInputRef.current?.click()}
            >
              Upload swatch
            </Button>
            <input
              ref={fabricInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void (async () => {
                  setUploading(true);
                  try {
                    const [uploaded] = await uploadFiles(
                      [file],
                      "fabric",
                      "fabric",
                    );
                    if (fabricSwatch) {
                      URL.revokeObjectURL(fabricSwatch.localPreview);
                    }
                    setFabricSwatch(uploaded ?? null);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Fabric upload failed",
                    );
                  } finally {
                    setUploading(false);
                  }
                })();
              }}
            />
            {fabricSwatch && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fabricSwatch.localPreview}
                  alt="Fabric swatch"
                  className="size-12 rounded object-cover ring-1 ring-border"
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                  aria-label="Remove swatch"
                  onClick={() => {
                    URL.revokeObjectURL(fabricSwatch.localPreview);
                    setFabricSwatch(null);
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="candidates">First-pass candidates</Label>
          <select
            id="candidates"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={numCandidates}
            disabled={disabled}
            onChange={(e) => setNumCandidates(Number(e.target.value))}
          >
            <option value={1}>1 image (cheaper)</option>
            <option value={2}>2 candidates — pick best</option>
            <option value={3}>3 candidates — pick best</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <Label htmlFor="dup">Duplicate brief from saved design</Label>
        <div className="flex gap-2">
          <Input
            id="dup"
            placeholder="Paste design id from gallery URL"
            value={duplicateId}
            onChange={(e) => setDuplicateId(e.target.value)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !duplicateId.trim()}
            onClick={() => void loadDuplicateBrief()}
          >
            Load
          </Button>
        </div>
        {dupMsg && (
          <p className="text-xs text-muted-foreground">{dupMsg}</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          disabled={!canGenerate || disabled || uploading}
          onClick={() => {
            const oldUrls =
              sourceMode === "old-design" ? oldDesigns.map((s) => s.url) : [];
            const sketchUrls =
              sourceMode === "sketch"
                ? sketches.flatMap((s) =>
                    s.lineArtUrl ? [s.url, s.lineArtUrl] : [s.url],
                  )
                : [];
            void onGenerate({
              sourceMode,
              sketchUrls,
              oldDesignUrls: oldUrls,
              oldDesignUrl: oldUrls[0],
              fabricUrl: fabricSwatch?.url,
              description,
              shirtColour,
              trouserColour,
              fabric,
              sketchPreviews:
                sourceMode === "sketch"
                  ? sketches.map((s) => s.localPreview)
                  : sourceMode === "old-design"
                    ? oldDesigns.map((s) => s.localPreview)
                    : [],
              houseModelId,
              numCandidates,
            });
          }}
        >
          {uploading ? "Uploading…" : "Generate"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={resetInputs}
        >
          Clear
        </Button>
      </div>
    </section>
  );
}
