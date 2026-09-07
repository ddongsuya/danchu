import { NextResponse } from "next/server";
import { DEMO_COOKIE, demoPassword, demoToken } from "@/lib/demo-gate";

export const runtime = "nodejs";

/** POST { password } — 맞으면 30일 쿠키를 심는다. 비밀번호가 설정되지 않은 환경은 항상 통과. */
export async function POST(req: Request) {
  const pw = demoPassword();
  if (!pw) return NextResponse.json({ ok: true, gated: false });

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const given = typeof body.password === "string" ? body.password : "";
  if (!given || given !== pw) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, gated: true });
  res.cookies.set(DEMO_COOKIE, await demoToken(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/app",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
