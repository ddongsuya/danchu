import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, demoPassword, demoToken, isOpenPath } from "@/lib/demo-gate";

/** /app 화면군은 데모 데이터(가상 견적·실존 기관명)를 담고 있어 비밀번호 뒤에 둔다 */
export async function proxy(req: NextRequest) {
  const pw = demoPassword();
  if (!pw) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();
  if (req.cookies.get(DEMO_COOKIE)?.value === (await demoToken(pw))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/app/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/app", "/app/:path*"] };
