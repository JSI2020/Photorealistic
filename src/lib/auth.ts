const COOKIE_NAME = "photoreal_auth";

export function isPasswordGateEnabled(): boolean {
  return Boolean(process.env.SITE_PASSWORD?.trim());
}

export function getSitePassword(): string {
  return process.env.SITE_PASSWORD?.trim() ?? "";
}

function authSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.SITE_PASSWORD?.trim() ||
    "dev-only-change-me"
  );
}

/** Edge + Node compatible token (Web Crypto). */
export async function createAuthToken(password: string): Promise<string> {
  const payload = `${password}::${authSecret()}`;
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAuthToken(
  token: string | undefined,
): Promise<boolean> {
  if (!isPasswordGateEnabled()) return true;
  if (!token) return false;
  const expected = await createAuthToken(getSitePassword());
  if (token.length !== expected.length) return false;
  let ok = true;
  for (let i = 0; i < token.length; i++) {
    if (token[i] !== expected[i]) ok = false;
  }
  return ok;
}

export { COOKIE_NAME };
