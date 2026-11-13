import { getSupabaseAdmin } from "./supabase";
import { comparisonOpened } from "./reply-window";
import { quoteRowsFromPayload } from "./quote-items";
import { croItems, partyLabels, qnaWindow, sponsorItems, type QnaItem, type QnaRow, type QnaTarget } from "./qna";
import type { RfqRow } from "./data";
import type { Values } from "./rfq-schema";

/** 요청서 시험 행 이름 (seq → 이름) */
export function testNames(payload: Values): Map<number, string> {
  return new Map(quoteRowsFromPayload(payload).map((r) => [r.seq, r.name]));
}

export function testOptions(payload: Values): { seq: number; name: string }[] {
  return quoteRowsFromPayload(payload).map((r) => ({ seq: r.seq, name: r.name }));
}

async function rowsOf(rfqId: string): Promise<QnaRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from("rfq_questions").select("*").eq("rfq_id", rfqId).order("created_at", { ascending: false });
  // 0045 를 적용하기 전 DB 에서는 빈 목록 (화면은 비어 보이고 보내기는 DB 함수가 없어 실패한다)
  if (error) {
    console.error("rfq_questions select", error.message);
    return [];
  }
  return (data ?? []) as QnaRow[];
}

async function selectedInvite(rfqId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_awards").select("invite_id").eq("rfq_id", rfqId).maybeSingle();
  return data?.invite_id ?? null;
}

export type SponsorQna = {
  items: QnaItem[];
  /** 의뢰자가 질의할 수 있는 기관 (비교표가 열린 뒤 견적을 낸 곳) */
  targets: QnaTarget[];
  canAsk: boolean;
  canAnswer: boolean;
  pending: number;
  replyBy: string | null;
  tests: { seq: number; name: string }[];
};

/** 의뢰자 화면 (요청 주인). 운영자가 열어도 같은 모양이지만 보내기는 DB 가 거절한다 */
export async function loadSponsorQna(rfq: RfqRow): Promise<SponsorQna> {
  const sb = getSupabaseAdmin()!;
  const [rows, sel, inv, qs] = await Promise.all([
    rowsOf(rfq.id),
    selectedInvite(rfq.id),
    sb.from("rfq_invites").select("id, cro_name, joined_at, sent_at, revoked_at").eq("rfq_id", rfq.id),
    sb.from("cro_quotes").select("invite_id").eq("rfq_id", rfq.id).eq("status", "submitted"),
  ]);
  const invites = inv.data ?? [];
  const named = comparisonOpened(rfq);
  const asked = new Set(rows.map((r) => r.invite_id));
  const labels = partyLabels(invites.filter((i) => !!i.joined_at || asked.has(i.id)), named);
  const quoted = new Set((qs.data ?? []).map((q) => q.invite_id));
  const w = qnaWindow(rfq);
  const targets = invites.filter((i) => quoted.has(i.id) && !i.revoked_at).map((i) => ({ inviteId: i.id, label: labels.get(i.id) ?? i.cro_name })).sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const items = sponsorItems(rows, { labels, selectedInviteId: sel, tests: testNames(rfq.payload) });
  return {
    items,
    targets: w.sponsorAsk ? targets : [],
    canAsk: w.sponsorAsk && targets.length > 0,
    canAnswer: w.answer,
    pending: items.filter((i) => i.toAnswer).length,
    replyBy: rfq.reply_by,
    tests: testOptions(rfq.payload),
  };
}

export type CroQna = {
  mine: QnaItem[];
  shared: QnaItem[];
  canAsk: boolean;
  canAnswer: boolean;
  pending: number;
  replyBy: string | null;
  tests: { seq: number; name: string }[];
};

/** 기관 화면 (참여한 초대만 부른다) */
export async function loadCroQna(inviteId: string, rfqId: string): Promise<CroQna | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: rfq } = await sb.from("rfq_requests").select("id, payload, compared_at, selected_quote_id, status, reply_by").eq("id", rfqId).maybeSingle();
  if (!rfq) return null;
  const [rows, sel] = await Promise.all([rowsOf(rfqId), selectedInvite(rfqId)]);
  const { mine, shared } = croItems(rows, { inviteId, selectedInviteId: sel, tests: testNames(rfq.payload as Values) });
  const w = qnaWindow(rfq);
  return {
    mine,
    shared,
    canAsk: w.croAsk,
    canAnswer: w.answer,
    pending: mine.filter((i) => i.toAnswer).length,
    replyBy: rfq.reply_by,
    tests: testOptions(rfq.payload as Values),
  };
}

/** 요청 화면 바로가기에 붙일 숫자: 의뢰자는 답할 기관 질의, 기관은 답할 의뢰자 질의 + 내 질의 수 */
export async function qnaCounts(rfqId: string, inviteId?: string): Promise<{ total: number; pending: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { total: 0, pending: 0 };
  let q = sb.from("rfq_questions").select("direction, answer, invite_id, scope").eq("rfq_id", rfqId);
  if (inviteId) q = q.or(`invite_id.eq.${inviteId},scope.eq.all`);
  const { data, error } = await q;
  if (error || !data) return { total: 0, pending: 0 };
  if (!inviteId) return { total: data.length, pending: data.filter((r) => r.direction === "cro" && r.answer == null).length };
  const mine = data.filter((r) => r.invite_id === inviteId);
  return { total: data.length, pending: mine.filter((r) => r.direction === "sponsor" && r.answer == null).length };
}
