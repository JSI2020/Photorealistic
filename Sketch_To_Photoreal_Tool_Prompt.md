# SKETCH → PHOTOREAL — STANDALONE TOOL
### Build prompt for Cursor · fal.ai

> **What this is:** a focused tool that turns a fashion sketch (or several sketches, or an old design photo) into a photorealistic image of the garment on a model, then lets the user refine it through feedback — colour, style, combination, fabric — as many rounds as they want.
>
> **This is NOT the full store.** No cart, no orders, no sizing engine. One job: sketch in → photoreal out → iterate.
>
> **Method:** build one step at a time in a fresh Cursor chat. Verify each step's exit criterion before the next. Do not build ahead.

---

# PART 0 — THE CORE IDEA (read first)

The whole tool is one loop:

```
INPUT (sketch(es) + optional old design + description)
   → GENERATE first image
   → user gives feedback (colour / style / fabric / combination)
   → REGENERATE with that feedback
   → repeat until happy
   → download / save
```

Two principles that make it work:

1. **The sketch is the structural anchor, the text is the finisher.** The image is fed to the model as a reference; the description only adjusts colour, fabric, mood — never invents the garment from scratch.
2. **Iteration keeps identity stable.** Each refinement builds on the previous result (same model, same garment) — it doesn't start over. This is what stops the model's face and the garment shape from changing every round.

---

# PART 1 — STACK & SETUP

**Prompt:**
> Create a Next.js 15 project (App Router, TypeScript strict, Tailwind v4, shadcn/ui). Install `@fal-ai/client` and `sharp`. Set up a Postgres database with Drizzle (or SQLite via Drizzle if simpler for a single-user tool). Store `FAL_KEY` in `.env.local`, never committed. Add `.env.example`.
>
> No authentication needed for v1 — this is a personal tool. (If you want it protected later, add a single-password gate, not full auth.)

**Exit:** `npm run dev` serves a blank page; `FAL_KEY` loads from env.

---

# PART 2 — THE MODEL PERSONA (define once, reuse everywhere)

The model must look the same in every generation, or iteration is pointless. So the model is an **authored, reusable description**, not re-invented each time.

**Prompt:**
> Create a single reusable model-persona configuration in `/lib/model-persona.ts`. It holds a fixed text description of the house model and a fixed seed for consistency.
>
> Default persona description:
> "A young South Asian / Pakistani female fashion model, fair-to-wheatish complexion, striking and elegant features, dark hair, refined and graceful, natural realistic proportions, calm confident expression, modest and poised posture."
>
> Make this editable in the UI later (Part 7) but keep one default. Store a fixed `seed` value alongside it so the same face recurs across generations.

**Exit:** the persona string and seed are importable and used by the prompt builder.

> **Note on the brief:** keep the model description tasteful and professional — an elegant, realistic fashion model. Avoid objectifying phrasing; the goal is a consistent, dignified catalogue model. A fixed seed plus a clear description gives you consistency without needing anything cruder.

---

# PART 3 — THE PROMPT BUILDER

**Prompt:**
> Create a prompt builder in `/lib/prompt-builder.ts` that assembles the final fal prompt from parts. Fixed scaffolding (never varied):
> - "Photorealistic fashion e-commerce photograph. Reproduce the garment exactly as shown in the attached sketch — same silhouette, neckline, sleeves, hem, and any embroidery or detail, in the same positions. Do not redesign or omit anything."
> - The model persona from Part 2.
> - "Clean studio, seamless soft neutral background, soft diffused daylight, gentle shadows. Full-length shot, model centred, 85mm lens look, sharp focus on the garment, true-to-life fabric texture and drape."
> - "High-end modest fashion catalogue photography, realistic, not illustrated or stylised."
> - Negative prompt: "no text, no logo, no altered neckline or hem, no distorted embroidery, no oversaturation, no extra garments, deformed hands, extra limbs."
>
> Variable parts merged in: user description, shirt colour + fabric, trouser colour + fabric, any feedback modifications.
>
> Return `{ prompt, negativePrompt, seed }`.

**Exit:** given sample inputs, it returns a complete, readable prompt string you can inspect.

---

# PART 4 — THE FAL ADAPTER

**Prompt:**
> Create `/lib/fal.ts` wrapping the fal client. Two functions:
> - `generateFromSketch({ sketchUrls, prompt, negativePrompt, seed })` — image-to-image / structural conditioning, sketch as the reference input.
> - `refineImage({ baseImageUrl, prompt, negativePrompt, seed })` — takes the previous result as the reference so refinements build on it.
>
> **Look up the current fal model IDs in the fal dashboard — do not invent them.** For sketch-to-photo use a model strong at reference-image consistency (Nano Banana / Flux class). For refinement use an image-to-image / edit-capable model. Put the model IDs in a config object so they can be swapped without code changes.
>
> Each call returns the output image URL, the seed used, and the cost. Handle errors gracefully — return a clear message, never a silent failure. Wrap the calls so a failed generation doesn't crash the UI.

**Exit:** a test script generates one image from a sample sketch and prints the output URL and cost.

> **Verify at build time:** fal model IDs, their exact input parameter names, and per-image prices — all from the current fal docs. These change; do not trust hardcoded guesses.

---

# PART 5 — INPUT SCREEN

**Prompt:**
> Build the input screen. It accepts:
> 1. **One or more sketches** — drag-and-drop or file picker, multiple files, image preview thumbnails.
> 2. **An optional "old design" image** — an existing photo to improve or reinterpret.
> 3. **A description** — a free-text box for style, garment type, occasion, or any instruction.
> 4. **Optional quick fields** — shirt colour, trouser colour, fabric (simple text inputs or dropdowns), so common choices don't need to be typed into the description.
>
> On upload, preprocess each sketch with `sharp`: auto-crop, boost contrast, and (if the model benefits) produce a clean line version. Upload images to fal's storage or your own and keep the URLs.
>
> A single **"Generate"** button. Disable it until at least one sketch (or an old-design image) is present.

**Exit:** you upload a sketch, type "red kameez, ivory palazzo, lawn fabric", and clicking Generate calls the adapter.

---

# PART 6 — RESULT & ITERATION LOOP ⭐ (the heart of the tool)

**Prompt:**
> Build the result screen — this is the core feature.
>
> After the first generation, show the image large. Below it, a **feedback box** and quick controls so the user can request changes:
> - A free-text feedback field: "make the shirt emerald green", "add gold embroidery on the sleeves", "looser trousers", "warmer lighting".
> - Optional quick chips for common edits: change shirt colour, change trouser colour, change fabric, more/less embroidery.
> - A **"Refine"** button that regenerates using the *current image* as the base (via `refineImage`), applying the feedback — so the model and garment stay consistent and only the requested thing changes.
>
> Keep a **history strip** of every version below the main image. The user can click any past version to return to it and branch from there. Nothing is lost.
>
> The user can refine **as many times as they want**. Each refine is a new entry in the history.
>
> Show a small running cost total ("this design: $0.42 · 6 versions").
>
> Two final actions: **Download** the current image, and **Save** it to a gallery (Part 8).

**Exit:** you generate an image, type "make the shirt deep red and add embroidery", click Refine, and the new image keeps the same model and garment shape while applying the change. The history strip shows both versions.

---

# PART 7 — SETTINGS (light)

**Prompt:**
> Add a small settings panel:
> - Edit the model persona description and toggle whether to lock the seed (locked = consistent face; unlocked = more variety).
> - Choose the generation model and the refinement model from the configured options.
> - Set a soft monthly spend reminder (optional).
>
> Keep it minimal — this is a personal tool, not a product.

**Exit:** changing the persona description changes the model in the next generation.

---

# PART 8 — GALLERY & PERSISTENCE

**Prompt:**
> Persist every design and its version history to the database: the input sketches, the description, each generated image URL, the prompt and seed used, and the cost. Build a simple gallery page showing saved designs as a grid; clicking one reopens it with its full version history so the user can keep refining later.
>
> Each generation record stores enough to reproduce it: prompt, seed, model ID, input image URLs.

**Exit:** you close the browser, reopen the gallery, click a saved design, and its full version history is intact and refinable.

---

# PART 9 — POLISH

**Prompt:**
> - Loading states: show a clear "generating…" indicator with the model name; never a frozen screen.
> - Handle fal failures with a friendly retry.
> - Make the whole tool responsive and usable on mobile.
> - Add a simple side-by-side compare view (original sketch next to the current result).
> - Add a "start over" that clears inputs for a new design.

**Exit:** the tool works smoothly on a phone, recovers from a failed generation, and shows the sketch beside the result.

---

# BUILD ORDER SUMMARY

| Step | Delivers |
|---|---|
| 1 | Project + fal connected |
| 2 | Reusable model persona |
| 3 | Prompt builder |
| 4 | fal adapter (generate + refine) |
| 5 | Input screen |
| 6 | ⭐ Result + iteration loop |
| 7 | Settings |
| 8 | Gallery + persistence |
| 9 | Polish |

**Overall exit:** upload a sketch, add a description, generate a photorealistic image of the garment on a consistent Pakistani model, then refine it through feedback — colour, fabric, embroidery, style — over as many rounds as you like, with every version saved and reopenable.

---

# NOTES

- **Verify at build time:** current fal model IDs, input parameter names, and prices — from the fal dashboard, not from this document. They change monthly.
- **Consistency depends on the seed + the reference image.** Refinement must pass the previous result as the reference, or the model and garment will drift each round — that would defeat the tool.
- **The sketch always leads.** If text and sketch conflict, the sketch wins on structure; text only governs colour, fabric, and finish.
- Embroidery and fine detail are the hardest thing for the model to reproduce faithfully — expect a couple of refine rounds on ornate designs, which is exactly what the iteration loop is for.
- Keep the model brief tasteful and professional: an elegant, realistic catalogue model. A fixed seed plus a clear description gives consistency without anything cruder.
