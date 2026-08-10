/**
 * Commercial pose library tuned to Pakistani ethnic-wear lookbooks
 * (e.g. Vanya-style campaigns): calm, garment-first, full-length readable.
 */

export type CommercialPose = {
  id: string;
  label: string;
  /** Injected into the fal prompt. */
  prompt: string;
};

export const COMMERCIAL_POSES: CommercialPose[] = [
  {
    id: "catalogue-front",
    label: "Catalogue front",
    prompt:
      "Pose: classic full-length catalogue front — facing camera, feet close or slightly apart, arms relaxed at sides, calm composed expression. Garment silhouette, embroidery, and dupatta drape must read clearly. Soft commercial lookbook energy, not stiff military stand.",
  },
  {
    id: "soft-asymmetry",
    label: "Soft stand",
    prompt:
      "Pose: facing camera with soft asymmetry — weight on one leg, one foot slightly forward, shoulders relaxed, hands soft at sides or lightly away from body so sleeves and drape show. Elegant Pakistani ethnic-wear lookbook stance.",
  },
  {
    id: "hands-clasped",
    label: "Hands clasped",
    prompt:
      "Pose: standing front or slight angle, hands lightly clasped or resting together near the waist/front, upright torso, serene commercial portrait energy. Keeps the centre of the outfit visible and polished.",
  },
  {
    id: "three-quarter-lookbook",
    label: "3/4 lookbook",
    prompt:
      "Pose: standing three-quarter turn (~45°), weight on back leg, front foot soft, face turned toward camera. Editorial catalogue angle that still shows the full outfit and fabric fall.",
  },
  {
    id: "over-shoulder-back",
    label: "Over shoulder",
    prompt:
      "Pose: body angled away to show the back of the outfit and dupatta fall, looking back over one shoulder toward the camera. Graceful lookbook turn — modest and elegant.",
  },
  {
    id: "side-silhouette",
    label: "Side silhouette",
    prompt:
      "Pose: clear side / near-profile stance so sleeve length, side seam, and outfit silhouette read cleanly. Soft chin angle, calm expression, full garment still in frame.",
  },
  {
    id: "prop-lean",
    label: "Prop lean",
    prompt:
      "Pose: casually leaning one hand or hip against a table edge, counter, pillar, or low prop — body slightly angled, face toward camera. Lifestyle commercial campaign lean like a premium ethnic-wear shoot, outfit fully visible.",
  },
  {
    id: "seated-lookbook",
    label: "Seated lookbook",
    prompt:
      "Pose: seated elegantly on a low block, ledge, stool, or wooden table edge — ankles crossed or one knee soft, upright torso, hands resting naturally. Full outfit and fabric pool remain readable; serene commercial seating.",
  },
  {
    id: "look-away-editorial",
    label: "Look away",
    prompt:
      "Pose: standing or softly seated three-quarter, gaze looking gently away from camera (not at lens), calm editorial stillness. Premium campaign mood — garment stays the hero.",
  },
  {
    id: "gentle-walk",
    label: "Gentle walk",
    prompt:
      "Pose: soft mid-stride walk toward or across camera — one foot forward, light fabric motion in chiffon/dupatta, confident but not aggressive runway walk. Real commercial campaign stride.",
  },
];

/** Keep current framing on refine unless the user asks for a new pose. */
export const KEEP_POSE_LINE =
  "Pose continuity: keep the same body pose, stance, and camera angle as the previous photograph unless a pose change is explicitly requested.";

export function pickRandomCommercialPose(
  excludeId?: string,
): CommercialPose {
  const pool = excludeId
    ? COMMERCIAL_POSES.filter((p) => p.id !== excludeId)
    : COMMERCIAL_POSES;
  const list = pool.length ? pool : COMMERCIAL_POSES;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function getCommercialPoseById(
  id: string | undefined | null,
): CommercialPose | undefined {
  if (!id) return undefined;
  return COMMERCIAL_POSES.find((p) => p.id === id);
}
