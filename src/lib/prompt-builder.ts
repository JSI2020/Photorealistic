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

/**
 * Refine / pose-change: edit the previous photo — do not reinvent dress or face.
 */
const REFINE_LOCK_ANCHOR =
  "Edit the attached PREVIOUS RESULT photograph only. CRITICAL LOCKS: (1) Keep the EXACT same woman — same face, hair, skin tone, age, and identity; do not swap to a different model. (2) Keep the EXACT same dress — same colours, embroidery, silhouette, neckline, sleeves, hem, fabric look; do not redesign or recolour the outfit. (3) Keep the same background mood unless a background change is explicitly requested. Apply ONLY the requested change below.";

const POSE_ONLY_LOCK =
  "POSE-ONLY CHANGE: change body stance and/or camera angle only. Do NOT change dress colour, embroidery, print, fabric, cut, accessories, or the model's face/hair/identity. The outfit and woman must look like the same photograph restaged.";

const SHARED_NEGATIVES =
  "watermark, text overlay, logo, arrow, cross symbol, UI icons, screenshot chrome, collage, flat seamless paper backdrop, blank stare, deadpan face, emotionless expression, vacant eyes, mannequin face, stiff military stand, identical pose every time, uncanny valley, deformed hands, extra limbs, illustrated, cartoon, CGI, plastic skin";

const POSE_CHANGE_NEGATIVES =
  `different dress colour, recoloured garment, new embroidery design, redesigned outfit, different model face, new identity, different hair colour or hairstyle, swapped model, ${SHARED_NEGATIVES}`;

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
      "Pose only: restage to a relaxed front-facing commercial stance (soft knee bend, natural arms). Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "three-quarter",
    label: "3/4 angle",
    feedback:
      "Pose only: restage to a three-quarter turn with weight shift, looking toward camera. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "side",
    label: "Side profile",
    feedback:
      "Pose only: restage to a side-profile angle so silhouette reads clearly. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "over-shoulder",
    label: "Over shoulder",
    feedback:
      "Pose only: restage looking back over one shoulder toward the camera. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "walk",
    label: "Walking",
    feedback:
      "Pose only: restage to a natural walking stride mid-step toward the camera. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "seated",
    label: "Sitting",
    feedback:
      "Pose only: restage seated on a ledge, step, or chair with the outfit still fully readable. Keep the exact same dress colours/design and the exact same model face.",
  },
  {
    id: "lean",
    label: "Lean",
    feedback:
      "Pose only: restage casually leaning against a wall or pillar. Keep the exact same dress colours/design and the exact same model face.",
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
  pose?: CommercialPose | null;
  poseId?: string | null;
  keepPose?: boolean;
  /** True when editing a previous result (refine / pose buttons). */
  isRefine?: boolean;
  /** True when only pose/angle should change. */
  poseOnly?: boolean;
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
 * Generate uses sketch/old-design/description anchors.
 * Refine / pose-only uses a lock anchor so dress + face stay the same.
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
  const wantsPose =
    Boolean(input.poseOnly) || feedbackRequestsPose(feedback);
  const isRefine = Boolean(input.isRefine) || wantsPose || Boolean(input.keepPose);

  let pose: CommercialPose | undefined =
    input.pose ?? getCommercialPoseById(input.poseId) ?? undefined;
  let keepPose = Boolean(input.keepPose);

  if (wantsPose) {
    keepPose = false;
    pose = undefined;
  } else if (!isRefine && !pose && !keepPose) {
    pose = pickRandomCommercialPose();
  }

  const variableBlock = joinNonEmpty(
    [
      !input.poseOnly &&
        description &&
        (mode === "description" && !isRefine
          ? `Garment brief: ${description}.`
          : isRefine
            ? `Keep garment intent unchanged: ${description}.`
            : `User direction: ${description}.`),
      !input.poseOnly &&
        garmentNotes &&
        (isRefine
          ? `Locked colours/fabric (do not change): ${garmentNotes}`
          : garmentNotes),
      feedback &&
        (input.poseOnly || (wantsPose && !wantsBg)
          ? `${POSE_ONLY_LOCK} Requested pose: ${feedback}`
          : wantsBg
            ? `BACKGROUND CHANGE — replace the environment only: ${feedback}. Keep the exact same dress and the exact same model face.`
            : isRefine
              ? `Requested change (preserve dress + model identity): ${feedback}.`
              : mode === "old-design" || mode === "description"
                ? `Apply this change clearly (do not return a near-copy): ${feedback}.`
                : `Refinement: ${feedback}.`),
    ],
    " ",
  );

  const modelLine = isRefine
    ? `LOCKED model identity (must match the previous photo's woman): ${persona.description}`
    : mode === "old-design"
      ? `House model (MUST use this exact distinct person — not anyone from the reference photo, and not a generic similar face): ${persona.description}`
      : `House model (keep this exact distinct identity — do not genericise into a lookalike): ${persona.description}`;

  const sceneLine =
    input.poseOnly || (wantsPose && !wantsBg)
      ? "Keep the same background environment as the previous photograph; only restage the model's pose."
      : wantsBg
        ? "The new background must look like a real photograph, compatible with the dress colour and occasion, with natural depth and lighting."
        : isRefine
          ? "Keep the same background setting as the previous photograph unless a background change was requested."
          : REAL_SCENE;

  const poseLine = wantsPose
    ? null
    : keepPose
      ? KEEP_POSE_LINE
      : pose?.prompt ?? null;

  const anchor = isRefine
    ? REFINE_LOCK_ANCHOR
    : mode === "old-design"
      ? OLD_DESIGN_ANCHOR
      : mode === "description"
        ? DESCRIPTION_ANCHOR
        : SKETCH_ANCHOR;

  const prompt = joinNonEmpty(
    [
      anchor,
      ...(isRefine || mode === "description" ? [] : [CLEANUP]),
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
      input.poseOnly || (wantsPose && !wantsBg)
        ? POSE_CHANGE_NEGATIVES
        : mode === "old-design"
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
