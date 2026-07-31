/**
 * Safely read JSON from a fetch Response.
 * Render free-tier crashes often return empty bodies → "Unexpected end of JSON input".
 */
export async function readJsonSafe<T = unknown>(
  res: Response,
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: res.ok
        ? "Server returned an empty response. The app may have run out of memory — retry in a moment."
        : `Server error (${res.status}) with empty body — the Render process likely crashed or was killed mid-request (not a missing API key). Check Render → Events for exit 139/137, wait for recover, unlock again, then retry.`,
    };
  }

  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error:
          (typeof data === "object" && data && "error" in data && data.error) ||
          `Request failed (${res.status})`,
      };
    }
    return { ok: true, status: res.status, data, error: null };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: `Invalid server response (${res.status}): ${text.slice(0, 160)}`,
    };
  }
}

/** Friendlier message when the browser cannot reach Render at all. */
export function networkErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "Could not reach the server. Render free apps sleep after idle — wait about a minute, refresh, unlock again (847291), then retry. Also confirm FAL_KEY is set in Render → Environment.";
  }
  return msg || "Request failed.";
}

export async function fetchSafe(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}
