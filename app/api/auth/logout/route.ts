import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";
import { DEMO_COOKIE } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sb = await createSessionClient();
  // local: 이 브라우저의 세션만 끝낸다. 같은 계정으로 로그인한 다른 기기(동료 공용 계정 등)는 그대로 둔다
  if (sb) await sb.auth.signOut({ scope: "local" });
  const accept = req.headers.get("accept") || "";
  const res = accept.includes("text/html") ? NextResponse.redirect(new URL("/login", req.url), 303) : NextResponse.json({ ok: true });
  // 미리보기(lib/demo.ts) 중이었다면 그 쿠키도 지운다
  res.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
