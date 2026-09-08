import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

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

  if (!url || !anon) {
    // 인증 미설정: 보호 영역은 로그인 화면으로 (설정 안내가 그곳에 있다)
    if (needsAuth) return NextResponse.redirect(new URL("/login?error=config", req.url));
    return NextResponse.next();
  }

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

  if (needsAuth && !data.user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname + (req.nextUrl.search || ""));
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
