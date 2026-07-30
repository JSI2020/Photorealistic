import { NextResponse } from "next/server";

import {
  COOKIE_NAME,
  createAuthToken,
  getSitePassword,
  isPasswordGateEnabled,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPasswordGateEnabled()) {
    return NextResponse.json({ ok: true, gate: false });
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password ?? "";

  if (password !== getSitePassword()) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createAuthToken(password);
  const res = NextResponse.json({ ok: true, gate: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
