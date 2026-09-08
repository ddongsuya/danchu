import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { safeNext } from "@/lib/auth-links";
import { homeOf, type Role } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /auth/confirm?token_hash=…&type=magiclink|recovery&next=…
 * 메일의 버튼이 여기로 온다. 토큰을 세션으로 바꾸고(이메일 확인 포함) 역할별 홈으로 보낸다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash") || "";
  const type = (url.searchParams.get("type") || "magiclink") as EmailOtpType;
  const next = safeNext(url.searchParams.get("next"));
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, url.origin), 303);

  if (!tokenHash || !["magiclink", "recovery", "signup", "email"].includes(type)) return fail("link");
  const sb = await createSessionClient();
  const admin = getSupabaseAdmin();
  if (!sb || !admin) return fail("config");

  const { data, error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    console.error("[auth/confirm] verifyOtp 실패", { type, status: error?.status, code: error?.code, message: error?.message, hasUser: !!data?.user });
    return fail("expired");
  }
  console.info("[auth/confirm] ok", { type, user: data.user.id, email: data.user.email, confirmed: !!data.user.email_confirmed_at });

  if (type === "recovery") return NextResponse.redirect(new URL("/reset-password", url.origin), 303);

  // 로그인 전에 접수한 요청을 이 계정에 연결
  if (data.user.email) {
    await admin.rpc("claim_rfqs_by_email", { p_user: data.user.id, p_email: data.user.email }).then(({ error: e }) => {
      if (e) console.error("claim_rfqs_by_email", e);
    });
  }
  const { data: p } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const role = ((p?.role as Role) || "requester") as Role;
  return NextResponse.redirect(new URL(next || homeOf(role), url.origin), 303);
}
