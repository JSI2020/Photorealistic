import {
  getModelPersona,
  resolvePersonaSeed,
  type ModelPersona,
} from "@/lib/model-persona";

/** Fixed scaffolding — never varied between calls. */
const SKETCH_ANCHOR =
  "Photorealistic fashion e-commerce photograph. Reproduce the garment exactly as shown in the attached sketch — same silhouette, neckline, sleeves, hem, and any embroidery or detail, in the same positions. Do not redesign or omit anything.";

const STUDIO =
  "Clean studio, seamless soft neutral background, soft diffused daylight, gentle shadows. Full-length shot, model centred, 85mm lens look, sharp focus on the garment, true-to-life fabric texture and drape.";

const STYLE =
  "High-end modest fashion catalogue photography, realistic, not illustrated or stylised.";

export const DEFAULT_NEGATIVE_PROMPT =
  "no text, no logo, no altered neckline or hem, no distorted embroidery, no oversaturation, no extra garments, deformed hands, extra limbs.";

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
};

export type BuiltPrompt = {
  prompt: string;
  negativePrompt: string;
  seed: number | undefined;
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

  // Fabric-only with no colour split still belongs in the prompt.
  if (!notes.length && fabricFallback) {
    notes.push(`Fabric: ${fabricFallback}.`);
  }

  return notes.join(" ");
}

/**
 * Assembles the fal prompt. Sketch structure wins; text only finishes
 * colour, fabric, mood, and refine feedback.
 */
export function buildPrompt(input: PromptBuilderInput = {}): BuiltPrompt {
  const persona = getModelPersona(input.persona);
  const description = trimOrEmpty(input.description);
  const feedback = trimOrEmpty(input.feedback);
  const garmentNotes = buildGarmentNotes(input);

  const variableBlock = joinNonEmpty(
    [
      description && `User direction: ${description}.`,
      garmentNotes,
      feedback && `Refinement: ${feedback}.`,
    ],
    " ",
  );

  const prompt = joinNonEmpty(
    [
      SKETCH_ANCHOR,
      `Model: ${persona.description}`,
      variableBlock,
      STUDIO,
      STYLE,
    ],
    " ",
  );

  return {
    prompt,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    seed: resolvePersonaSeed(persona),
  };
}
