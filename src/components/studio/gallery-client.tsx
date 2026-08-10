"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { CreditsBar } from "@/components/studio/credits-bar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GalleryItem = {
  id: string;
  title: string | null;
  description: string | null;
  totalCost: number;
  totalCostPkr?: number;
  versionCount: number;
  coverUrl: string | null;
  updatedAt: string;
};

export function GalleryClient() {
  const [designs, setDesigns] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/designs")
      .then(async (res) => {
        const data = (await res.json()) as {
          designs?: GalleryItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed to load gallery.");
        setDesigns(data.designs ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load gallery.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f3efe8_0%,_#faf9f7_45%,_#f5f5f4_100%)]">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-4" />
            Studio
          </Link>
          <CreditsBar />
          <h1 className="font-serif text-lg">Gallery</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading saved designs…</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && designs.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-serif text-2xl">No saved designs yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Generate a look, then hit Save on the result screen.
            </p>
            <Link href="/" className={cn(buttonVariants(), "mt-6 inline-flex")}>
              Start a design
            </Link>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <Link
              key={d.id}
              href={`/design/${d.id}`}
              className="group overflow-hidden rounded-xl ring-1 ring-border transition hover:ring-foreground/30"
            >
              <div className="aspect-[3/4] bg-muted/40">
                {d.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.coverUrl}
                    alt={d.title || "Design"}
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-1 bg-background/80 px-3 py-3">
                <p className="truncate text-sm font-medium">
                  {d.title || "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.versionCount} version{d.versionCount === 1 ? "" : "s"} ·{" "}
                  {new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: "PKR",
                    maximumFractionDigits: 0,
                  }).format(
                    d.totalCostPkr ?? Number(d.totalCost) * 278,
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
