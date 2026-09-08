import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EMAIL_RE, authErrorKo, safeNext } from "@/lib/auth-links";
import { homeOf, type Role } from "@/lib/auth";

export const runtime = "nodejs";

/** POST { email, password, next? } — 비밀번호 로그인. 세션 쿠키를 심고 이동할 경로를 돌려준다. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!EMAIL_RE.test(email) || !password) return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });

  const sb = await createSessionClient();
  const admin = getSupabaseAdmin();
  if (!sb || !admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: authErrorKo(error?.message) }, { status: 401 });

  const { data: p } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const role = ((p?.role as Role) || "requester") as Role;
  const next = safeNext(b.next);
  return NextResponse.json({ ok: true, to: next || homeOf(role) });
}
