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
  /** sketch = fidelity; old-design = restyle + new house model. */
  inputMode?: "sketch" | "old-design";
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
- Improve clarity of colour, fabric, embroidery, fit, mood, lighting — do not invent a new garment silhouette, neckline, sleeve length, or hem.
- If the user is vague ("make it nicer", "festive"), turn that into concrete, tasteful catalogue language (e.g. richer colour, subtle gold embroidery, warmer soft daylight) without redesigning the cut.
- Keep modest fashion catalogue tone. No objectifying language.
- Prefer short phrases suitable to append to an image prompt.
- Preserve the user's intent; do not contradict explicit colours they named.
- For refine mode, put the change request mainly in "feedback"; keep description as the stable garment summary if provided.`;

const SYSTEM_OLD_DESIGN = `You polish short, messy fashion notes for RESTYLING an old design PHOTO into a fresh catalogue shot on a NEW house model.

Rules:
- Output ONLY valid JSON with keys: description, shirtColour, trouserColour, fabric, feedback (all strings; use "" if unused).
- Keep the garment type and overall idea, but encourage a clear upgrade: richer colour, better fabric realism, cleaner embroidery, better fit, studio lighting.
- Vague asks like "a bit better" or "a bit different" MUST become concrete visual changes (e.g. deeper emerald, crisper lawn texture, slightly longer hem drape, warmer daylight) — not vague praise.
- Never ask to keep the original model's face or identity.
- Keep modest fashion catalogue tone. No objectifying language.
- Prefer short phrases suitable to append to an image prompt.
- For refine mode, put the change request mainly in "feedback".`;

function systemFor(input: PromptPolishInput): string {
  return input.inputMode === "old-design" ? SYSTEM_OLD_DESIGN : SYSTEM_SKETCH;
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
