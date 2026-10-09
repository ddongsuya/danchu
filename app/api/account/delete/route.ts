import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createSessionClient } from "@/lib/supabase-server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { deleteAccount } from "@/lib/account";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { captureError } from "@/lib/observe";

export const runtime = "nodejs";

/**
 * POST { confirm, password? } — 본인 계정 삭제(회원 탈퇴).
 * confirm 에 계정 이메일을 그대로 적어야 한다. 비밀번호를 쓰는 계정이면 비밀번호도 확인한다.
 * 진행 중인 요청은 취소하고, 요청서는 익명화한 뒤 계정을 지운다 (lib/account.ts).
 */
export async function POST(req: Request) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });
  if (await rateLimited("account-delete", s.userId, 5, 3600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { confirm?: unknown; password?: unknown };
  const confirm = typeof b.confirm === "string" ? b.confirm.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (confirm !== s.email.toLowerCase()) return NextResponse.json({ error: "확인을 위해 계정 이메일을 정확히 입력해 주세요." }, { status: 400 });

  if (password) {
    // 비밀번호가 주어졌으면 맞는지 본다. 세션을 건드리지 않도록 별도 익명 클라이언트로 확인한다
    const probe = createClient(supabaseUrl(), supabaseAnonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await probe.auth.signInWithPassword({ email: s.email, password });
    if (error) return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 400 });
  }

  try {
    const r = await deleteAccount(admin, s.userId, { actorId: s.userId, reason: "self" });
    if (!r.ok) {
      if (r.code === "admin") return NextResponse.json({ error: "운영자 계정은 탈퇴할 수 없습니다. 먼저 다른 운영자에게 역할 변경을 요청해 주세요." }, { status: 400 });
      if (r.code === "contracting") return NextResponse.json({ error: `기관을 선정한 요청(${r.contracting?.join(", ")})이 진행 중입니다. 계약이 끝나거나 운영자가 종료 처리한 뒤 탈퇴할 수 있습니다. hello@danchu.kr로 문의해 주세요.` }, { status: 409 });
      return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }
    const session = await createSessionClient();
    if (session) await session.auth.signOut({ scope: "local" }).catch(() => null);
    return NextResponse.json({ ok: true, cancelled: r.cancelled });
  } catch (e) {
    captureError(e, "account:delete", { user: s.userId });
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 났습니다. 잠시 후 다시 시도하거나 hello@danchu.kr로 알려 주세요." }, { status: 500 });
  }
}
