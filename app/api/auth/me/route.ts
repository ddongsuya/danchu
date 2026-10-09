import { NextResponse } from "next/server";
import { getSession, homeOf } from "@/lib/auth";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 현재 로그인 사용자 요약 (클라이언트에서 이동 경로 결정용) */
export async function GET(req: Request) {
  // 비로그인 상태에서도 열려 있는 경로라 세션 조회(Auth 왕복)를 무한정 시키지 못하게 막는다
  if (await rateLimited("auth-me", clientIp(req), 120, 60)) return NextResponse.json({ ok: false }, { status: 429 });
  const s = await getSession();
  // 비로그인은 오류가 아니라 정상 상태 — 콘솔에 401이 찍히지 않게 200으로 돌려준다
  if (!s) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: true, role: s.profile.role, name: s.profile.name, email: s.email, to: homeOf(s.profile.role) });
}
