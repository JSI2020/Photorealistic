/**
 * Polish messy user notes into clear catalogue-prompt language via DeepSeek.
 * Sketch structure still wins — this only clarifies colour, fabric, mood, finish.
 */

export type PromptPolishInput = {
  description?: string;
  shirtColour?: string;
  trouserColour?: string;
  fabric?: string;
  feedback?: string;
  mode: "generate" | "refine";
  /** sketch = fidelity; old-design = restyle; description = text-only invent. */
  inputMode?: "sketch" | "old-design" | "description";
};

export type PromptPolishResult = {
  description?: string;
  shirtColour?: string;
  trouserColour?: string;
  fabric?: string;
  feedback?: string;
  polished: boolean;
  model?: string;
  error?: string;
};

type DeepSeekMessage = { role: string; content: string | null };

function deepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

function getModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
}

function getBaseUrl(): string {
  return (
    process.env.DEEPSEEK_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.deepseek.com"
  );
}

const SYSTEM_SKETCH = `You polish short, messy fashion notes into clear English for a photoreal fashion catalogue image prompt.

Rules:
- Output ONLY valid JSON with keys: description, shirtColour, trouserColour, fabric, feedback (all strings; use "" if unused).
- Improve clarity of colour, fabric, embroidery, fit, mood, lighting, background, and pose — do not invent a new garment silhouette, neckline, sleeve length, or hem.
- If the user asks for background / setting, expand into a concrete real photographic location that suits the dress (e.g. soft daylight courtyard, marble foyer, garden path, boutique interior) — never a flat paper seamless studio unless they asked for studio.
- If the user asks for pose / angle, expand into a concrete camera angle and stance (front, three-quarter, side profile, over-shoulder, walking).
- Vague asks like "make it nicer" become concrete tasteful catalogue language without redesigning the cut.
- Keep modest fashion catalogue tone. No objectifying language.
- Prefer short phrases suitable to append to an image prompt.
- Preserve the user's intent; do not contradict explicit colours they named.
- For refine mode, put the change request mainly in "feedback"; keep description as the stable garment summary if provided.`;

const SYSTEM_OLD_DESIGN = `You polish short, messy fashion notes for RESTYLING an old design PHOTO into a fresh real fashion photograph on a NEW house model.

Rules:
- Output ONLY valid JSON with keys: description, shirtColour, trouserColour, fabric, feedback (all strings; use "" if unused).
- Keep the garment type and overall idea, but encourage a clear upgrade: richer colour, better fabric realism, cleaner embroidery, better fit, real photographic lighting and a dress-compatible real background.
- Background / setting requests must become concrete real locations (courtyard, foyer, garden, terrace, boutique) — not flat seamless paper.
- Pose / angle requests must become concrete stances (front, side, three-quarter, walking, over-shoulder).
- Vague asks like "a bit better" MUST become concrete visual changes — not vague praise.
- Never ask to keep the original model's face or identity. Never keep watermarks, arrows, crosses, or UI marks from the source.
- Keep modest fashion catalogue tone. No objectifying language.
- Prefer short phrases suitable to append to an image prompt.
- For refine mode, put the change request mainly in "feedback".`;

const SYSTEM_DESCRIPTION = `You polish short, messy fashion notes into a clear outfit brief for TEXT-ONLY photoreal fashion generation (no sketch).

Rules:
- Output ONLY valid JSON with keys: description, shirtColour, trouserColour, fabric, feedback (all strings; use "" if unused).
- Expand vague notes into a concrete modest Pakistani / South Asian women's outfit: silhouette, neckline, sleeve length, hem, embroidery if implied, colours, fabric.
- Background / setting requests → concrete real photographic locations that suit the dress.
- Pose / angle requests → concrete stances.
- Keep modest fashion catalogue tone. No objectifying language.
- Prefer short phrases suitable to append to an image prompt.
- For refine mode, put the change request mainly in "feedback".`;

function systemFor(input: PromptPolishInput): string {
  if (input.inputMode === "old-design") return SYSTEM_OLD_DESIGN;
  if (input.inputMode === "description") return SYSTEM_DESCRIPTION;
  return SYSTEM_SKETCH;
}

function buildUserPayload(input: PromptPolishInput): string {
  return JSON.stringify(
    {
      mode: input.mode,
      inputMode: input.inputMode ?? "sketch",
      description: input.description ?? "",
      shirtColour: input.shirtColour ?? "",
      trouserColour: input.trouserColour ?? "",
      fabric: input.fabric ?? "",
      feedback: input.feedback ?? "",
    },
    null,
    2,
  );
}

function parseJsonContent(raw: string): Partial<PromptPolishResult> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate) as Partial<PromptPolishResult>;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Partial<PromptPolishResult>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function pick(
  polished: string | undefined,
  original: string | undefined,
): string | undefined {
  const p = polished?.trim();
  if (p) return p;
  const o = original?.trim();
  return o || undefined;
}

/**
 * Returns polished fields. On missing key / API failure, falls back to the
 * original user text so generation never blocks on DeepSeek.
 */
export async function polishUserPrompt(
  input: PromptPolishInput,
): Promise<PromptPolishResult> {
  const fallback: PromptPolishResult = {
    description: input.description?.trim() || undefined,
    shirtColour: input.shirtColour?.trim() || undefined,
    trouserColour: input.trouserColour?.trim() || undefined,
    fabric: input.fabric?.trim() || undefined,
    feedback: input.feedback?.trim() || undefined,
    polished: false,
  };

  const hasText =
    fallback.description ||
    fallback.shirtColour ||
    fallback.trouserColour ||
    fallback.fabric ||
    fallback.feedback;

  if (!hasText) return fallback;
  if (!deepseekConfigured()) {
    return { ...fallback, error: "DEEPSEEK_API_KEY not set — using raw text." };
  }

  const model = getModel();
  const url = `${getBaseUrl()}/chat/completions`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemFor(input) },
          {
            role: "user",
            content: `Polish these fields for a sketch-to-photoreal fashion tool:\n${buildUserPayload(input)}`,
          },
        ],
        temperature: 0.3,
        // V4: keep non-thinking for speed/cost (ex deepseek-chat behaviour)
        thinking: { type: "disabled" },
      }),
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const errText = await res.text();
      return {
        ...fallback,
        error: `DeepSeek ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: DeepSeekMessage }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ...fallback, error: "DeepSeek returned empty content." };
    }

    const parsed = parseJsonContent(content);
    if (!parsed) {
      return { ...fallback, error: "DeepSeek returned non-JSON; using raw text." };
    }

    return {
      description: pick(parsed.description, input.description),
      shirtColour: pick(parsed.shirtColour, input.shirtColour),
      trouserColour: pick(parsed.trouserColour, input.trouserColour),
      fabric: pick(parsed.fabric, input.fabric),
      feedback: pick(parsed.feedback, input.feedback),
      polished: true,
      model,
    };
  } catch (err) {
    return {
      ...fallback,
      error: err instanceof Error ? err.message : "DeepSeek request failed.",
    };
  }
}
