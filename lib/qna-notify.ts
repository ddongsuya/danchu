import { getSupabaseAdmin } from "./supabase";
import { notifyUsers } from "./notify";
import { inviteMailTo, inviteReplyTo, orgMailTargets } from "./distribute";
import { replyPath } from "./concierge";
import { maskedText } from "./contact-guard";

/**
 * 질의응답 알림 (0045). 앱 알림 + 메일만 보낸다 (문자 없음, 2026-11-13 결정 3).
 * 메일 본문의 글은 선정 전이면 연락처를 가린 글이다. 기관마다 따로 보내 다른 기관 주소가 함께 보이지 않게 한다.
 */

type Rfq = { id: string; rfq_no: string; substance: string; user_id: string | null; email: string };

/** 의뢰자에게 */
export async function notifySponsor(rfq: Rfq, n: { title: string; body: string; questionId: string }): Promise<void> {
  if (!rfq.user_id) return;
  await notifyUsers([rfq.user_id], { kind: "견적", title: n.title, body: n.body, href: `/app/r/${rfq.rfq_no}/qna?q=${n.questionId}` }, { to: [rfq.email] }).catch((e) => console.error("qna notify sponsor", e));
}

/** 기관들에게 (초대마다 따로). title·body 는 초대마다 다를 수 있다 */
export async function notifyInvites(inviteIds: string[], n: (inviteId: string) => { title: string; body: string; questionId: string }): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !inviteIds.length) return;
  const { data: invites } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email").in("id", inviteIds);
  const mail = await orgMailTargets(sb, (invites ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x));
  for (const i of invites ?? []) {
    const t = i.cro_org_id ? mail.get(i.cro_org_id) : undefined;
    const members = t?.members ?? [];
    const managed = !!t?.managed;
    const m = n(i.id);
    await notifyUsers(
      members.map((x) => x.id),
      { kind: "견적", title: m.title, body: m.body, href: `${replyPath(i, { managed, members: members.length })}/qna?q=${m.questionId}` },
      { to: inviteMailTo(i, t), replyTo: inviteReplyTo({ managed }) },
    ).catch((e) => console.error("qna notify cro", e));
  }
}

/** 공개 답변을 받을 기관: 참여 중인 다른 기관 (철회·불참·취소 제외) */
export async function otherJoinedInvites(rfqId: string, exceptInviteId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("rfq_invites").select("id, joined_at, withdrawn_at, revoked_at, status").eq("rfq_id", rfqId);
  return (data ?? []).filter((i) => i.id !== exceptInviteId && !!i.joined_at && !i.withdrawn_at && !i.revoked_at && i.status !== "declined").map((i) => i.id);
}

/** 알림 본문용 짧은 글 (연락처 가림, 200자) */
export function snippet(text: string): string {
  const t = maskedText(text).replace(/\s+/g, " ").trim();
  return t.length > 200 ? `${t.slice(0, 199)}…` : t;
}
