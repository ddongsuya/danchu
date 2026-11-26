/**
 * 기관 CRM 사후 분석 (2026-11-26, 시안 v7). DB 접근 없음: 서버·화면·테스트가 함께 쓴다.
 *
 * 1) 견적 성과: 보낸 견적 → 선정 → 계약. 셈의 단위는 "견적을 보낸 안건"이다 (같은 안건에 2차·3차 견적을 보내도 한 건).
 *    - 보낸 견적: 견적서(cro_quote_docs)에 보낸 날이 있거나, 단추 요청에 견적을 낸 안건. 처음 보낸 날이 기간 안이면 그 기간의 건.
 *      안건에 묶지 않은 견적서는 한 장을 한 건으로 센다.
 *    - 선정: 수주한 안건, 또는 단추 요청에서 의뢰자가 우리 견적을 고른 안건 (그 뒤 계약하지 않았어도 선정은 선정).
 *    - 계약: 수주하고 계약 단계까지 간 안건, 또는 단추에 계약 체결로 보고한 안건.
 * 2) 고객사별·담당자별: 같은 셈을 고객사·고객 담당자로 나눈다 (담당자는 견적서의 받는 사람, 없으면 안건의 주 담당).
 * 3) 담당자 한 명의 기록: 고객사 화면에서 담당자를 고르면 그 사람과 주고받은 기록·견적·안건 일만 모은다.
 * 숫자는 기관 안에서만 본다. 단추의 요청 배포·비교표·청구에는 쓰지 않는다.
 */
import type { DanchuSrc } from "./crm-deals";
import { ymdKst, type CrmActivity, type CrmContact, type CrmDeal, type CrmQuote, type DealHistory } from "./crm-shape";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export type QuoteUnit = {
  key: string;
  dealId: string | null;
  companyId: string | null;
  contactId: string | null;
  /** 처음 보낸 시각 */
  sentAt: string;
  selected: boolean;
  contracted: boolean;
  /** 수주 금액 (수주한 안건만) */
  wonSum: number;
};
export type PerfRow = { id: string | null; sent: number; selected: number; contracted: number; wonSum: number; rate: number | null };
export type QuoteFunnel = {
  /** 기간 안에 보낸 견적서 장수 (2차·3차 포함) */
  docs: number;
  sent: number;
  selected: number;
  contracted: number;
  /** 선정 / 보낸 견적 */
  selectRate: number | null;
  /** 계약 / 선정 */
  contractRate: number | null;
  /** 계약 / 보낸 견적 */
  overallRate: number | null;
  byCompany: PerfRow[];
  byContact: (PerfRow & { companyId: string | null })[];
  units: QuoteUnit[];
};

type Deal = Pick<CrmDeal, "id" | "company_id" | "contact_ids" | "status" | "stage" | "won_amount" | "amount" | "owner" | "invite_id">;

/** 수주한 안건이 계약 단계까지 갔는지 (지금 단계 또는 이력) */
const reachedContract = (d: Deal, hist: Pick<DealHistory, "deal_id" | "to_stage">[]) => d.stage === "contract" || hist.some((h) => h.deal_id === d.id && h.to_stage === "contract");

export function dealOutcome(d: Deal, src: DanchuSrc | null, hist: Pick<DealHistory, "deal_id" | "to_stage">[]): { selected: boolean; contracted: boolean } {
  const won = d.status === "won";
  return {
    selected: won || !!src?.award,
    contracted: (won && reachedContract(d, hist)) || src?.award?.contractStatus === "signed",
  };
}

export function buildQuoteFunnel(a: {
  deals: Deal[]; history: Pick<DealHistory, "deal_id" | "to_stage">[]; quotes: Pick<CrmQuote, "id" | "deal_id" | "company_id" | "contact_id" | "sent_at">[];
  danchu: Map<string, DanchuSrc>; from: string; to: string; owner?: string | null;
}): QuoteFunnel {
  const inR = (iso: string) => { const d = ymdKst(iso); return d >= a.from && d <= a.to; };
  const dealBy = new Map(a.deals.map((d) => [d.id, d]));
  const okDeal = (d: Deal | undefined) => !!d && (!a.owner || d.owner === a.owner);
  const units = new Map<string, QuoteUnit>();
  const touch = (key: string, deal: Deal | null, at: string, companyId: string | null, contactId: string | null) => {
    const u = units.get(key);
    if (!u) {
      const src = deal?.invite_id ? a.danchu.get(deal.invite_id) ?? null : null;
      const o = deal ? dealOutcome(deal, src, a.history) : { selected: false, contracted: false };
      units.set(key, {
        key, dealId: deal?.id ?? null, companyId: deal?.company_id ?? companyId, contactId: contactId ?? deal?.contact_ids[0] ?? null, sentAt: at,
        ...o, wonSum: deal?.status === "won" ? deal.won_amount ?? deal.amount ?? 0 : 0,
      });
      return;
    }
    units.set(key, { ...u, sentAt: at < u.sentAt ? at : u.sentAt, contactId: u.contactId ?? contactId, companyId: u.companyId ?? companyId });
  };
  let docs = 0;
  for (const q of a.quotes) {
    if (!q.sent_at) continue;
    const deal = q.deal_id ? dealBy.get(q.deal_id) : undefined;
    if (a.owner && !okDeal(deal)) continue;
    if (inR(q.sent_at)) docs++;
    touch(deal ? deal.id : `q:${q.id}`, deal ?? null, q.sent_at, q.company_id, q.contact_id);
  }
  // 단추 요청에 낸 견적 (견적서를 따로 만들지 않았어도 보낸 견적)
  for (const d of a.deals) {
    if (!okDeal(d) || !d.invite_id) continue;
    const at = a.danchu.get(d.invite_id)?.quote?.firstSubmittedAt;
    if (at) touch(d.id, d, at, null, null);
  }
  const cohort = [...units.values()].filter((u) => inR(u.sentAt));
  const sum = (xs: QuoteUnit[]) => {
    const selected = xs.filter((u) => u.selected).length;
    return { sent: xs.length, selected, contracted: xs.filter((u) => u.contracted).length, wonSum: xs.reduce((s, u) => s + u.wonSum, 0), rate: pct(selected, xs.length) };
  };
  const groupBy = (k: (u: QuoteUnit) => string | null) => {
    const m = new Map<string | null, QuoteUnit[]>();
    for (const u of cohort) m.set(k(u), [...(m.get(k(u)) ?? []), u]);
    return [...m.entries()];
  };
  const order = (x: PerfRow, y: PerfRow) => (x.id === null ? 1 : 0) - (y.id === null ? 1 : 0) || y.sent - x.sent || y.wonSum - x.wonSum;
  const byCompany = groupBy((u) => u.companyId).map(([id, xs]) => ({ id, ...sum(xs) })).sort(order);
  const byContact = groupBy((u) => u.contactId).filter(([id]) => id !== null).map(([id, xs]) => ({ id, companyId: xs[0].companyId, ...sum(xs) })).sort(order);
  const t = sum(cohort);
  return {
    docs, sent: t.sent, selected: t.selected, contracted: t.contracted,
    selectRate: pct(t.selected, t.sent), contractRate: pct(t.contracted, t.selected), overallRate: pct(t.contracted, t.sent),
    byCompany, byContact, units: cohort,
  };
}

// ─── 고객 담당자 한 명 ───
export type ContactStat = { quotes: number; deals: number; open: number; won: number; lost: number; contracted: number; wonSum: number; lastAt: string | null };

/** 고객사 담당자마다: 보낸 견적서 · 안건(진행·수주·실패·계약) · 마지막 연락 */
export function contactStats(a: {
  contacts: Pick<CrmContact, "id">[]; deals: CrmDeal[]; quotes: Pick<CrmQuote, "contact_id" | "sent_at">[]; activities: Pick<CrmActivity, "contact_id" | "attendee_contacts" | "occurred_at">[];
  history: Pick<DealHistory, "deal_id" | "to_stage">[]; danchu: Map<string, DanchuSrc>;
}): Map<string, ContactStat> {
  const out = new Map<string, ContactStat>();
  for (const c of a.contacts) {
    const ds = a.deals.filter((d) => d.contact_ids.includes(c.id));
    const won = ds.filter((d) => d.status === "won");
    const last = a.activities.filter((x) => x.contact_id === c.id || x.attendee_contacts.includes(c.id)).reduce<string | null>((m, x) => (!m || x.occurred_at > m ? x.occurred_at : m), null);
    out.set(c.id, {
      quotes: a.quotes.filter((q) => q.contact_id === c.id && q.sent_at).length,
      deals: ds.length, open: ds.filter((d) => d.status === "open").length, won: won.length, lost: ds.filter((d) => d.status === "lost").length,
      contracted: ds.filter((d) => dealOutcome(d, d.invite_id ? a.danchu.get(d.invite_id) ?? null : null, a.history).contracted).length,
      wonSum: won.reduce((s, d) => s + (d.won_amount ?? d.amount ?? 0), 0),
      lastAt: last,
    });
  }
  return out;
}

/**
 * 담당자 한 명과의 일만 (고객사 화면의 담당자별 기록). 그 사람이 상대였거나 참석한 기록, 그 사람 앞으로 보낸 견적서,
 * 그 사람이 붙은 안건의 단계 이력·단추 일(받는 사람을 정하지 않은 그 안건 견적서 포함).
 */
export function forContact<A extends Pick<CrmActivity, "contact_id" | "attendee_contacts">, Q extends Pick<CrmQuote, "contact_id" | "deal_id">, D extends Pick<CrmDeal, "id" | "contact_ids">>(
  contactId: string, a: { activities: A[]; quotes: Q[]; deals: D[] },
): { activities: A[]; quotes: Q[]; deals: D[]; dealIds: Set<string> } {
  const deals = a.deals.filter((d) => d.contact_ids.includes(contactId));
  const dealIds = new Set(deals.map((d) => d.id));
  return {
    activities: a.activities.filter((x) => x.contact_id === contactId || x.attendee_contacts.includes(contactId)),
    quotes: a.quotes.filter((q) => q.contact_id === contactId || (!q.contact_id && !!q.deal_id && dealIds.has(q.deal_id))),
    deals,
    dealIds,
  };
}
