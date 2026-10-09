import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EMAIL_RE, authErrorKo, safeNext } from "@/lib/auth-links";
import { homeOf, type Role } from "@/lib/auth";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST { email, password, next? } — 비밀번호 로그인. 세션 쿠키를 심고 이동할 경로를 돌려준다. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!EMAIL_RE.test(email) || !password) return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  if ((await rateLimited("login:email", email, 10, 15 * 60)) || (await rateLimited("login:ip", clientIp(req), 30, 15 * 60))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const sb = await createSessionClient();
  const admin = getSupabaseAdmin();
  if (!sb || !admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    console.warn("[auth/login] 실패", { status: error?.status, code: error?.code, message: error?.message });
    return NextResponse.json({ error: authErrorKo(error?.message) }, { status: 401 });
  }

  if (!data.user.email_confirmed_at) {
    // 대시보드의 "Confirm email" 이 꺼져 있어도 미확인 계정은 들이지 않는다
    await sb.auth.signOut({ scope: "local" }).catch(() => null);
    return NextResponse.json({ error: "이메일 확인이 끝나지 않았습니다. 받은 편지함의 확인 링크를 눌러 주세요." }, { status: 403 });
  }
  const { data: p } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const role = ((p?.role as Role) || "requester") as Role;
  const next = safeNext(b.next);
  return NextResponse.json({ ok: true, to: next || homeOf(role) });
}
