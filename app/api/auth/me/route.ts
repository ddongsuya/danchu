import { NextResponse } from "next/server";
import { getSession, homeOf } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 현재 로그인 사용자 요약 (클라이언트에서 이동 경로 결정용) */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, role: s.profile.role, name: s.profile.name, email: s.email, to: homeOf(s.profile.role) });
}
