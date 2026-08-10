"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FAL_MODEL_OPTIONS, type FalModelKey } from "@/lib/fal-config";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
} from "@/lib/model-persona";
import type { AppSettings } from "@/lib/settings";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const MODEL_KEYS = Object.keys(FAL_MODEL_OPTIONS) as FalModelKey[];

function SpendDashboard() {
  const [data, setData] = useState<{
    spend?: {
      monthSpendUsd: number;
      monthlySpendCapUsd: number | null;
      monthKey: string;
    };
    byModel?: Record<string, { count: number; costUsd: number }>;
    approvedImagesThisMonth?: number;
    costPerApprovedUsd?: number | null;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/spend")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data?.spend) {
    return (
      <p className="text-xs text-muted-foreground">Loading spend…</p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <Label>Spend this month ({data.spend.monthKey})</Label>
      <p className="text-sm">
        ${data.spend.monthSpendUsd.toFixed(2)}
        {data.spend.monthlySpendCapUsd != null
          ? ` / $${data.spend.monthlySpendCapUsd.toFixed(0)} cap`
          : " (no cap)"}
      </p>
      <p className="text-xs text-muted-foreground">
        Approved images: {data.approvedImagesThisMonth ?? 0}
        {data.costPerApprovedUsd != null
          ? ` · ~$${data.costPerApprovedUsd}/image`
          : ""}
      </p>
      {data.byModel && Object.keys(data.byModel).length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {Object.entries(data.byModel).map(([model, v]) => (
            <li key={model}>
              {model}: {v.count} · ${v.costUsd.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    void fetch("/api/settings")
      .then(async (r) => {
        const data = (await r.json()) as AppSettings & { error?: string };
        if (!r.ok) {
          throw new Error(data.error || `Settings failed (${r.status})`);
        }
        setSettings(data);
      })
      .catch((err: unknown) => {
        setMessage(
          err instanceof Error ? err.message : "Failed to load settings.",
        );
      });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-serif text-xl">Settings</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {!settings ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="house-default">Default catalogue model</Label>
                <select
                  id="house-default"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.preferredHouseModelId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      preferredHouseModelId: e.target.value,
                    })
                  }
                >
                  <option value={RANDOM_HOUSE_MODEL_ID}>
                    Random each new design
                  </option>
                  {HOUSE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.cue}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  You can still override per design on the input screen. Refine
                  keeps the same model for that design.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="lock-seed">Lock seed</Label>
                  <p className="text-xs text-muted-foreground">
                    Locked = consistent face within a design
                  </p>
                </div>
                <Switch
                  id="lock-seed"
                  checked={settings.persona.lockSeed}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      persona: { ...settings.persona, lockSeed: checked },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gen-model">Generation model</Label>
                <select
                  id="gen-model"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.fal.generateModel}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      fal: {
                        ...settings.fal,
                        generateModel: e.target.value as FalModelKey,
                      },
                    })
                  }
                >
                  {MODEL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FAL_MODEL_OPTIONS[key].label} (~$
                      {FAL_MODEL_OPTIONS[key].estimatedCostUsd.toFixed(3)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ref-model">Refinement model</Label>
                <select
                  id="ref-model"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.fal.refineModel}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      fal: {
                        ...settings.fal,
                        refineModel: e.target.value as FalModelKey,
                      },
                    })
                  }
                >
                  {MODEL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {FAL_MODEL_OPTIONS[key].label} (~$
                      {FAL_MODEL_OPTIONS[key].estimatedCostUsd.toFixed(3)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="spend-cap">Monthly spend cap (USD)</Label>
                <Input
                  id="spend-cap"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="unlimited"
                  value={settings.monthlySpendCapUsd ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      monthlySpendCapUsd: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Hard stop before generate/refine when month spend would exceed
                  this. Leave empty for unlimited.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="design-ceiling">
                  Per-design cost warning (USD)
                </Label>
                <Input
                  id="design-ceiling"
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="optional"
                  value={settings.perDesignCostCeilingUsd ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      perDesignCostCeilingUsd: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Refine strengths</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["poseOnly", "Pose-only"],
                      ["refineSketch", "Refine sketch"],
                      ["refineDefault", "Refine default"],
                      ["backgroundSketch", "BG sketch"],
                      ["backgroundDefault", "BG default"],
                      ["oldDesignGenerate", "Old design gen"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`str-${key}`} className="text-xs">
                        {label}
                      </Label>
                      <Input
                        id={`str-${key}`}
                        type="number"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={settings.strengths[key]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            strengths: {
                              ...settings.strengths,
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <SpendDashboard />
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          {message && (
            <p className="mb-2 text-xs text-muted-foreground">{message}</p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!settings || saving}
            onClick={() => {
              if (!settings) return;
              setSaving(true);
              setMessage(null);
              void fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
              })
                .then(async (res) => {
                  if (!res.ok) {
                    const data = (await res.json()) as { error?: string };
                    throw new Error(data.error || "Save failed");
                  }
                  setMessage("Saved — next generation will use these settings.");
                })
                .catch((err: unknown) => {
                  setMessage(
                    err instanceof Error ? err.message : "Failed to save.",
                  );
                })
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
