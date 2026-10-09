import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { safeNext } from "@/lib/auth-links";
import { homeOf, type Role } from "@/lib/auth";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST (form) token_hash, type, next — /auth/confirm 페이지의 버튼이 보낸다.
 * 여기서만 토큰을 세션으로 바꾼다(이메일 확인 포함). GET 으로는 열리지 않는다.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, url.origin), 303);
  if (await rateLimited("confirm:ip", clientIp(req), 30, 15 * 60)) return fail("expired");

  const form = await req.formData().catch(() => null);
  const tokenHash = String(form?.get("token_hash") || "");
  const type = String(form?.get("type") || "magiclink") as EmailOtpType;
  const next = safeNext(form?.get("next"));
  if (!tokenHash || !["magiclink", "recovery", "signup", "email"].includes(type)) return fail("link");

  const sb = await createSessionClient();
  const admin = getSupabaseAdmin();
  if (!sb || !admin) return fail("config");

  const { data, error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    console.error("[auth/confirm] verifyOtp 실패", { type, status: error?.status, code: error?.code, message: error?.message });
    return fail("expired");
  }

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
