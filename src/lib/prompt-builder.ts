import {
  getModelPersona,
  resolvePersonaSeed,
  type ModelPersona,
} from "@/lib/model-persona";

/** Sketch mode — structure from line art; do not redesign the cut. */
const SKETCH_ANCHOR =
  "Photorealistic fashion e-commerce photograph. Reproduce the garment exactly as shown in the attached sketch — same silhouette, neckline, sleeves, hem, and any embroidery or detail, in the same positions. Do not redesign or omit anything.";

/**
 * Old-design / photo restyle — keep the garment idea, replace the person,
 * and allow a clearer catalogue upgrade on the first pass.
 */
const OLD_DESIGN_ANCHOR =
  "Photorealistic fashion e-commerce photograph. The attached image is an OLD DESIGN PHOTO for garment inspiration only. Recreate the outfit as a fresh catalogue shot: keep the garment type, silhouette, and key details, but improve fabric realism, colour richness, fit, and studio presentation. CRITICAL: do NOT keep the original person, face, body, hair, skin tone, or identity from the photo — completely replace them with the house model described below. New pose and framing for a full-length modest catalogue look is required.";

const STUDIO =
  "Clean studio, seamless soft neutral background, soft diffused daylight, gentle shadows. Full-length shot, model centred, 85mm lens look, sharp focus on the garment, true-to-life fabric texture and drape.";

const STYLE =
  "High-end modest fashion catalogue photography, realistic, not illustrated or stylised.";

export const DEFAULT_NEGATIVE_PROMPT =
  "no text, no logo, no altered neckline or hem, no distorted embroidery, no oversaturation, no extra garments, deformed hands, extra limbs.";

export const OLD_DESIGN_NEGATIVE_PROMPT =
  "same face as reference photo, original model identity, photocopy of input, identical pose to reference, watermark, text, logo, deformed hands, extra limbs, illustrated, cartoon.";

export type PromptMode = "sketch" | "old-design";

export type PromptBuilderInput = {
  /** Free-text style / garment / occasion instruction. */
  description?: string;
  shirtColour?: string;
  shirtFabric?: string;
  trouserColour?: string;
  trouserFabric?: string;
  /** Shared fabric when shirt/trouser fabric are not split. */
  fabric?: string;
  /** Iteration feedback applied on refine rounds. */
  feedback?: string;
  /** Persona override (Settings / Part 7). */
  persona?: Partial<ModelPersona>;
  /**
   * sketch = line-art fidelity (default).
   * old-design = photo restyle: new house model + tasteful upgrade.
   */
  mode?: PromptMode;
};

export type BuiltPrompt = {
  prompt: string;
  negativePrompt: string;
  seed: number | undefined;
  mode: PromptMode;
};

function trimOrEmpty(value?: string): string {
  return value?.trim() ?? "";
}

function joinNonEmpty(parts: string[], separator = " "): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(separator);
}

function buildGarmentNotes(input: PromptBuilderInput): string {
  const fabricFallback = trimOrEmpty(input.fabric);
  const shirtColour = trimOrEmpty(input.shirtColour);
  const shirtFabric = trimOrEmpty(input.shirtFabric) || fabricFallback;
  const trouserColour = trimOrEmpty(input.trouserColour);
  const trouserFabric = trimOrEmpty(input.trouserFabric) || fabricFallback;

  const notes: string[] = [];

  if (shirtColour || shirtFabric) {
    notes.push(
      `${joinNonEmpty([
        "Shirt/kameez:",
        shirtColour && `${shirtColour} colour`,
        shirtFabric && `${shirtFabric} fabric`,
      ])}.`,
    );
  }

  if (trouserColour || trouserFabric) {
    notes.push(
      `${joinNonEmpty([
        "Trousers/shalwar:",
        trouserColour && `${trouserColour} colour`,
        trouserFabric && `${trouserFabric} fabric`,
      ])}.`,
    );
  }

  if (!notes.length && fabricFallback) {
    notes.push(`Fabric: ${fabricFallback}.`);
  }

  return notes.join(" ");
}

/**
 * Assembles the fal prompt.
 * Sketch mode: structure wins. Old-design mode: garment idea + new house model.
 */
export function buildPrompt(input: PromptBuilderInput = {}): BuiltPrompt {
  const mode: PromptMode = input.mode === "old-design" ? "old-design" : "sketch";
  const persona = getModelPersona(input.persona);
  const description = trimOrEmpty(input.description);
  const feedback = trimOrEmpty(input.feedback);
  const garmentNotes = buildGarmentNotes(input);

  const variableBlock = joinNonEmpty(
    [
      description && `User direction: ${description}.`,
      garmentNotes,
      feedback &&
        (mode === "old-design"
          ? `Apply this change clearly (do not return a near-copy): ${feedback}.`
          : `Refinement: ${feedback}.`),
    ],
    " ",
  );

  const modelLine =
    mode === "old-design"
      ? `House model (MUST use this person — not anyone from the reference photo): ${persona.description}`
      : `Model: ${persona.description}`;

  const prompt = joinNonEmpty(
    [
      mode === "old-design" ? OLD_DESIGN_ANCHOR : SKETCH_ANCHOR,
      modelLine,
      variableBlock,
      STUDIO,
      STYLE,
    ],
    " ",
  );

  return {
    prompt,
    negativePrompt:
      mode === "old-design"
        ? OLD_DESIGN_NEGATIVE_PROMPT
        : DEFAULT_NEGATIVE_PROMPT,
    seed: resolvePersonaSeed(persona),
    mode,
  };
}

/** True when the user is restyling a photo without a sketch. */
export function resolvePromptMode(input: {
  sketchUrls?: string[] | null;
  oldDesignUrl?: string | null;
}): PromptMode {
  const hasSketch = Boolean(input.sketchUrls?.some((u) => u?.trim()));
  const hasOld = Boolean(input.oldDesignUrl?.trim());
  if (hasOld && !hasSketch) return "old-design";
  return "sketch";
}
