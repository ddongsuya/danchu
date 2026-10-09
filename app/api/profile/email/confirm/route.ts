import { NextResponse } from "next/server";
import { sessionOrNull, homeOf, type Role } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { mailWrap, sendMail } from "@/lib/mail";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { emailChangeValid } from "@/lib/email-change";
import { captureError } from "@/lib/observe";

export const runtime = "nodejs";

/**
 * POST (form) token — /auth/email-change 페이지의 버튼이 보낸다. 로그인된 본인 세션에서만 확인된다.
 * 성공하면 auth.users 와 profiles.email, 열린 요청의 연락 이메일을 함께 바꾼다.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") || "");
  const s = await sessionOrNull();
  if (!s) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/auth/email-change?token=${token}`)}`, url.origin), 303);
  const base = homeOf(s.profile.role as Role);
  const back = (notice: string) => NextResponse.redirect(new URL(`${base}/profile?notice=${notice}`, url.origin), 303);
  if (await rateLimited("email-confirm:ip", clientIp(req), 20, 900)) return back("email_expired");

  const sb = getSupabaseAdmin()!;
  const { data: p } = await sb.from("profiles").select("pending_email, pending_email_hash, pending_email_expires_at, email").eq("id", s.userId).maybeSingle();
  if (!p || !emailChangeValid(p, token)) return back("email_expired");
  const next = p.pending_email!;
  const { error } = await sb.auth.admin.updateUserById(s.userId, { email: next, email_confirm: true });
  if (error) {
    const dup = /already|exists|registered|duplicate/i.test(error.message);
    if (!dup) captureError(error, "email-change:auth");
    await sb.from("profiles").update({ pending_email: null, pending_email_hash: null, pending_email_expires_at: null }).eq("id", s.userId);
    return back(dup ? "email_taken" : "email_failed");
  }
  await sb.from("profiles").update({ email: next, pending_email: null, pending_email_hash: null, pending_email_expires_at: null }).eq("id", s.userId);
  // 진행 중인 요청의 연락 이메일도 따라간다 (종료·취소된 요청은 기록으로 둔다)
  await sb.from("rfq_requests").update({ email: next }).eq("user_id", s.userId).not("status", "in", "(closed,cancelled)");
  await sendMail({ to: p.email, subject: "[단추] 로그인 이메일이 변경되었습니다", html: mailWrap(`<h2 style="margin:0 0 12px;font-size:20px">로그인 이메일이 바뀌었습니다</h2><p>이제 이 계정은 <b>${next}</b> 로 로그인합니다. 본인이 한 변경이 아니라면 즉시 hello@danchu.kr 로 알려 주세요.</p>`) }).catch(() => false);
  return back("email_changed");
}
