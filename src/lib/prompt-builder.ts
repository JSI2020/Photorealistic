import {
  getModelPersona,
  resolvePersonaSeed,
  type ModelPersona,
} from "@/lib/model-persona";

/** Sketch mode — structure from line art; do not redesign the cut. */
const SKETCH_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. Reproduce the garment exactly as shown in the attached sketch — same silhouette, neckline, sleeves, hem, and any embroidery or detail, in the same positions. Do not redesign or omit garment details.";

/**
 * Old-design / photo restyle — keep the garment idea, replace the person,
 * and allow a clearer catalogue upgrade on the first pass.
 */
const OLD_DESIGN_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. The attached image is an OLD DESIGN PHOTO for garment inspiration only. Recreate the outfit as a fresh real photograph: keep the garment type, silhouette, and key dress details, but improve fabric realism, colour richness, and fit. CRITICAL: do NOT keep the original person, face, body, hair, skin tone, or identity from the photo — completely replace them with the house model described below.";

/** Strip junk that often appears in sourced photos / screenshots. */
const CLEANUP =
  "Include ONLY the model and the clothing. Completely omit anything irrelevant that is not part of the dress: watermarks, logos, brand marks, arrows, crosses, religious or UI symbols, circles, stickers, text overlays, phone UI, screenshots chrome, collages, and background clutter from the source image.";

/**
 * Default scene: real photography, dress-compatible — not a flat seamless studio.
 * User feedback about background can override via the variable block.
 */
const REAL_SCENE =
  "Place the model in a believable real-world photography setting that complements the dress colour, fabric, and occasion (for example soft outdoor daylight courtyard, marble foyer, boutique interior, garden path, or warm evening terrace). Natural depth, real surfaces, and realistic lighting — not a flat seamless paper backdrop, not CGI, not illustration.";

const CAMERA =
  "Full-length or three-quarter fashion photography, 85mm lens look, sharp focus on the garment, true-to-life fabric texture and drape, modest poised styling.";

const STYLE =
  "High-end modest fashion editorial photography, photorealistic, shot on a real camera, not illustrated or stylised.";

const SHARED_NEGATIVES =
  "watermark, text overlay, logo, arrow, cross symbol, UI icons, screenshot chrome, collage, flat seamless paper backdrop, deformed hands, extra limbs, illustrated, cartoon, CGI, plastic skin";

export const DEFAULT_NEGATIVE_PROMPT =
  `no altered neckline or hem, no distorted embroidery, no oversaturation, no extra garments, ${SHARED_NEGATIVES}`;

export const OLD_DESIGN_NEGATIVE_PROMPT =
  `same face as reference photo, original model identity, photocopy of input, identical pose to reference, ${SHARED_NEGATIVES}`;

export type PromptMode = "sketch" | "old-design";

/** One-click pose / angle presets for the result screen. */
export const POSE_PRESETS = [
  {
    id: "front",
    label: "Front view",
    feedback:
      "Change camera angle to a clear front-facing full-length fashion photo. Model stands facing the camera, natural catalogue pose, same house model and same dress, real photography look.",
  },
  {
    id: "three-quarter",
    label: "3/4 angle",
    feedback:
      "Change camera angle to a classic three-quarter fashion pose. Model turned about 45 degrees, looking toward camera, same house model and same dress, real photography look.",
  },
  {
    id: "side",
    label: "Side profile",
    feedback:
      "Change camera angle to a side-profile fashion photo. Model shown from the side so silhouette and drape read clearly, same house model and same dress, real photography look.",
  },
  {
    id: "over-shoulder",
    label: "Over shoulder",
    feedback:
      "Change pose: model looks back over one shoulder toward the camera, elegant modest fashion editorial stance, same house model and same dress, real photography look.",
  },
  {
    id: "walk",
    label: "Walking",
    feedback:
      "Change pose to a natural walking stride toward the camera, mid-step, like a real runway or street fashion photograph, same house model and same dress.",
  },
] as const;

export type PromptBuilderInput = {
  description?: string;
  shirtColour?: string;
  shirtFabric?: string;
  trouserColour?: string;
  trouserFabric?: string;
  fabric?: string;
  feedback?: string;
  persona?: Partial<ModelPersona>;
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

export function feedbackRequestsBackground(feedback?: string): boolean {
  return /\b(background|backdrop|setting|scene|location|environment|outdoor|indoor|garden|street|studio|terrace|courtyard|foyer)\b/i.test(
    feedback ?? "",
  );
}

export function feedbackRequestsPose(feedback?: string): boolean {
  return /\b(pose|angle|side|profile|front|three[- ]?quarter|walking|over[- ]?shoulder|turn|facing|camera)\b/i.test(
    feedback ?? "",
  );
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
  const wantsBg = feedbackRequestsBackground(feedback);
  const wantsPose = feedbackRequestsPose(feedback);

  const variableBlock = joinNonEmpty(
    [
      description && `User direction: ${description}.`,
      garmentNotes,
      feedback &&
        (wantsBg
          ? `BACKGROUND CHANGE — apply clearly, replace the entire environment with a real photographic setting: ${feedback}. Keep the same house model and the same dress.`
          : wantsPose
            ? `POSE / ANGLE CHANGE — apply clearly with a new real fashion-photography stance: ${feedback}. Keep the same house model and the same dress; do not return a near-copy of the previous frame.`
            : mode === "old-design"
              ? `Apply this change clearly (do not return a near-copy): ${feedback}.`
              : `Refinement: ${feedback}.`),
    ],
    " ",
  );

  const modelLine =
    mode === "old-design"
      ? `House model (MUST use this person — not anyone from the reference photo): ${persona.description}`
      : `Model: ${persona.description}`;

  // If user asked for a background, don't fight them with the default scene line.
  const sceneLine = wantsBg
    ? "The new background must look like a real photograph, compatible with the dress colour and occasion, with natural depth and lighting."
    : REAL_SCENE;

  const prompt = joinNonEmpty(
    [
      mode === "old-design" ? OLD_DESIGN_ANCHOR : SKETCH_ANCHOR,
      CLEANUP,
      modelLine,
      variableBlock,
      sceneLine,
      CAMERA,
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
