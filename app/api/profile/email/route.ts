import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EMAIL_RE } from "@/lib/auth-links";
import { esc, mailWrap, sendMail } from "@/lib/mail";
import { siteUrl } from "@/lib/notify";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { EMAIL_CHANGE_TTL_MS, hashEmailChangeToken, newEmailChangeToken } from "@/lib/email-change";
import { likeExact, orValue } from "@/lib/sql";

export const runtime = "nodejs";

/**
 * POST { email } — 로그인 이메일 변경 요청. 새 주소로 확인 링크를 보내고, 옛 주소에는 요청 사실을 알린다.
 * 확인 전까지는 아무것도 바뀌지 않는다. 가입 여부는 응답으로 드러내지 않는다 (같은 안내로 끝낸다).
 */
export async function POST(req: Request) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (await rateLimited("email-change", s.userId, 3, 3600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 200) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  if (email === s.email.toLowerCase()) return NextResponse.json({ error: "지금 쓰는 주소와 같습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const token = newEmailChangeToken();
  const expires = new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString();
  const { error } = await sb.from("profiles").update({ pending_email: email, pending_email_hash: hashEmailChangeToken(token), pending_email_expires_at: expires }).eq("id", s.userId);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  // 이미 다른 계정이 쓰는 주소면 확인 메일 대신 그 주소로 안내만 보낸다 (주소 사용 여부를 요청자에게 알리지 않는다)
  const { data: taken } = await sb.from("profiles").select("id").ilike("email", orValue(likeExact(email))).neq("id", s.userId).maybeSingle();
  const link = `${siteUrl()}/auth/email-change?token=${token}`;
  const html = taken
    ? mailWrap(`<h2 style="margin:0 0 12px;font-size:20px">이미 가입된 주소입니다</h2><p>누군가 단추 계정의 로그인 이메일을 이 주소(${esc(email)})로 바꾸려 했지만, 이 주소는 이미 다른 계정에서 쓰고 있습니다. 본인이라면 그 계정으로 로그인하세요. 요청하지 않았다면 이 메일은 무시해도 됩니다.</p>`)
    : mailWrap(`<h2 style="margin:0 0 12px;font-size:20px">로그인 이메일을 바꿉니다</h2><p>아래 버튼을 누르면 단추 로그인 이메일이 <b>${esc(s.email)}</b> 에서 <b>${esc(email)}</b> 로 바뀝니다. 링크는 1시간 동안 유효합니다. 요청하지 않았다면 이 메일은 무시하세요.</p><p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#2A55A5;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600;font-size:15px">이메일 변경 확인</a></p><p style="font-size:13px;color:#6F6A63">버튼이 열리지 않으면 이 주소를 복사해 브라우저에 붙여 넣으세요.<br><span style="word-break:break-all">${esc(link)}</span></p>`);
  const ok = await sendMail({ to: email, subject: "[단추] 로그인 이메일 변경 확인", html });
  if (!ok) {
    await sb.from("profiles").update({ pending_email: null, pending_email_hash: null, pending_email_expires_at: null }).eq("id", s.userId);
    return NextResponse.json({ error: "확인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  await sendMail({ to: s.email, subject: "[단추] 로그인 이메일 변경 요청", html: mailWrap(`<h2 style="margin:0 0 12px;font-size:20px">이메일 변경이 요청되었습니다</h2><p>단추 계정의 로그인 이메일을 다른 주소로 바꾸는 요청이 있었습니다. 새 주소에서 확인하기 전까지는 바뀌지 않습니다. 본인이 요청하지 않았다면 프로필에서 요청을 취소하고 비밀번호를 바꿔 주세요.</p>`) }).catch(() => false);
  return NextResponse.json({ ok: true, message: `${email} 로 확인 메일을 보냈습니다. 1시간 안에 메일의 버튼을 눌러 주세요.` });
}

/** DELETE — 대기 중인 변경 요청 취소 */
export async function DELETE() {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  await getSupabaseAdmin()!.from("profiles").update({ pending_email: null, pending_email_hash: null, pending_email_expires_at: null }).eq("id", s.userId);
  return NextResponse.json({ ok: true });
}
