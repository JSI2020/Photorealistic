/**
 * Commercial fashion pose library — used on first generate so shots are not
 * always a stiff standing catalogue pose.
 */

export type CommercialPose = {
  id: string;
  label: string;
  /** Injected into the fal prompt. */
  prompt: string;
};

export const COMMERCIAL_POSES: CommercialPose[] = [
  {
    id: "walk-toward",
    label: "Walking toward camera",
    prompt:
      "Pose: natural mid-stride walk toward the camera, one foot forward, fabric in slight motion, confident commercial fashion walk — not stiff or mannequin-still.",
  },
  {
    id: "walk-past",
    label: "Walking past",
    prompt:
      "Pose: walking across frame in profile/three-quarter, captured mid-step like a street or editorial campaign photo, dress drape moving naturally.",
  },
  {
    id: "seated-ledge",
    label: "Seated",
    prompt:
      "Pose: seated on a low ledge, stool, or garden step, ankles crossed or one knee slightly angled, upright torso, commercial lookbook seating — full outfit still readable.",
  },
  {
    id: "seated-chair",
    label: "Seated chair",
    prompt:
      "Pose: sitting in a chair or armchair at a slight angle, relaxed shoulders, hands resting naturally, modest commercial portrait framing that still shows the garment.",
  },
  {
    id: "lean-wall",
    label: "Lean",
    prompt:
      "Pose: casually leaning one shoulder against a wall or pillar, weight on one leg, relaxed commercial fashion stance.",
  },
  {
    id: "three-quarter-stand",
    label: "3/4 stand",
    prompt:
      "Pose: standing three-quarter turn, weight on back leg, front foot soft, one hand lightly adjusting sleeve or dupatta — editorial catalogue energy, not stiff front-on.",
  },
  {
    id: "over-shoulder",
    label: "Over shoulder",
    prompt:
      "Pose: looking back over one shoulder toward the camera, body angled away, graceful editorial turn that shows the outfit silhouette.",
  },
  {
    id: "hand-on-hip",
    label: "Hand on hip",
    prompt:
      "Pose: standing with one hand lightly on hip, soft contrapposto (weight shift), chin slightly down, high-end commercial campaign stance.",
  },
  {
    id: "stairs",
    label: "On steps",
    prompt:
      "Pose: standing on stairs or a step, one foot higher, body angled, as in a real outdoor fashion campaign.",
  },
  {
    id: "crouch-soft",
    label: "Soft crouch",
    prompt:
      "Pose: gentle fashion crouch / kneel on one knee on a clean surface, modest and elegant, camera slightly above, garment folds readable — commercial editorial, not casual selfie.",
  },
  {
    id: "front-relaxed",
    label: "Relaxed front",
    prompt:
      "Pose: facing camera but relaxed, soft knee bend, natural arm placement, slight head tilt — real commercial photography, not rigid military stand.",
  },
  {
    id: "side-glance",
    label: "Side glance",
    prompt:
      "Pose: body in side/three-quarter profile, eyes glancing toward camera, fashion editorial stillness with life — not a blank mannequin pose.",
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
