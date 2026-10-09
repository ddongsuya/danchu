import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sb = await createSessionClient();
  // local: 이 브라우저의 세션만 끝낸다. 같은 계정으로 로그인한 다른 기기(동료 공용 계정 등)는 그대로 둔다
  if (sb) await sb.auth.signOut({ scope: "local" });
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) return NextResponse.redirect(new URL("/login", req.url), 303);
  return NextResponse.json({ ok: true });
}
