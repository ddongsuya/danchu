import { NextResponse } from "next/server";
import { homeOf } from "@/lib/auth";
import { DEMO_COOKIE, DEMO_PREREG_COOKIE, demoEnabled, isDemoRole } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /demo?as=requester|cro|admin — 그 역할의 화면을 로그인 없이 연다 (개발 단계 임시 장치, lib/demo.ts).
 * GET /demo?as=requester|cro&prereg=1 — 사전예약 기간의 새 계정이 보는 대기 화면으로 연다.
 * GET /demo?off=1 — 미리보기를 끝낸다.
 * 운영 배포에서는 404.
 */
export async function GET(req: Request) {
  if (!demoEnabled()) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const as = url.searchParams.get("as");
  if (url.searchParams.get("off") || !isDemoRole(as)) {
    const res = NextResponse.redirect(new URL("/", url.origin), 303);
    res.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(DEMO_PREREG_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  const res = NextResponse.redirect(new URL(homeOf(as), url.origin), 303);
  const opts = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: url.protocol === "https:", maxAge: 60 * 60 * 24 };
  res.cookies.set(DEMO_COOKIE, as, opts);
  if (url.searchParams.get("prereg") === "1") res.cookies.set(DEMO_PREREG_COOKIE, "1", opts);
  else res.cookies.set(DEMO_PREREG_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
