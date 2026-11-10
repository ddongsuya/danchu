import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { DEMO_COOKIE, DEMO_READONLY, demoEnabled, isDemoRole } from "@/lib/demo";
import { CROSS_SITE, crossSiteWrite } from "@/lib/origin";

/**
 * 세션 갱신 + 보호 영역 접근 제어.
 * - /app, /cro, /admin: 로그인 필요. 역할 검사는 각 layout이 프로필을 보고 한다.
 * - 토큰 링크(/q/*)와 공개 화면은 그대로 통과.
 */
const PROTECTED = [/^\/app(\/|$)/, /^\/cro(\/|$)/, /^\/admin(\/|$)/];

export async function proxy(req: NextRequest) {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((re) => re.test(pathname));

  // 다른 사이트에서 보낸 변경 요청은 쿠키가 붙었든 아니든 받지 않는다 (SameSite 쿠키에 더한 두 번째 방어선)
  if (pathname.startsWith("/api/") && crossSiteWrite(req.method, req.headers.get("origin"), [req.headers.get("host"), req.headers.get("x-forwarded-host"), req.nextUrl.host])) {
    return NextResponse.json({ error: CROSS_SITE }, { status: 403 });
  }

  if (!url || !anon) {
    // 인증 미설정: 보호 영역은 로그인 화면으로 (설정 안내가 그곳에 있다)
    if (needsAuth) return NextResponse.redirect(new URL("/login?error=config", req.url));
    return NextResponse.next();
  }

  // 세션 쿠키가 없는 공개 페이지·API 요청은 Auth 서버를 부르지 않는다 (랜딩 LCP, Auth 호출 한도)
  const hasSession = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  // 개발 단계 미리보기 (lib/demo.ts): 로그인 없이 보호 영역을 열되, 쓰기 API 는 막는다 (로그아웃은 미리보기를 끝내므로 둔다)
  if (!hasSession && demoEnabled() && isDemoRole(req.cookies.get(DEMO_COOKIE)?.value)) {
    if (pathname.startsWith("/api/") && req.method !== "GET" && pathname !== "/api/auth/logout") {
      return NextResponse.json({ error: DEMO_READONLY }, { status: 403 });
    }
    return NextResponse.next();
  }
  if (!hasSession && !needsAuth) return NextResponse.next();
  // 세션 쿠키가 없는 보호 영역은 Auth 서버를 부를 필요도 없다
  if (!hasSession) return redirectGuest(req);

  let res = NextResponse.next({ request: req });
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  // getUser()가 만료된 액세스 토큰을 갱신하고 쿠키를 다시 써 준다
  const { data } = await sb.auth.getUser();

  if (needsAuth && !data.user) return redirectGuest(req);
  return res;
}

/**
 * 로그인 전 방문자.
 * - 견적 요청(/app/new): 로그인 없이 쓰는 공개 요청서(/request/new)로. 가입은 보내기 직전에 그 화면에서 한다
 * - 나머지 보호 영역: 로그인으로
 */
function redirectGuest(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/app/new") {
    return NextResponse.redirect(new URL(`/request/new${search || ""}`, req.url));
  }
  const to = new URL("/login", req.url);
  to.searchParams.set("next", pathname + (search || ""));
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
