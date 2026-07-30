/**
 * House model roster — pick one per design (or random).
 * Within a design, the same persona + seed stays locked for refine rounds.
 */

export type ModelPersona = {
  /** Tasteful catalogue-model description injected into every prompt. */
  description: string;
  /** Fixed seed so the same face / look recurs across generations. */
  seed: number;
  /** When true, the seed is always passed to the model. */
  lockSeed: boolean;
};

export type HouseModel = ModelPersona & {
  id: string;
  /** Short label for the UI. */
  name: string;
  /** One-line cue shown under the name. */
  cue: string;
};

/** 12 house models — varied looks, all modest catalogue tone. */
export const HOUSE_MODELS: HouseModel[] = [
  {
    id: "ayesha",
    name: "Ayesha",
    cue: "Classic elegant · fair-wheatish",
    description:
      "A young South Asian / Pakistani female fashion model, fair-to-wheatish complexion, striking and elegant features, dark hair worn neatly, refined and graceful, natural realistic proportions, calm confident expression, modest and poised posture.",
    seed: 42_861_793,
    lockSeed: true,
  },
  {
    id: "zara",
    name: "Zara",
    cue: "Soft natural · warm beige skin",
    description:
      "A young Pakistani female fashion model with a warm beige complexion, soft oval face, gentle brown eyes, shoulder-length dark brown hair with soft waves, natural makeup, understated elegance, realistic proportions, serene expression, modest upright posture.",
    seed: 19_204_557,
    lockSeed: true,
  },
  {
    id: "noor",
    name: "Noor",
    cue: "Radiant · light olive tone",
    description:
      "A young South Asian / Pakistani female fashion model with a light olive complexion, luminous skin, high cheekbones, dark almond-shaped eyes, sleek black hair in a low bun, polished yet natural look, graceful carriage, calm smile, modest catalogue pose.",
    seed: 77_331_902,
    lockSeed: true,
  },
  {
    id: "sana",
    name: "Sana",
    cue: "Contemporary · wheatish glow",
    description:
      "A young Pakistani female fashion model, wheatish complexion with a healthy glow, defined but soft features, expressive dark eyes, straight mid-length black hair, modern modest styling, natural proportions, confident yet reserved expression, poised full-length stance.",
    seed: 55_018_446,
    lockSeed: true,
  },
  {
    id: "hiba",
    name: "Hiba",
    cue: "Delicate · fair porcelain",
    description:
      "A young South Asian / Pakistani female fashion model with a fair porcelain complexion, delicate refined features, soft arched brows, dark hair with a gentle centre parting, minimal makeup, ethereal but realistic presence, slender natural frame, quiet dignity, modest posture.",
    seed: 31_667_120,
    lockSeed: true,
  },
  {
    id: "maryam",
    name: "Maryam",
    cue: "Statuesque · medium warm tone",
    description:
      "A young Pakistani female fashion model with a medium warm complexion, statuesque presence, strong elegant jawline, deep brown eyes, long dark hair loosely tied back, sophisticated catalogue look, natural tall proportions, composed expression, modest and confident pose.",
    seed: 90_452_318,
    lockSeed: true,
  },
  {
    id: "laiba",
    name: "Laiba",
    cue: "Youthful soft · honey beige",
    description:
      "A young South Asian / Pakistani female fashion model with a honey-beige complexion, youthful soft features, bright dark eyes, wavy dark hair framing the face, fresh natural makeup, realistic proportions, gentle smile, relaxed yet polished modest pose.",
    seed: 12_889_704,
    lockSeed: true,
  },
  {
    id: "fatima",
    name: "Fatima",
    cue: "Regal calm · dusky wheatish",
    description:
      "A young Pakistani female fashion model with a dusky wheatish complexion, regal calm features, expressive eyes, thick dark hair in a smooth ponytail, understated jewellery-ready look without jewellery, elegant silhouette, serious soft expression, modest full-length stance.",
    seed: 64_173_059,
    lockSeed: true,
  },
  {
    id: "iqra",
    name: "Iqra",
    cue: "Editorial clean · fair olive",
    description:
      "A young South Asian / Pakistani female fashion model with a fair-olive complexion, clean editorial features, sharp yet soft eyes, cropped-to-shoulder sleek black hair, crisp natural styling, realistic body proportions, focused calm expression, modest centred pose.",
    seed: 48_920_611,
    lockSeed: true,
  },
  {
    id: "areeba",
    name: "Areeba",
    cue: "Warm smile · golden wheat",
    description:
      "A young Pakistani female fashion model with a golden-wheat complexion, warm approachable features, soft smile, dark brown eyes, long straight black hair with a side part, natural day-makeup look, realistic proportions, friendly poise, modest catalogue posture.",
    seed: 27_506_884,
    lockSeed: true,
  },
  {
    id: "mahnoor",
    name: "Mahnoor",
    cue: "Dramatic elegance · deep warm tone",
    description:
      "A young South Asian / Pakistani female fashion model with a deep warm complexion, dramatic elegant features, striking dark eyes, rich black hair swept back smoothly, refined contour with natural finish, graceful long neckline framing, composed expression, modest upright pose.",
    seed: 83_114_275,
    lockSeed: true,
  },
  {
    id: "rida",
    name: "Rida",
    cue: "Minimal modern · light wheatish",
    description:
      "A young Pakistani female fashion model with a light wheatish complexion, minimal modern features, clear skin, soft brown eyes, neat shoulder-length dark hair, barely-there makeup, contemporary modest fashion look, natural proportions, tranquil expression, balanced centred stance.",
    seed: 5_738_162,
    lockSeed: true,
  },
];

export const DEFAULT_HOUSE_MODEL = HOUSE_MODELS[0]!;

export const DEFAULT_MODEL_PERSONA: ModelPersona = {
  description: DEFAULT_HOUSE_MODEL.description,
  seed: DEFAULT_HOUSE_MODEL.seed,
  lockSeed: DEFAULT_HOUSE_MODEL.lockSeed,
};

export const RANDOM_HOUSE_MODEL_ID = "random" as const;

export type HouseModelSelection = typeof RANDOM_HOUSE_MODEL_ID | string;

export function getHouseModelById(id: string): HouseModel | undefined {
  return HOUSE_MODELS.find((m) => m.id === id);
}

export function pickRandomHouseModel(
  excludeId?: string,
): HouseModel {
  const pool = excludeId
    ? HOUSE_MODELS.filter((m) => m.id !== excludeId)
    : HOUSE_MODELS;
  const list = pool.length ? pool : HOUSE_MODELS;
  const index = Math.floor(Math.random() * list.length);
  return list[index]!;
}

/**
 * Resolve which house model to use for a generation.
 * - "random" → pick a new one
 * - specific id → that model
 * - missing → default Ayesha
 */
export function resolveHouseModel(
  selection?: HouseModelSelection | null,
): HouseModel {
  if (!selection || selection === RANDOM_HOUSE_MODEL_ID) {
    return pickRandomHouseModel();
  }
  return getHouseModelById(selection) ?? DEFAULT_HOUSE_MODEL;
}

export function getModelPersona(
  override?: Partial<ModelPersona>,
): ModelPersona {
  return {
    ...DEFAULT_MODEL_PERSONA,
    ...override,
  };
}

export function resolvePersonaSeed(
  persona: ModelPersona = getModelPersona(),
): number | undefined {
  return persona.lockSeed ? persona.seed : undefined;
}

export function houseModelToPersona(model: HouseModel): ModelPersona {
  return {
    description: model.description,
    seed: model.seed,
    lockSeed: model.lockSeed,
  };
}
