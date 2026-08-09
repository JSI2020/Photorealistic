/**
 * House model roster — pick one per design (or random).
 * Within a design, the same persona + seed stays locked for refine rounds.
 * Descriptions are intentionally distinct so faces do not all look the same.
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

/** 12 house models — clearly differentiated looks, modest commercial tone. */
export const HOUSE_MODELS: HouseModel[] = [
  {
    id: "ayesha",
    name: "Ayesha",
    cue: "Classic oval · fair-wheatish · long waves",
    description:
      "Distinct face identity: young Pakistani woman, fair-to-wheatish skin, oval face, narrow nose, arched brows, deep brown almond eyes, long loosely waved black hair past the shoulders with a centre part, soft half-smile. Do not blend her with other models.",
    seed: 42_861_793,
    lockSeed: true,
  },
  {
    id: "zara",
    name: "Zara",
    cue: "Round soft · warm beige · bob waves",
    description:
      "Distinct face identity: young Pakistani woman, warm beige skin, softer rounder face, fuller cheeks, wide gentle brown eyes, shorter shoulder-length dark brown hair with soft waves and face-framing pieces, quiet smile. Visibly different from sharper-featured models.",
    seed: 19_204_557,
    lockSeed: true,
  },
  {
    id: "noor",
    name: "Noor",
    cue: "High cheekbones · light olive · low bun",
    description:
      "Distinct face identity: young South Asian woman, light olive luminous skin, higher cheekbones, slightly longer face, dark almond eyes, sleek black hair pulled into a low neat bun exposing the ears and neck, polished soft smile. Editorial bone structure — not a soft round face.",
    seed: 77_331_902,
    lockSeed: true,
  },
  {
    id: "sana",
    name: "Sana",
    cue: "Heart face · wheatish glow · straight mid hair",
    description:
      "Distinct face identity: young Pakistani woman, wheatish glowing skin, heart-shaped face with a narrower chin, straight mid-length jet-black hair with blunt ends, defined brows, expressive dark eyes, subtle closed-mouth smile. Contemporary and clean — not a bun or waves look.",
    seed: 55_018_446,
    lockSeed: true,
  },
  {
    id: "hiba",
    name: "Hiba",
    cue: "Petite delicate · fair porcelain · centre part",
    description:
      "Distinct face identity: young South Asian woman, fair porcelain skin, more delicate petite facial features, softer jaw, fine dark brows, large soft eyes, dark hair with a clean centre parting falling straight beside the face, quiet bright smile. Smaller-boned look than statuesque models.",
    seed: 31_667_120,
    lockSeed: true,
  },
  {
    id: "maryam",
    name: "Maryam",
    cue: "Statuesque square · medium warm · tied back",
    description:
      "Distinct face identity: young Pakistani woman, medium warm complexion, taller presence, stronger elegant jawline (slightly square), deep-set brown eyes, long dark hair loosely tied back with volume at the crown, composed soft smile. Clearly more statuesque than petite models.",
    seed: 90_452_318,
    lockSeed: true,
  },
  {
    id: "laiba",
    name: "Laiba",
    cue: "Youthful · honey beige · curly-wavy fringe",
    description:
      "Distinct face identity: young South Asian woman, honey-beige skin, youthful rounded features, bright rounder dark eyes, dark hair with soft curly-wavy texture and light fringe/pieces around the forehead, open natural smile that reaches the eyes. Younger playful energy — not regal or severe.",
    seed: 12_889_704,
    lockSeed: true,
  },
  {
    id: "fatima",
    name: "Fatima",
    cue: "Regal · dusky wheatish · sleek ponytail",
    description:
      "Distinct face identity: young Pakistani woman, dusky wheatish skin, more mature regal features, thicker dark brows, intense expressive eyes, thick black hair in a smooth high or mid ponytail, serious-soft closed-mouth smile. Stronger contrast and presence than soft natural looks.",
    seed: 64_173_059,
    lockSeed: true,
  },
  {
    id: "iqra",
    name: "Iqra",
    cue: "Angular editorial · fair olive · cropped bob",
    description:
      "Distinct face identity: young South Asian woman, fair-olive skin, cleaner angular editorial features, sharper jaw, cropped-to-shoulder sleek black bob with tucked-behind-ear styling, focused friendly eyes, hint of a smile. Short hair — must not look long-haired.",
    seed: 48_920_611,
    lockSeed: true,
  },
  {
    id: "areeba",
    name: "Areeba",
    cue: "Approachable · golden wheat · side part long",
    description:
      "Distinct face identity: young Pakistani woman, golden-wheat complexion, warmer approachable face, softer nose bridge, dark brown eyes, long straight black hair with a clear side part and length past mid-back, friendly natural smile. Warm and open — not cold editorial.",
    seed: 27_506_884,
    lockSeed: true,
  },
  {
    id: "mahnoor",
    name: "Mahnoor",
    cue: "Dramatic · deep warm tone · swept back",
    description:
      "Distinct face identity: young South Asian woman, deep warm brown complexion (noticeably deeper than fair models), dramatic features, striking dark eyes, rich black hair swept fully back off the forehead, longer elegant neck, composed soft smile. Deep skin tone must remain clearly deeper than wheatish models.",
    seed: 83_114_275,
    lockSeed: true,
  },
  {
    id: "rida",
    name: "Rida",
    cue: "Minimal · light wheatish · neat shoulder cut",
    description:
      "Distinct face identity: young Pakistani woman, light wheatish clear skin, minimal modern features, soft brown eyes, neat blunt shoulder-length dark hair with almost no wave, barely-there makeup, tranquil gentle smile. Ultra-minimal styling — not glamorous or dramatic.",
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

export function pickRandomHouseModel(excludeId?: string): HouseModel {
  const pool = excludeId
    ? HOUSE_MODELS.filter((m) => m.id !== excludeId)
    : HOUSE_MODELS;
  const list = pool.length ? pool : HOUSE_MODELS;
  const index = Math.floor(Math.random() * list.length);
  return list[index]!;
}

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
