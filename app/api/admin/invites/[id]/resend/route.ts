import { NextResponse } from "next/server";
import { captureError } from "@/lib/observe";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { esc, mailWrap, sendMail } from "@/lib/mail";
import { inviteMailHtml, inviteMailSubject, inviteReplyTo, type InviteMailOpts } from "@/lib/distribute";
import { logEvent, siteUrl } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** 제출한 초대의 새 링크 안내 (담당자 제외 등으로 링크가 재발급된 뒤). 견적·기한은 그대로라 요청서 전체를 다시 보내지 않는다 */
function relinkMail(rfqNo: string, replyBy: string, token: string) {
  const link = `${siteUrl()}/q/${token}`;
  return {
    subject: `[단추] ${rfqNo} 회신 링크가 새로 발급되었습니다`,
    html: mailWrap(`<h2 style="margin:0 0 12px;font-size:20px">회신 링크가 새로 발급되었습니다 · ${esc(rfqNo)}</h2><p>기관 담당자 변경으로 이 요청의 회신 링크를 새로 만들었습니다. 이전 메일의 링크는 더 쓸 수 없습니다.<br>제출한 견적은 그대로 남아 있고, 비교표가 열리기 전이면 회신 기한(${esc(replyBy)}) 안에서 아래 링크로 보고 고칠 수 있습니다. 비교표가 열린 뒤에는 보기만 할 수 있습니다.</p><p><a href="${esc(link)}">${esc(link)}</a></p>`),
  };
}

/** 참여했지만 아직 제출하지 않은 초대의 회신 링크 안내 (0023). 이미 참여했으므로 "참여하기를 눌러 주세요" 안내를 다시 보내지 않는다 */
function joinedLinkMail(rfqNo: string, replyBy: string, token: string) {
  const link = `${siteUrl()}/q/${token}`;
  return {
    subject: `[단추] ${rfqNo} 참여하신 요청의 회신 링크를 다시 보내 드립니다`,
    html: mailWrap(`<h2 style="margin:0 0 12px;font-size:20px">회신 링크를 다시 보내 드립니다 · ${esc(rfqNo)}</h2><p>이 요청에는 이미 참여하셨습니다. 아래 링크에서 요청서 전체를 보고 견적을 작성하거나 이어서 작성할 수 있습니다.<br>회신 기한은 ${esc(replyBy)}입니다. 제출 전에는 언제든 참여를 철회할 수 있고, 철회하면 청구하지 않습니다.</p><p><a href="${esc(link)}">${esc(link)}</a></p>`),
  };
}

/**
 * POST — 배포 메일을 다시 보낸다 (메일 유실·담당자 변경 때). 열린 초대(sent·draft)와 제출한 초대(submitted).
 * 담당자 제외·이동·삭제나 기관 중지로 토큰이 재발급되면(0021) 제출한 기관도 새 링크가 필요하다. 토큰은 여기서 바꾸지 않는다.
 * 받는 사람: 기관 초대는 지금의 기관 대표 메일(cro_orgs.contact_email)만. 옛 초대의 cro_email 로는 보내지 않는다 (내보낸 담당자 주소일 수 있다).
 * 메일이 실패해도 토큰을 되돌리지 않는다. 다시 보내면 된다.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (await rateLimited("invite-resend", id, 3, 3600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const sb = getSupabaseAdmin()!;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("id", id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "전달 기록을 찾을 수 없습니다." }, { status: 404 });
  if (inv.revoked_at) return NextResponse.json({ error: "운영자가 거둔 초대입니다. 다시 보낼 수 없습니다." }, { status: 409 });
  if (!["sent", "draft", "submitted"].includes(inv.status)) return NextResponse.json({ error: "불참·철회했거나 닫힌 초대에는 다시 보낼 수 없습니다." }, { status: 409 });
  const { data: rfq } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  // 비교표가 열린 요청은 기한을 늘릴 수 없으니 "늘린 뒤 다시 보내라"고 안내하지 않는다 (2026-10-21 결정 3)
  if (new Date(inv.expires_at).getTime() < Date.now()) return NextResponse.json({ error: rfq.compared_at ? "비교표가 열린 요청이라 만료된 링크를 다시 열 수 없습니다." : "회신 링크가 만료되었습니다. 회신 기한을 늘린 뒤 다시 보내 주세요." }, { status: 409 });

  // 기관 초대는 지금의 기관 대표 메일로만 보낸다. 초대 행의 주소도 맞춰 둔다
  const { data: org } = inv.cro_org_id ? await sb.from("cro_orgs").select("contact_email, managed, status").eq("id", inv.cro_org_id).maybeSingle() : { data: null };
  if (inv.cro_org_id && org?.status !== "approved") return NextResponse.json({ error: "참여가 중지된 기관에는 다시 보낼 수 없습니다." }, { status: 409 });
  const to = (inv.cro_org_id ? org?.contact_email ?? "" : inv.cro_email).trim();
  if (!to) return NextResponse.json({ error: "기관 대표 메일이 없습니다. 기관 정보에서 대표 메일을 먼저 확인해 주세요." }, { status: 409 });
  const { count: members } = inv.cro_org_id ? await sb.from("profiles").select("id", { count: "exact", head: true }).eq("cro_org_id", inv.cro_org_id) : { count: 0 };
  const mailOpts: InviteMailOpts = { managed: !!org?.managed, members: members ?? 0 };
  // 제출함 → 새 링크 안내, 참여함(작성 전·작성 중) → 회신 링크 안내, 참여 결정 전 → 참여 안내 (0023)
  const mail = inv.status === "submitted"
    ? relinkMail(inv.rfq_no, inv.reply_by, inv.token)
    : inv.joined_at
      ? joinedLinkMail(inv.rfq_no, inv.reply_by, inv.token)
      : { subject: inviteMailSubject(rfq, inv.reply_by), html: inviteMailHtml(rfq, inv.reply_by, inv.token, inv.id, mailOpts) };
  const ok = await sendMail({ to: [to], subject: mail.subject, html: mail.html, replyTo: inviteReplyTo(mailOpts) }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "메일을 보내지 못했습니다. 메일 설정(RESEND_API_KEY)을 확인해 주세요." }, { status: 502 });
  // 메일은 이미 갔으므로 실패로 돌리지 않는다. 기록 갱신 오류는 따로 남긴다 (mailed_at 이 비면 cron 이 한 번 더 보낼 수 있다)
  const { error: markError } = await sb.from("rfq_invites").update({ mailed_at: new Date().toISOString(), cro_email: to }).eq("id", id);
  if (markError) captureError(markError, "invite-resend:mark", { invite: id });
  await logEvent(inv.rfq_id, "resend", `${inv.cro_name} 배포 메일 재발송`, to, s.userId, { inviteId: id });
  await audit({ userId: s.userId, email: s.email }, "invite.resend", { type: "rfq_invite", id, label: `${inv.rfq_no} · ${inv.cro_name}` }, { after: { to } });
  return NextResponse.json({ ok: true, message: `${to} 로 다시 보냈습니다.` });
}
