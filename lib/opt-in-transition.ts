import type { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import { joinDeadline } from "./request-policy";
import { inviteMailHtml, inviteMailSubject, inviteMailTo, inviteReplyTo, orgMailTargets, type InviteMailOpts } from "./distribute";
import { sendMail } from "./mail";
import { notificationRecipients } from "./mail-preferences";
import { logEvent } from "./notify";
import { assertSchemaReady } from "./schema-version";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * 참여 선택형 전환 (설계 5절 4단계). 0023 을 적용한 뒤 운영자가 한 번 실행한다. 마이그레이션은 메일을 보내지 않는다.
 *
 * 대상: 새 코드 전에 안내가 나간 열린 요청. 새 코드는 접수할 때와 처음 안내할 때 참여 결정 기한(join_by)을 반드시 채우므로
 * join_by 가 비어 있고, 배포·견적 도착 상태이며, 회신 마감·선정 전이고, 회신 기한이 오늘 이후인 요청이 전환 대상이다.
 *
 * 요청마다
 * 1) join_by 를 오늘 기준 참여 결정 기한으로 채운다 (조건부 갱신, join_by 가 아직 비어 있을 때만). 채우면 그 요청은 다시 대상이 되지 않는다.
 *    0023 의 join_offer 는 join_by 안에서는 "회신 기한 3영업일 전" 마감을 적용하지 않으므로, 회신 기한이 가까운 예전 요청에서도
 *    아직 결정하지 않은 기관이 참여할 수 있다. 지명 기관 몫 예약과 cron 의 참여 결정 기한 처리도 이 기한부터 동작한다
 * 2) 운영자 관리 기관(계정 없음, 메일 링크로만 들어오는 기관)의 아직 결정하지 않은 안내에 참여 안내 메일을 다시 보낸다.
 *    예전 메일은 "견적 요청"이었고 PDF 를 메일로 보내면 운영자가 옮겨 적는다고 안내했다. 이제는 기관이 먼저 참여해야 하므로
 *    "앞서 견적 요청으로 안내드린 요청" 한 줄을 붙인 새 안내를 보낸다. 토큰과 링크는 그대로다
 * 계정이 있는 기관은 포털 목록과 기존 링크에서 참여 화면을 바로 보므로 메일을 다시 보내지 않는다 (설계 5절 4단계는 관리 기관만).
 * 작성 중·제출 초대는 0023 이 legacy 참여로 바꿔 두었으므로 건드리지 않는다.
 */

export const TRANSITION_EVENT = "opt_in_transition";

export type TransitionOffer = { inviteId: string; croName: string; to: string[] };
export type TransitionTarget = { rfqId: string; rfqNo: string; replyBy: string; joinBy: string; offers: TransitionOffer[] };
export type TransitionPlan = { requests: TransitionTarget[]; offers: number };
export type TransitionResult = {
  /** join_by 를 채운 요청 수 */
  requests: number;
  /** 다시 보낸 관리 기관 안내 수 */
  mailed: number;
  /** 보내지 못한 안내 (요청 번호 · 기관 이름 · 이유). 요청 화면의 "메일 재발송"으로 하나씩 다시 보낸다 */
  failed: string[];
  /** 그 사이 다른 운영자가 먼저 처리했거나 상태가 바뀌어 건너뛴 요청 번호 */
  skipped: string[];
};

const OFFER_COLUMNS = "id, token, cro_org_id, cro_name, cro_email, reply_by";

/** 전환 대상 요청 (위 설명의 조건). today 는 서울 날짜 YYYY-MM-DD */
export async function legacyOpenRequests(sb: Admin, today: string): Promise<RfqRow[]> {
  const { data, error } = await sb
    .from("rfq_requests")
    .select("*")
    .is("join_by", null)
    .in("status", ["distributed", "quoted"])
    .is("compared_at", null)
    .is("selected_quote_id", null)
    .gte("reply_by", today)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`전환 대상 요청을 읽지 못했습니다: ${error.message}`);
  return data ?? [];
}

/** 요청 하나에서 메일을 다시 보낼 관리 기관 안내: 참여 결정 전(sent, 참여 기록 없음), 취소·철회 아님, 링크 만료 전, 승인된 관리 기관 */
async function managedOffers(sb: Admin, rfqId: string, nowIso: string) {
  const { data: invs, error } = await sb
    .from("rfq_invites")
    .select(OFFER_COLUMNS)
    .eq("rfq_id", rfqId)
    .eq("status", "sent")
    .is("joined_at", null)
    .is("revoked_at", null)
    .is("withdrawn_at", null)
    .gt("expires_at", nowIso);
  if (error) throw new Error(`안내 목록을 읽지 못했습니다: ${error.message}`);
  const orgIds = [...new Set((invs ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x))];
  if (!orgIds.length) return [];
  const { data: orgs, error: orgError } = await sb.from("cro_orgs").select("id, managed, status").in("id", orgIds);
  if (orgError) throw new Error(`기관 정보를 읽지 못했습니다: ${orgError.message}`);
  const managed = new Set((orgs ?? []).filter((o) => o.managed && o.status === "approved").map((o) => o.id));
  const targets = await orgMailTargets(sb, [...managed]);
  return (invs ?? [])
    .filter((i) => i.cro_org_id && managed.has(i.cro_org_id))
    .map((i) => {
      const t = targets.get(i.cro_org_id!);
      return { inv: i, to: inviteMailTo(i, t), members: t?.members.length ?? 0 };
    });
}

/** 미리 보기: 무엇을 바꾸고 누구에게 보낼지. 아무것도 쓰지 않는다 */
export async function planOptInTransition(sb: Admin, today: string, now = new Date()): Promise<TransitionPlan> {
  const rfqs = await legacyOpenRequests(sb, today);
  const out: TransitionPlan = { requests: [], offers: 0 };
  for (const r of rfqs) {
    const offers = await managedOffers(sb, r.id, now.toISOString());
    out.requests.push({
      rfqId: r.id,
      rfqNo: r.rfq_no,
      replyBy: r.reply_by ?? "",
      joinBy: joinDeadline(today, r.reply_by),
      offers: offers.map((o) => ({ inviteId: o.inv.id, croName: o.inv.cro_name, to: o.to })),
    });
    out.offers += offers.length;
  }
  return out;
}

/** 실행. 요청마다 join_by 를 채운 뒤 관리 기관에 안내를 다시 보낸다. 같은 요청을 두 번 처리하지 않는다 (join_by 조건부 갱신) */
export async function runOptInTransition(sb: Admin, actorId: string | null, today: string, now = new Date()): Promise<TransitionResult> {
  await assertSchemaReady(sb);
  const out: TransitionResult = { requests: 0, mailed: 0, failed: [], skipped: [] };
  const rfqs = await legacyOpenRequests(sb, today);
  for (const r of rfqs) {
    const jb = joinDeadline(today, r.reply_by);
    const { data: moved, error } = await sb
      .from("rfq_requests")
      .update({ join_by: jb })
      .eq("id", r.id)
      .is("join_by", null)
      .is("compared_at", null)
      .is("selected_quote_id", null)
      .select("id");
    if (error) {
      out.failed.push(`${r.rfq_no} · 참여 결정 기한 저장 실패`);
      continue;
    }
    if (!moved?.length) {
      out.skipped.push(r.rfq_no);
      continue;
    }
    out.requests++;
    const rfq: RfqRow = { ...r, join_by: jb };
    const mailedIds: string[] = [];
    const failedIds: string[] = [];
    let offers: Awaited<ReturnType<typeof managedOffers>> = [];
    try {
      offers = await managedOffers(sb, r.id, now.toISOString());
    } catch (e) {
      out.failed.push(`${r.rfq_no} · ${e instanceof Error ? e.message : "안내 목록을 읽지 못했습니다"}`);
    }
    for (const o of offers) {
      const mailTo = await notificationRecipients(o.to);
      if (!mailTo.length) {
        out.failed.push(`${r.rfq_no} · ${o.inv.cro_name} · 대표 메일 없음`);
        failedIds.push(o.inv.id);
        continue;
      }
      const opts: InviteMailOpts = { managed: true, members: o.members, transition: true };
      const ok = await sendMail({ to: mailTo, subject: inviteMailSubject(rfq, o.inv.reply_by), html: inviteMailHtml(rfq, o.inv.reply_by, o.inv.token, o.inv.id, opts), replyTo: inviteReplyTo(opts) }).catch(() => false);
      if (!ok) {
        out.failed.push(`${r.rfq_no} · ${o.inv.cro_name} · 메일 발송 실패`);
        failedIds.push(o.inv.id);
        continue;
      }
      out.mailed++;
      mailedIds.push(o.inv.id);
      await sb.from("rfq_invites").update({ mailed_at: new Date().toISOString() }).eq("id", o.inv.id);
      await logEvent(r.id, "resend", `${o.inv.cro_name} 참여 안내 다시 보냄 (참여 선택형 전환)`, mailTo.join(", "), actorId, { inviteId: o.inv.id, transition: true });
    }
    const jbDay = new Date(jb).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    await logEvent(r.id, TRANSITION_EVENT, "참여 선택형으로 전환", `참여 결정 기한 ${jbDay} · 관리 기관 ${mailedIds.length}곳에 참여 안내 다시 보냄${failedIds.length ? ` · 못 보낸 곳 ${failedIds.length}곳` : ""}`, actorId, { joinBy: jb, mailed: mailedIds, failed: failedIds });
  }
  return out;
}
