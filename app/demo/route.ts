import { NextResponse } from "next/server";
import { homeOf } from "@/lib/auth";
import { DEMO_COOKIE, demoEnabled, isDemoRole } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /demo?as=requester|cro|admin — 그 역할의 화면을 로그인 없이 연다 (개발 단계 임시 장치, lib/demo.ts).
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
    return res;
  }
  const res = NextResponse.redirect(new URL(homeOf(as), url.origin), 303);
  res.cookies.set(DEMO_COOKIE, as, { path: "/", httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 60 * 60 * 24 });
  return res;
}
