import {
  getModelPersona,
  resolvePersonaSeed,
  type ModelPersona,
} from "@/lib/model-persona";
import {
  KEEP_POSE_LINE,
  getCommercialPoseById,
  pickRandomCommercialPose,
  type CommercialPose,
} from "@/lib/commercial-poses";

/** Sketch mode — structure from line art; do not redesign the cut. */
const SKETCH_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. Reproduce the garment exactly as shown in the attached sketch — same silhouette, neckline, sleeves, hem, and any embroidery or detail, in the same positions. Do not redesign or omit garment details.";

/**
 * Old-design / photo restyle — keep the garment idea, replace the person,
 * and allow a clearer catalogue upgrade on the first pass.
 */
const OLD_DESIGN_ANCHOR =
  "Photorealistic fashion photograph that looks like a real camera shot. The attached image is an OLD DESIGN PHOTO for garment inspiration only. Recreate the outfit as a fresh real photograph: keep the garment type, silhouette, and key dress details, but improve fabric realism, colour richness, and fit. CRITICAL: do NOT keep the original person, face, body, hair, skin tone, or identity from the photo — completely replace them with the house model described below.";

/** Text-only — invent garment from the user's description. */
const DESCRIPTION_ANCHOR =
  "Photorealistic fashion photograph that looks like a real commercial campaign shot. Create the outfit from the user's written description only — no sketch or reference photo. Invent a coherent modest South Asian / Pakistani women's outfit (e.g. kameez, shalwar/palazzo, dupatta if mentioned) that matches the colours, fabric, and style notes. Show it on the house model in a varied commercial pose (not always standing front-on).";

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
  "Shot like a real commercial fashion campaign: 50–85mm lens look, natural depth of field, sharp focus on the garment, true-to-life fabric texture and drape, modest tasteful styling. Framing may be full-length or three-quarter depending on the pose — never a stiff mannequin stand unless that pose is requested.";

/** Avoid blank “AI mannequin” faces — subtle real expression. */
const EXPRESSION =
  "Facial expression must feel real and human: a soft genuine closed-mouth smile or gentle half-smile, slight warmth and life in the eyes, natural micro-expression as in real fashion photography. Not blank, vacant, deadpan, emotionless, frozen, or mannequin-like. Keep it modest and tasteful — no exaggerated grin.";

const STYLE =
  "High-end modest commercial fashion photography for a real brand lookbook/campaign, photorealistic, shot on a real camera, not illustrated, not CGI, not a stiff ecommerce ghost mannequin.";

const SHARED_NEGATIVES =
  "watermark, text overlay, logo, arrow, cross symbol, UI icons, screenshot chrome, collage, flat seamless paper backdrop, blank stare, deadpan face, emotionless expression, vacant eyes, mannequin face, stiff military stand, identical pose every time, uncanny valley, deformed hands, extra limbs, illustrated, cartoon, CGI, plastic skin";

export const DEFAULT_NEGATIVE_PROMPT =
  `no altered neckline or hem, no distorted embroidery, no oversaturation, no extra garments, ${SHARED_NEGATIVES}`;

export const OLD_DESIGN_NEGATIVE_PROMPT =
  `same face as reference photo, original model identity, photocopy of input, identical pose to reference, ${SHARED_NEGATIVES}`;

export type PromptMode = "sketch" | "old-design" | "description";

export const INPUT_SOURCE_TABS = [
  {
    id: "sketch" as const,
    label: "1 · Sketch",
    hint: "Sketch(es) + model · description optional",
  },
  {
    id: "old-design" as const,
    label: "2 · Old design",
    hint: "Design photo(s) + model · description optional",
  },
  {
    id: "description" as const,
    label: "3 · Description",
    hint: "Model + description only · no upload",
  },
] as const;

/** One-click pose / angle presets for the result screen. */
export const POSE_PRESETS = [
  {
    id: "front",
    label: "Front view",
    feedback:
      "Change to a relaxed front-facing commercial fashion photo. Soft knee bend, natural arms, same house model and same dress — not a stiff mannequin stand.",
  },
  {
    id: "three-quarter",
    label: "3/4 angle",
    feedback:
      "Change to a classic three-quarter commercial pose with weight shift, looking toward camera, same house model and same dress.",
  },
  {
    id: "side",
    label: "Side profile",
    feedback:
      "Change to a side-profile fashion photo so silhouette and drape read clearly, same house model and same dress.",
  },
  {
    id: "over-shoulder",
    label: "Over shoulder",
    feedback:
      "Change pose: look back over one shoulder toward the camera, elegant editorial turn, same house model and same dress.",
  },
  {
    id: "walk",
    label: "Walking",
    feedback:
      "Change pose to a natural walking stride toward the camera, mid-step, real commercial campaign energy, same house model and same dress.",
  },
  {
    id: "seated",
    label: "Sitting",
    feedback:
      "Change pose to seated on a ledge, step, or chair — modest commercial lookbook seating with the full outfit readable, same house model and same dress.",
  },
  {
    id: "lean",
    label: "Lean",
    feedback:
      "Change pose to casually leaning against a wall or pillar, weight on one leg, relaxed commercial stance, same house model and same dress.",
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
  /**
   * Generate: pass a chosen commercial pose (or omit to auto-pick).
   * Refine: omit + set keepPose to lock the previous stance.
   */
  pose?: CommercialPose | null;
  poseId?: string | null;
  /** On refine, keep previous pose unless feedback asks for a pose change. */
  keepPose?: boolean;
};

export type BuiltPrompt = {
  prompt: string;
  negativePrompt: string;
  seed: number | undefined;
  mode: PromptMode;
  poseId?: string;
  poseLabel?: string;
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
  return /\b(pose|angle|side|profile|front|three[- ]?quarter|walking|walk|over[- ]?shoulder|turn|facing|camera|sit|sitting|seated|lean|leaning|crouch|kneel|stairs|step)\b/i.test(
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
  const mode: PromptMode =
    input.mode === "old-design"
      ? "old-design"
      : input.mode === "description"
        ? "description"
        : "sketch";
  const persona = getModelPersona(input.persona);
  const description = trimOrEmpty(input.description);
  const feedback = trimOrEmpty(input.feedback);
  const garmentNotes = buildGarmentNotes(input);
  const wantsBg = feedbackRequestsBackground(feedback);
  const wantsPose = feedbackRequestsPose(feedback);

  let pose: CommercialPose | undefined =
    input.pose ?? getCommercialPoseById(input.poseId) ?? undefined;
  let keepPose = Boolean(input.keepPose);

  if (wantsPose) {
    keepPose = false;
    pose = undefined;
  } else if (!pose && !keepPose) {
    pose = pickRandomCommercialPose();
  }

  const variableBlock = joinNonEmpty(
    [
      description &&
        (mode === "description"
          ? `Garment brief: ${description}.`
          : `User direction: ${description}.`),
      garmentNotes,
      feedback &&
        (wantsBg
          ? `BACKGROUND CHANGE — apply clearly, replace the entire environment with a real photographic setting: ${feedback}. Keep the same house model and the same dress.`
          : wantsPose
            ? `POSE / ANGLE CHANGE — apply clearly with a new real commercial fashion-photography stance: ${feedback}. Keep the same house model and the same dress; do not return a near-copy of the previous frame.`
            : mode === "old-design" || mode === "description"
              ? `Apply this change clearly (do not return a near-copy): ${feedback}.`
              : `Refinement: ${feedback}.`),
    ],
    " ",
  );

  const modelLine =
    mode === "old-design"
      ? `House model (MUST use this exact distinct person — not anyone from the reference photo, and not a generic similar face): ${persona.description}`
      : `House model (keep this exact distinct identity — do not genericise into a lookalike): ${persona.description}`;

  const sceneLine = wantsBg
    ? "The new background must look like a real photograph, compatible with the dress colour and occasion, with natural depth and lighting."
    : REAL_SCENE;

  const poseLine = wantsPose
    ? null
    : keepPose
      ? KEEP_POSE_LINE
      : pose?.prompt ?? null;

  const anchor =
    mode === "old-design"
      ? OLD_DESIGN_ANCHOR
      : mode === "description"
        ? DESCRIPTION_ANCHOR
        : SKETCH_ANCHOR;

  const prompt = joinNonEmpty(
    [
      anchor,
      ...(mode === "description" ? [] : [CLEANUP]),
      modelLine,
      variableBlock,
      sceneLine,
      ...(poseLine ? [poseLine] : []),
      EXPRESSION,
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
    poseId: pose?.id,
    poseLabel: pose?.label,
  };
}

/** Resolve mode from client tab or from what was uploaded. */
export function resolvePromptMode(input: {
  sketchUrls?: string[] | null;
  oldDesignUrl?: string | null;
  oldDesignUrls?: string[] | null;
  sourceMode?: PromptMode | null;
  hasDescription?: boolean;
}): PromptMode {
  if (
    input.sourceMode === "sketch" ||
    input.sourceMode === "old-design" ||
    input.sourceMode === "description"
  ) {
    return input.sourceMode;
  }
  const hasSketch = Boolean(input.sketchUrls?.some((u) => u?.trim()));
  const hasOld = Boolean(
    input.oldDesignUrl?.trim() ||
      input.oldDesignUrls?.some((u) => u?.trim()),
  );
  if (hasOld && !hasSketch) return "old-design";
  if (!hasSketch && !hasOld && input.hasDescription) return "description";
  return "sketch";
}
