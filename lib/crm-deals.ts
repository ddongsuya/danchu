/**
 * 기관 CRM 안건 규칙 (2026-11-07, 0038, 시안 v5). DB 접근 없음: 서버·화면·테스트가 함께 쓴다.
 *
 * 1) 단계: 문의 → 견적 → 협의 → 접수 → 계약. 끝은 수주·실패 (status). 기관은 어느 쪽으로든 옮길 수 있다.
 * 2) 단추 요청은 기관이 참여하면 안건이 되고, 단추에서 일어난 일이 안건을 "앞으로만" 옮긴다:
 *    참여 → 문의, 견적 제출 → 견적(금액), 선정 → 협의(고객사·담당자 공개), 계약 보고 → 수주(계약 금액),
 *    다른 기관 선정 → 실패 "다른 기관 선정". 이미 끝난 안건(수주·실패)은 건드리지 않는다.
 *    실패에는 다른 기관의 이름·금액을 넣지 않는다.
 * 3) 단추 이벤트 기록은 저장하지 않고 화면에서 합친다 (단계 이력만 남긴다).
 * 4) CRM 데이터는 기관만 본다. 단추의 전달 순서·비교표·노출·청구에 쓰지 않는다.
 */
import { identityVisible } from "./request-policy";
import { inviteStage } from "./status";
import { clientKeyOf } from "./pipeline";
import {
  addDaysYmd, dLabel, hmKst, mondayOf, normName, todayKst, wonKo, ymdKst, companyKeys, findCompanyByName, mdW, personLabel, ACT_KIND, EVENT_MODE,
  type CrmActivity, type CrmCompany, type CrmContact, type CrmDeal, type CrmEvent, type CrmQuote, type CrmTask, type DealHistory, type Member,
} from "./crm-shape";

const DAY = 864e5;

// ─── 단계·상태 ───
export const STAGES = ["inquiry", "quote", "negotiation", "intake", "contract"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { inquiry: "문의", quote: "견적", negotiation: "협의", intake: "접수", contract: "계약" };
export const STATUSES = ["open", "won", "lost"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { open: "진행", won: "수주", lost: "실패" };
/** 실패 사유 (보고서의 실패 사유 막대). "다른 기관 선정"은 단추가 저절로 고르기도 한다 */
export const LOST_REASONS = ["가격", "일정", "다른 기관 선정", "의뢰자 계획 변경", "응답 없음", "기타"] as const;
export type LostReason = (typeof LOST_REASONS)[number];
/** 시험 갈래 (견적 요청 네 갈래와 같은 말) */
export const DEAL_KINDS = ["tox", "pd", "pk", "other"] as const;
export const DEAL_KIND: Record<string, string> = { tox: "독성", pd: "효력", pk: "약동학", other: "개별 분석" };
export const SOURCE_LABEL: Record<string, string> = { manual: "직접", danchu: "단추 요청", import: "엑셀" };

export const stageIdx = (s: string) => Math.max(0, STAGES.indexOf(s as Stage));
export const isStage = (v: unknown): v is Stage => typeof v === "string" && (STAGES as readonly string[]).includes(v);
export const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v);
/** 금액 한 줄: 2억 1,450만 원 · 금액 미정 */
export const amountLabel = (n: number | null | undefined) => (n == null ? "금액 미정" : wonKo(n));
export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));

// ─── 단추 요청 → 안건 ───
/** 단추 쪽에서 본 요청 하나 (기관 자신의 초대·견적·선정만). 다른 기관 정보는 담지 않는다 */
export type DanchuSrc = {
  inviteId: string;
  rfqNo: string;
  sentAt: string;
  joinedAt: string | null;
  stage: ReturnType<typeof inviteStage>;
  replyBy: string | null;
  joinBy: string | null;
  substance: string;
  cats: string[];
  rfqStatus: string;
  comparedAt: string | null;
  /** 의뢰자가 고른 견적 id 가 우리 것이 아닌지 (다른 기관 id 는 넘기지 않는다) */
  otherSelected: boolean;
  quote: { status: string; total: number | null; firstSubmittedAt: string | null; submittedAt: string | null; validUntil: string | null; revision: number } | null;
  award: { id: string; awardedAt: string; quoteAmount: number | null; contractReportedAt: string | null; contractStatus: string; contractAmount: number | null; substanceAt: string | null } | null;
  /** 선정된 요청만. 회사·담당자 */
  client: { key: string; company: string; contactName: string; email: string; phone: string; orgType: string } | null;
};

type Inv = {
  id: string; rfq_no: string; sent_at: string; joined_at?: string | null; status: string; withdrawn_at?: string | null; revoked_at?: string | null; reply_by: string | null;
  quote: { id: string; status: string; total_amount: number | null; first_submitted_at?: string | null; submitted_at: string | null; valid_until: string | null; revision?: number } | null;
  rfq: { substance?: string | null; categories?: string[] | null; status?: string | null; compared_at?: string | null; selected_quote_id?: string | null; join_by?: string | null; user_id?: string | null; company?: string | null } | null;
};
type Aw = {
  id: string; invite_id: string | null; awarded_at: string; quoteAmount: number | null; contract_reported_at: string | null; contract_status: string; contract_amount: number | null; substance_updated_at?: string | null;
  rfq: { company?: string | null; contact_name?: string | null; email?: string | null; phone?: string | null; user_id?: string | null; org_type?: string | null } | null;
};

/** 초대 + 선정을 안건 규칙이 보는 모양으로 */
export function danchuSrcOf(i: Inv, award: Aw | null): DanchuSrc {
  const ours = i.quote?.id ?? null;
  const sel = i.rfq?.selected_quote_id ?? null;
  const awarded = !!award;
  const key = awarded ? clientKeyOf(award.rfq ?? i.rfq) : null;
  return {
    inviteId: i.id,
    rfqNo: i.rfq_no,
    sentAt: i.sent_at,
    joinedAt: i.joined_at ?? null,
    stage: inviteStage(i),
    replyBy: i.reply_by,
    joinBy: i.rfq?.join_by ?? null,
    substance: i.rfq?.substance ?? "",
    cats: i.rfq?.categories ?? [],
    rfqStatus: i.rfq?.status ?? "",
    comparedAt: i.rfq?.compared_at ?? null,
    otherSelected: !!sel && sel !== ours,
    quote: i.quote ? { status: i.quote.status, total: i.quote.total_amount, firstSubmittedAt: i.quote.first_submitted_at ?? (i.quote.status === "submitted" ? i.quote.submitted_at : null), submittedAt: i.quote.submitted_at, validUntil: i.quote.valid_until, revision: i.quote.revision ?? 1 } : null,
    award: award ? { id: award.id, awardedAt: award.awarded_at, quoteAmount: award.quoteAmount, contractReportedAt: award.contract_reported_at, contractStatus: award.contract_status, contractAmount: award.contract_amount, substanceAt: award.substance_updated_at ?? null } : null,
    client: awarded && identityVisible({ awarded }) && key
      ? { key, company: (award.rfq?.company ?? i.rfq?.company ?? "").trim(), contactName: (award.rfq?.contact_name ?? "").trim(), email: award.rfq?.email ?? "", phone: award.rfq?.phone ?? "", orgType: award.rfq?.org_type ?? "" }
      : null,
  };
}

export type DanchuStep = { stage: Stage; status: Status; at: string; reason?: string; amount?: number | null };
export type DanchuTarget = {
  title: string;
  steps: DanchuStep[];
  stage: Stage;
  status: Status;
  amount: number | null;
  wonAmount: number | null;
  lostReason: string;
  lostNote: string;
  closedAt: string | null;
};

/** 요청 제목: 참여 뒤에는 시험물질, 없으면 시험 항목 */
export const danchuTitle = (s: Pick<DanchuSrc, "substance" | "cats">) => {
  const cats = s.cats.slice(0, 2).join(" · ");
  return (s.substance ? `${cats ? `${cats} · ` : ""}${s.substance}` : `${cats || "시험"} 요청`).slice(0, 200);
};

/**
 * 단추에서 일어난 일만 보고 안건이 있어야 할 자리. 참여 전(결정 전·불참)이면 null (안건이 아니다, 오늘 화면의 "참여 결정").
 * now 는 끝난 시각을 알 수 없을 때(다른 기관 선정·요청 마감) 쓴다.
 */
export function danchuTarget(s: DanchuSrc, now = Date.now()): DanchuTarget | null {
  if (!s.joinedAt && !s.award) return null;
  const nowIso = new Date(now).toISOString();
  const steps: DanchuStep[] = [{ stage: "inquiry", status: "open", at: s.joinedAt ?? s.sentAt }];
  let amount: number | null = null;
  const submitted = !!s.quote?.firstSubmittedAt && (s.stage === "submitted" || !!s.award);
  if (submitted && s.quote) {
    steps.push({ stage: "quote", status: "open", at: s.quote.firstSubmittedAt as string, amount: s.quote.total });
    amount = s.quote.total;
  }
  let wonAmount: number | null = null;
  let lostReason = "";
  let lostNote = "";
  let closedAt: string | null = null;
  const end = (status: Status, stage: Stage, at: string, reason = "", note = "") => {
    steps.push({ stage, status, at, reason: reason || undefined });
    closedAt = at;
    lostReason = reason;
    lostNote = note;
  };
  const cur = () => steps[steps.length - 1].stage;
  if (s.award) {
    amount = s.award.quoteAmount ?? amount;
    steps.push({ stage: "negotiation", status: "open", at: s.award.awardedAt, amount });
    if (s.award.contractStatus === "signed" && s.award.contractReportedAt) {
      wonAmount = s.award.contractAmount;
      end("won", "contract", s.award.contractReportedAt);
    } else if (s.award.contractStatus === "not_signed") {
      end("lost", "negotiation", s.award.contractReportedAt ?? nowIso, "의뢰자 계획 변경", "단추에 계약하지 않음으로 기록됐어요.");
    }
  } else if (s.stage === "withdrawn") {
    end("lost", cur(), nowIso, "기타", "단추 요청 참여를 철회했어요.");
  } else if (s.stage === "declined") {
    end("lost", cur(), nowIso, "기타", "단추 요청에 견적을 내지 않기로 했어요.");
  } else if (s.rfqStatus === "cancelled") {
    end("lost", cur(), nowIso, "의뢰자 계획 변경", "의뢰자가 단추 요청을 취소했어요.");
  } else if (submitted && (s.otherSelected || ["selected", "contracting"].includes(s.rfqStatus))) {
    end("lost", cur(), nowIso, "다른 기관 선정", "의뢰자가 다른 기관을 골랐어요.");
  } else if (s.rfqStatus === "closed") {
    end("lost", cur(), nowIso, "의뢰자 계획 변경", "의뢰자가 기관을 고르지 않고 요청을 마쳤어요.");
  } else if (s.stage === "ended" && !submitted) {
    end("lost", cur(), nowIso, "기타", "회신 기한 안에 견적을 내지 않았어요.");
  }
  const last = steps[steps.length - 1];
  return {
    title: danchuTitle(s),
    steps,
    stage: last.stage,
    status: last.status,
    amount,
    wonAmount,
    lostReason,
    lostNote,
    closedAt,
  };
}

/** 안건 행을 단추 이벤트에 맞춰 고칠 칸과 남길 이력. 앞으로만 옮기고, 끝난 안건은 손대지 않는다 */
export type DealSyncPatch = { patch: Partial<CrmDeal>; history: Omit<DealHistory, "id" | "deal_id" | "created_by">[] };
export function danchuPatch(deal: Pick<CrmDeal, "stage" | "status" | "amount" | "won_amount" | "title"> | null, t: DanchuTarget): DealSyncPatch {
  const hist = (from: { stage: string | null; status: string | null }, st: DanchuStep) => ({ from_stage: from.stage, to_stage: st.stage, from_status: from.status, to_status: st.status, reason: st.reason ?? "", actor: "danchu", at: st.at });
  if (!deal) {
    const history: DealSyncPatch["history"] = [];
    let prev: { stage: string | null; status: string | null } = { stage: null, status: null };
    for (const st of t.steps) {
      if (prev.stage === st.stage && prev.status === st.status) continue;
      history.push(hist(prev, st));
      prev = { stage: st.stage, status: st.status };
    }
    const last = t.steps[t.steps.length - 1];
    return {
      patch: {
        title: t.title, stage: t.stage, status: t.status, stage_at: [...t.steps].reverse().find((x) => x.stage === t.stage)?.at ?? last.at, amount: t.amount, won_amount: t.wonAmount,
        lost_reason: t.lostReason, lost_note: t.lostNote, closed_at: t.closedAt, source: "danchu",
      },
      history,
    };
  }
  if (deal.status !== "open") {
    // 끝난 안건: 수주 금액만 비어 있으면 채운다
    return t.status === "won" && deal.status === "won" && deal.won_amount == null && t.wonAmount != null ? { patch: { won_amount: t.wonAmount }, history: [] } : { patch: {}, history: [] };
  }
  const patch: Partial<CrmDeal> = {};
  const history: DealSyncPatch["history"] = [];
  let cur = { stage: deal.stage, status: deal.status };
  for (const st of t.steps) {
    const forward = stageIdx(st.stage) > stageIdx(cur.stage);
    const closing = st.status !== "open";
    if (!forward && !closing) continue;
    // 단추 이벤트로 단계가 앞으로 갈 때 금액을 단추 값으로 (견적 제출 총액 → 선정 금액)
    if (forward && st.amount != null) patch.amount = st.amount;
    const next = { stage: forward ? st.stage : cur.stage, status: st.status };
    history.push(hist(cur, { ...st, stage: next.stage as Stage }));
    if (forward) patch.stage_at = st.at;
    cur = next;
    if (closing) {
      patch.status = st.status;
      patch.closed_at = st.at;
      patch.lost_reason = t.lostReason;
      patch.lost_note = t.lostNote;
      if (st.status === "won") patch.won_amount = t.wonAmount;
      break;
    }
  }
  if (cur.stage !== deal.stage) patch.stage = cur.stage;
  // 아직 견적 단계면 다시 낸 견적 금액을 따른다 (단추 견적이 기준)
  if (deal.stage === "quote" && t.stage === "quote" && t.status === "open" && t.amount != null && deal.amount !== t.amount) patch.amount = t.amount;
  return { patch, history };
}

// ─── 단추 이벤트 (타임라인, 저장하지 않음) ───
export type DanchuEvent = { at: string; title: string; sub: string; amount?: number | null; diffNote?: string };
export function danchuEvents(s: DanchuSrc, opts: { contacts?: number } = {}): DanchuEvent[] {
  const out: DanchuEvent[] = [{ at: s.sentAt, title: "단추 요청 참여 안내 받음", sub: `${s.rfqNo} · ${s.cats.join(" · ")}` }];
  if (s.joinedAt) out.push({ at: s.joinedAt, title: "단추 요청에 참여", sub: s.replyBy ? `회신 기한 ${mdW(s.replyBy.slice(0, 10))}` : "" });
  const q = s.quote;
  if (q?.firstSubmittedAt) out.push({ at: q.firstSubmittedAt, title: "견적 제출", sub: "단추", amount: q.total });
  if (q?.submittedAt && q.firstSubmittedAt && q.submittedAt > q.firstSubmittedAt && q.revision > 1) out.push({ at: q.submittedAt, title: `${q.revision}차 견적 제출`, sub: "단추", amount: q.total });
  if (s.comparedAt) out.push({ at: s.comparedAt, title: "의뢰자 비교표 열림", sub: "단추 · 다른 기관 견적은 보여 주지 않아요" });
  if (s.award) {
    const n = opts.contacts ?? 1;
    out.push({ at: s.award.awardedAt, title: "단추 비교에서 선정됨", sub: `고객사와 담당자 ${n}명이 들어왔어요`, amount: s.award.quoteAmount });
    if (s.award.contractReportedAt && s.award.contractStatus === "signed") out.push({ at: s.award.contractReportedAt, title: "계약 결과 보고", sub: "단추", amount: s.award.contractAmount });
  }
  return out;
}

/** 단추 요청의 다음 할 일 (견적 쓰기·계약 결과 보고). 기다리는 중이면 null */
export function danchuNext(s: DanchuSrc, now = Date.now()): { label: string; due: string | null; href: string } | null {
  if (s.award) {
    if (!s.award.contractReportedAt && s.award.contractStatus !== "not_signed") return { label: "계약 결과 보고", due: null, href: "/cro/awards" };
    if (s.award.contractReportedAt && !s.award.substanceAt) return { label: "시험물질 필요량 적기", due: null, href: "/cro/awards" };
    return null;
  }
  if (["withdrawn", "declined", "ended"].includes(s.stage) || ["selected", "contracting", "closed", "cancelled"].includes(s.rfqStatus)) return null;
  if (s.stage === "submitted") return null;
  if (!s.joinedAt) return { label: "참여할지 정하기", due: s.joinBy ?? s.replyBy, href: `/cro/r/${s.inviteId}` };
  void now;
  return { label: s.stage === "draft" ? "견적 이어 쓰기" : "견적 쓰기", due: s.replyBy, href: `/cro/r/${s.inviteId}/reply` };
}

// ─── 안건 줄 (보드·목록·오늘) ───
export type DealNext = { kind: "task" | "event" | "danchu"; label: string; at: string | null; time: string | null; mode?: string | null; id?: string; href?: string };
export type DealRow = {
  deal: CrmDeal;
  company: string | null;
  contact: string | null;
  contactMore: number;
  next: DealNext | null;
  /** 이 단계에 머문 날 */
  days: number;
  /** 손이 필요한 이유 (없으면 null) */
  flag: { label: string; tone: "warn" | "due"; action: string; href: string } | null;
  danchuNo: string | null;
  mine: boolean;
};

export function dealRows(a: {
  deals: CrmDeal[]; companies: Pick<CrmCompany, "id" | "name">[]; contacts: Pick<CrmContact, "id" | "name" | "title">[];
  tasks: CrmTask[]; events: CrmEvent[]; quotes: CrmQuote[]; danchu: Map<string, DanchuSrc>; me?: string; now?: number; base?: string;
}): DealRow[] {
  const now = a.now ?? Date.now();
  const base = a.base ?? "/cro/deals";
  const today = todayKst(now);
  const co = new Map(a.companies.map((c) => [c.id, c.name]));
  const ct = new Map(a.contacts.map((c) => [c.id, c]));
  const tasksBy = group(a.tasks.filter((t) => t.deal_id && !t.done_at), (t) => t.deal_id as string);
  const evBy = group(a.events.filter((e) => e.deal_id && !e.done_at && e.starts_at >= new Date(now - 2 * 36e5).toISOString()), (e) => e.deal_id as string);
  const qBy = group(a.quotes.filter((q) => q.deal_id && q.valid_until && q.status === "sent"), (q) => q.deal_id as string);
  return a.deals.map((d) => {
    const ts = (tasksBy.get(d.id) ?? []).sort((x, y) => (x.due_on ?? "9").localeCompare(y.due_on ?? "9"));
    const es = (evBy.get(d.id) ?? []).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    const src = d.invite_id ? a.danchu.get(d.invite_id) ?? null : null;
    const dn = src && d.status === "open" ? danchuNext(src, now) : null;
    const cands: DealNext[] = [];
    if (es[0]) cands.push({ kind: "event", label: es[0].title, at: ymdKst(es[0].starts_at), time: es[0].all_day ? null : hmKst(es[0].starts_at), mode: es[0].mode, id: es[0].id });
    if (ts[0]) cands.push({ kind: "task", label: ts[0].title, at: ts[0].due_on, time: null, id: ts[0].id });
    if (dn) cands.push({ kind: "danchu", label: dn.label, at: dn.due ? dn.due.slice(0, 10) : null, time: null, href: dn.href });
    const next = cands.sort((x, y) => (x.at ?? "9").localeCompare(y.at ?? "9"))[0] ?? null;
    // 단추에서 기다리는 중(제출 뒤 비교표·선정 대기)이면 할 일이 없어도 손이 필요하지 않다
    const waiting = !!src && d.status === "open" && !dn && !src.award && src.stage === "submitted";
    let flag: DealRow["flag"] = null;
    if (d.status === "open") {
      const qv = (qBy.get(d.id) ?? []).map((q) => q.valid_until as string).filter((v) => v >= today).sort()[0];
      if (dn?.due && dLabel(dn.due.slice(0, 10), now).n <= 3) flag = { label: `회신 기한 ${dLabel(dn.due.slice(0, 10), now).label}`, tone: "due", action: "견적서 쓰기", href: dn.href };
      else if (dn && dn.label === "계약 결과 보고") flag = { label: "계약 결과 보고 전", tone: "due", action: "보고하기", href: dn.href };
      else if (qv && dLabel(qv, now).n <= 7) flag = { label: `견적 유효기간 ${dLabel(qv, now).label === "오늘" ? "오늘" : `D-${dLabel(qv, now).n}`}`, tone: "due", action: "안건 열기", href: `${base}/${d.id}` };
      else if (!next && !waiting) flag = { label: "다음 할 일 없음", tone: "warn", action: "할 일 잡기", href: `${base}/${d.id}#next` };
    }
    const cids = d.contact_ids.filter((id) => ct.has(id));
    const lead = cids[0] ? ct.get(cids[0]) : null;
    return {
      deal: d,
      company: d.company_id ? co.get(d.company_id) ?? null : null,
      contact: lead ? personLabel(lead.name, lead.title) : null,
      contactMore: Math.max(0, cids.length - 1),
      next,
      days: daysSince(d.stage_at, now),
      flag,
      danchuNo: d.source === "danchu" ? d.rfq_no || src?.rfqNo || null : null,
      mine: !a.me || d.owner === a.me || (!d.owner && d.created_by === a.me),
    };
  });
}

function group<T>(xs: T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(k(x), [...(m.get(k(x)) ?? []), x]);
  return m;
}

/** 다음 할 일 한 줄: "오늘 10:00 통화", "11.10 대면 미팅", "회신 11.10" */
export function nextLabel(n: DealNext | null, now = Date.now()): string {
  if (!n) return "";
  const when = n.at ? (dLabel(n.at, now).n === 0 ? "오늘" : dLabel(n.at, now).n === 1 ? "내일" : `${+n.at.slice(5, 7)}.${n.at.slice(8, 10)}`) : "";
  if (n.kind === "event") return [when, n.time, n.mode ? EVENT_MODE[n.mode] : "", n.label].filter(Boolean).join(" ");
  if (n.kind === "danchu") return n.at ? `${n.label} ${when}까지` : n.label;
  return [when, n.label].filter(Boolean).join(" ");
}

// ─── 보드 ───
export type BoardFilter = { mine?: boolean; kind?: string; source?: string; noNext?: boolean; q?: string };
export function filterDeals(rows: DealRow[], f: BoardFilter): DealRow[] {
  const k = f.q ? normName(f.q) : "";
  return rows.filter((r) =>
    (!f.mine || r.mine) && (!f.kind || r.deal.kind === f.kind) && (!f.source || (f.source === "danchu" ? r.deal.source === "danchu" : r.deal.source !== "danchu"))
    && (!f.noNext || r.flag?.label === "다음 할 일 없음")
    && (!k || normName(`${r.deal.title}${r.company ?? ""}${r.contact ?? ""}${r.danchuNo ?? ""}`).includes(k)));
}
export type BoardCol = { stage: Stage; rows: DealRow[]; count: number; sum: number };
export function board(rows: DealRow[]): BoardCol[] {
  return STAGES.map((stage) => {
    const rs = rows.filter((r) => r.deal.status === "open" && r.deal.stage === stage).sort((x, y) => (x.next?.at ?? "9").localeCompare(y.next?.at ?? "9") || y.days - x.days);
    return { stage, rows: rs, count: rs.length, sum: rs.reduce((s, r) => s + (r.deal.amount ?? 0), 0) };
  });
}
/** 이번 달(KST) 수주·실패 */
export function monthClosed(deals: Pick<CrmDeal, "status" | "closed_at" | "won_amount" | "amount">[], now = Date.now()) {
  const m = todayKst(now).slice(0, 7);
  const inM = deals.filter((d) => d.closed_at && ymdKst(d.closed_at).slice(0, 7) === m);
  const won = inM.filter((d) => d.status === "won");
  return { won: won.length, wonSum: won.reduce((s, d) => s + (d.won_amount ?? d.amount ?? 0), 0), lost: inM.filter((d) => d.status === "lost").length };
}

// ─── 단계 진행 막대 (단계마다 머문 날) ───
export type StageSpan = { stage: Stage; days: number | null; state: "done" | "now" | "next" };
export function stageSpans(d: Pick<CrmDeal, "stage" | "status" | "stage_at" | "created_at">, hist: Pick<DealHistory, "to_stage" | "at">[], now = Date.now()): StageSpan[] {
  const h = [...hist].sort((x, y) => x.at.localeCompare(y.at));
  const spent = new Map<Stage, number>();
  for (let i = 0; i < h.length; i++) {
    const s = h[i].to_stage as Stage;
    const end = i + 1 < h.length ? new Date(h[i + 1].at).getTime() : d.status === "open" ? now : new Date(h[i].at).getTime();
    spent.set(s, (spent.get(s) ?? 0) + Math.max(0, end - new Date(h[i].at).getTime()));
  }
  const ci = stageIdx(d.stage);
  return STAGES.map((stage, i) => {
    const ms = spent.get(stage);
    const state: StageSpan["state"] = i < ci ? "done" : i === ci ? (d.status === "won" ? "done" : "now") : "next";
    let days = ms != null ? Math.floor(ms / DAY) : null;
    if (state === "now" && d.status === "open") days = daysSince(d.stage_at, now);
    if (days != null) days = Math.max(state === "next" ? 0 : 1, days);
    return { stage, days: state === "next" ? null : days, state };
  });
}

// ─── 타임라인 (안건·고객사 가운데) ───
export type TimelineItem = {
  at: string;
  kind: "meeting" | "call" | "email" | "memo" | "danchu" | "stage" | "quote" | "task";
  who: string;
  title: string;
  sub: string;
  body?: string;
  amount?: number | null;
  diffNote?: string;
  dealId: string | null;
  ref?: { type: "activity" | "task"; id: string };
};

export function buildTimeline(a: {
  activities: CrmActivity[]; history: DealHistory[]; quotes: CrmQuote[]; tasks: CrmTask[]; contacts: Pick<CrmContact, "id" | "name" | "title" | "email">[]; members: Member[];
  danchu: { dealId: string; src: DanchuSrc; contacts: number }[]; deals?: Pick<CrmDeal, "id" | "title">[];
}): TimelineItem[] {
  const mem = new Map(a.members.map((m) => [m.id, m.name]));
  const ct = new Map(a.contacts.map((c) => [c.id, c]));
  const cname = (id: string | null) => (id && ct.get(id) ? personLabel(ct.get(id)!.name, ct.get(id)!.title) : "");
  const dealT = new Map((a.deals ?? []).map((d) => [d.id, d.title]));
  const out: TimelineItem[] = [];
  for (const x of a.activities) {
    const ppl = [...new Set([x.contact_id, ...x.attendee_contacts].filter(Boolean) as string[])].map(cname).filter(Boolean);
    const ours = [...new Set([x.created_by, ...x.attendee_members].filter(Boolean) as string[])].map((id) => mem.get(id) ?? "").filter(Boolean);
    let who = ours[0] ?? "";
    let title = x.title;
    let sub = "";
    if (x.kind === "email") {
      // 기관 담당자가 직접 남긴 메일 기록 (주고받은 고객 담당자 이름을 앞에)
      title = `${[ppl.join(", "), "메일"].filter(Boolean).join(" ")} · ${x.title || "제목 없음"}`;
    } else if (x.kind === "call" || x.kind === "meeting") {
      title = `${[ppl.join(", "), ACT_KIND[x.kind]].filter(Boolean).join(" ")}${x.duration_min ? ` ${x.duration_min}분` : ""}`;
      if (x.kind === "meeting" && ours.length > 1) sub = `${ppl.join(", ")} / ${ours.join(", ")}`;
      if (x.title) title = `${title} · ${x.title}`;
    } else {
      title = x.title || "메모";
    }
    out.push({
      at: x.occurred_at, kind: x.kind as TimelineItem["kind"], who, title, sub: [sub, !a.deals ? "" : x.deal_id ? dealT.get(x.deal_id) ?? "" : ""].filter(Boolean).join(" · "),
      body: x.body || undefined, dealId: x.deal_id, ref: { type: "activity", id: x.id },
    });
  }
  // 단계 변경: 기관 담당자가 옮긴 것만 따로 한 줄. 단추가 옮긴 것은 단추 이벤트 줄에 붙인다
  const dz = new Map<string, DealHistory>();
  for (const h of a.history) {
    if (h.actor === "danchu") { dz.set(`${h.deal_id}|${h.at}`, h); continue; }
    if (!h.from_stage && !h.from_status) {
      out.push({ at: h.at, kind: "stage", who: h.created_by ? mem.get(h.created_by) ?? "" : "", title: h.actor === "import" ? "엑셀에서 가져온 안건" : "안건을 만들었어요", sub: STAGE_LABEL[h.to_stage as Stage] ?? "", dealId: h.deal_id });
      continue;
    }
    const st = h.to_status !== "open" && h.to_status !== h.from_status ? `${STATUS_LABEL[h.to_status as Status]}${h.reason ? ` · ${h.reason}` : ""}` : `${STAGE_LABEL[h.from_stage as Stage] ?? ""}에서 ${STAGE_LABEL[h.to_stage as Stage] ?? ""}로`;
    out.push({ at: h.at, kind: "stage", who: h.created_by ? mem.get(h.created_by) ?? "" : "", title: h.to_status !== "open" && h.to_status !== h.from_status ? st : `단계를 ${st} 옮겼어요`, sub: "", dealId: h.deal_id });
  }
  for (const d of a.danchu) {
    const evs = danchuEvents(d.src, { contacts: d.contacts });
    let prevAmount: number | null = null;
    for (const e of evs) {
      const h = [...dz.values()].find((x) => x.deal_id === d.dealId && Math.abs(new Date(x.at).getTime() - new Date(e.at).getTime()) < 60e3);
      const stageNote = h && h.from_stage ? (h.to_status !== "open" ? `${STATUS_LABEL[h.to_status as Status]}로` : `단계 ${STAGE_LABEL[h.from_stage as Stage]}에서 ${STAGE_LABEL[h.to_stage as Stage]}로`) : "";
      let diffNote: string | undefined;
      if (e.amount != null && prevAmount != null && e.amount !== prevAmount && e.title.includes("견적")) diffNote = `이전보다 ${wonKo(Math.abs(prevAmount - e.amount))} ${e.amount < prevAmount ? "낮음" : "높음"}`;
      if (e.amount != null && e.title.includes("견적")) prevAmount = e.amount;
      out.push({ at: e.at, kind: "danchu", who: "단추", title: e.title, sub: [e.sub, stageNote].filter(Boolean).join(" · "), amount: e.amount, diffNote, dealId: d.dealId });
    }
    // 단추 이벤트 시각과 맞지 않는 단추 이력 (요청 마감·다른 기관 선정 등)
    for (const h of dz.values()) {
      if (h.deal_id !== d.dealId || !h.from_stage) continue;
      if (evs.some((e) => Math.abs(new Date(h.at).getTime() - new Date(e.at).getTime()) < 60e3)) continue;
      out.push({ at: h.at, kind: "danchu", who: "단추", title: h.to_status === "lost" ? `실패로 바뀜 · ${h.reason}` : `단계 ${STAGE_LABEL[h.to_stage as Stage]}로`, sub: "단추에서 일어난 일", dealId: d.dealId });
    }
  }
  for (const q of a.quotes) {
    if (!q.sent_at) continue;
    out.push({ at: q.sent_at, kind: "quote", who: "", title: `견적서 ${q.doc_no} 보냄`, sub: [q.title, q.valid_until ? `유효기간 ${mdW(q.valid_until)}` : "", cname(q.contact_id) ? `${cname(q.contact_id)} 앞` : ""].filter(Boolean).join(" · "), amount: q.supply, dealId: q.deal_id });
  }
  for (const t of a.tasks) if (t.done_at) out.push({ at: t.done_at, kind: "task", who: t.done_by ? mem.get(t.done_by) ?? "" : "", title: `할 일 끝냄 · ${t.title}`, sub: "", dealId: t.deal_id, ref: { type: "task", id: t.id } });
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

/** 날짜별 묶음 (최근 날부터) */
export function byDay<T extends { at: string }>(items: T[]): { day: string; items: T[] }[] {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const d = ymdKst(x.at);
    m.set(d, [...(m.get(d) ?? []), x]);
  }
  return [...m.entries()].map(([day, xs]) => ({ day, items: xs }));
}

// ─── 오늘 ───
export type TodayItem = {
  key: string;
  time: string | null;
  kind: "event" | "task" | "danchu";
  title: string;
  sub: string;
  done: boolean;
  overdue: boolean;
  badge: string;
  href: string | null;
  taskId?: string;
  eventId?: string;
  mode?: string | null;
};
export function todayList(a: {
  tasks: CrmTask[]; events: CrmEvent[]; rows: DealRow[]; invites: DanchuSrc[]; me: string; mineOnly?: boolean; now?: number; base?: string;
}): TodayItem[] {
  const now = a.now ?? Date.now();
  const today = todayKst(now);
  const base = a.base ?? "/cro/deals";
  const byDeal = new Map(a.rows.map((r) => [r.deal.id, r]));
  const where = (dealId: string | null) => {
    const r = dealId ? byDeal.get(dealId) : null;
    return r ? [r.company ?? (r.danchuNo ? `단추 요청 ${r.danchuNo}` : ""), r.deal.title].filter(Boolean).join(" · ") : "";
  };
  const out: TodayItem[] = [];
  for (const e of a.events) {
    if (ymdKst(e.starts_at) !== today) continue;
    if (a.mineOnly && e.created_by !== a.me && !e.attendee_members.includes(a.me)) continue;
    out.push({ key: `e:${e.id}`, time: e.all_day ? null : hmKst(e.starts_at), kind: "event", title: e.title, sub: [where(e.deal_id), e.location].filter(Boolean).join(" · "), done: !!e.done_at, overdue: false, badge: "", href: e.deal_id ? `${base}/${e.deal_id}` : null, eventId: e.id, mode: e.mode });
  }
  for (const t of a.tasks) {
    if (!t.due_on || t.due_on > today) continue;
    if (t.done_at && ymdKst(t.done_at) !== today) continue;
    if (a.mineOnly && (t.assignee ?? t.created_by) !== a.me) continue;
    const late = !t.done_at && t.due_on < today;
    out.push({ key: `t:${t.id}`, time: null, kind: "task", title: t.title, sub: where(t.deal_id), done: !!t.done_at, overdue: late, badge: late ? dLabel(t.due_on, now).label : "", href: t.deal_id ? `${base}/${t.deal_id}` : null, taskId: t.id });
  }
  // 단추 기한: 오늘·내일 (참여 결정 포함)
  for (const r of a.rows) {
    if (r.next?.kind !== "danchu" || !r.next.at) continue;
    const n = dLabel(r.next.at, now).n;
    if (n > 1) continue;
    out.push({ key: `d:${r.deal.id}`, time: null, kind: "danchu", title: `${r.danchuNo ?? ""} ${r.next.label}`.trim(), sub: [r.deal.title, `기한 ${n < 0 ? dLabel(r.next.at, now).label : n === 0 ? "오늘" : "내일"}`].join(" · "), done: false, overdue: n < 0, badge: n <= 0 ? "D-day" : "D-1", href: r.next.href ?? `${base}/${r.deal.id}` });
  }
  for (const s of a.invites) {
    if (s.joinedAt || s.award) continue;
    const nx = danchuNext(s, now);
    if (!nx?.due) continue;
    const n = dLabel(nx.due.slice(0, 10), now).n;
    if (n > 1 || n < 0) continue;
    out.push({ key: `i:${s.inviteId}`, time: null, kind: "danchu", title: `${s.rfqNo} 참여 결정`, sub: `${s.cats.join(" · ") || "시험"} 요청 · 참여하지 않으면 청구하지 않아요`, done: false, overdue: false, badge: n === 0 ? "D-day" : "D-1", href: nx.href });
  }
  const rank = (x: TodayItem) => `${x.done ? 1 : 0}${x.time ?? (x.overdue ? "00:00" : "99:99")}`;
  return out.sort((x, y) => rank(x).localeCompare(rank(y)));
}

/** 이번 주 (월~금) 일정 수 + 줄 */
export function weekStrip(a: { events: CrmEvent[]; quotes: CrmQuote[]; deals: Pick<CrmDeal, "id" | "status" | "title">[]; companies: Pick<CrmCompany, "id" | "name">[]; now?: number }) {
  const now = a.now ?? Date.now();
  const today = todayKst(now);
  // 토·일에는 다가오는 주를 보여 준다
  const next = addDaysYmd(mondayOf(today), 5) <= today;
  const mon = next ? addDaysYmd(mondayOf(today), 7) : mondayOf(today);
  const days = [0, 1, 2, 3, 4].map((i) => addDaysYmd(mon, i));
  const co = new Map(a.companies.map((c) => [c.id, c.name]));
  const open = new Set(a.deals.filter((d) => d.status === "open").map((d) => d.id));
  const items: { date: string; time: string | null; title: string }[] = [];
  for (const e of a.events) {
    const d = ymdKst(e.starts_at);
    if (!days.includes(d) || e.done_at) continue;
    items.push({ date: d, time: e.all_day ? null : hmKst(e.starts_at), title: e.title });
  }
  for (const q of a.quotes) {
    if (!q.valid_until || !days.includes(q.valid_until) || q.status !== "sent" || (q.deal_id && !open.has(q.deal_id))) continue;
    items.push({ date: q.valid_until, time: null, title: `${q.company_id ? co.get(q.company_id) ?? q.client : q.client} 견적 유효기간` });
  }
  items.sort((x, y) => `${x.date}${x.time ?? "99"}`.localeCompare(`${y.date}${y.time ?? "99"}`));
  return { days: days.map((d) => ({ date: d, count: items.filter((x) => x.date === d).length })), items, from: days[0], to: days[4], next };
}

// ─── 고객사 목록 · 고객사 화면 ───
export type CompanyRow = {
  company: CrmCompany; contacts: number; lead: string | null; open: number; openSum: number; wonSum: number; won: number; lost: number;
  lastAt: string | null; firstOn: string | null; quiet: boolean; danchu: boolean; owner: string | null;
};
export function companyRows(a: { companies: CrmCompany[]; contacts: CrmContact[]; deals: CrmDeal[]; activities: Pick<CrmActivity, "company_id" | "deal_id" | "occurred_at">[]; members: Member[]; now?: number }): CompanyRow[] {
  const now = a.now ?? Date.now();
  const mem = new Map(a.members.map((m) => [m.id, m.name]));
  const dealCo = new Map(a.deals.map((d) => [d.id, d.company_id]));
  const last = new Map<string, string>();
  for (const x of a.activities) {
    const c = x.company_id ?? (x.deal_id ? dealCo.get(x.deal_id) ?? null : null);
    if (c && (!last.has(c) || (last.get(c) as string) < x.occurred_at)) last.set(c, x.occurred_at);
  }
  return a.companies.map((c) => {
    const cs = a.contacts.filter((x) => x.company_id === c.id);
    const ds = a.deals.filter((d) => d.company_id === c.id);
    const open = ds.filter((d) => d.status === "open");
    const won = ds.filter((d) => d.status === "won");
    const first = [c.first_deal_on, ...won.map((d) => d.closed_at ? ymdKst(d.closed_at) : null)].filter(Boolean).sort()[0] ?? null;
    const lastAt = last.get(c.id) ?? null;
    return {
      company: c, contacts: cs.length, lead: cs.find((x) => x.role === "decision")?.name ?? cs[0]?.name ?? null,
      open: open.length, openSum: open.reduce((s, d) => s + (d.amount ?? 0), 0), won: won.length, wonSum: won.reduce((s, d) => s + (d.won_amount ?? d.amount ?? 0), 0), lost: ds.filter((d) => d.status === "lost").length,
      lastAt, firstOn: first, quiet: now - new Date(lastAt ?? c.created_at).getTime() > 30 * DAY, danchu: c.source === "danchu" || cs.some((x) => !!x.danchu_key) || ds.some((d) => d.source === "danchu"),
      owner: c.owner ? mem.get(c.owner) ?? null : null,
    };
  });
}
export const COMPANY_FILTERS = { all: "전체", open: "진행 중 안건", danchu: "단추에서 온 고객", quiet: "연락 30일 넘음" } as const;
export type CompanyFilter = keyof typeof COMPANY_FILTERS;
export function filterCompanies(rows: CompanyRow[], f: CompanyFilter, q: string): CompanyRow[] {
  const k = normName(q);
  return rows
    .filter((r) => f === "all" || (f === "open" ? r.open > 0 : f === "danchu" ? r.danchu : r.quiet))
    .filter((r) => !k || companyKeys(r.company).some((x) => x.includes(k)) || (r.lead ?? "").includes(q.trim()))
    .sort((x, y) => y.open - x.open || (y.lastAt ?? "").localeCompare(x.lastAt ?? "") || x.company.name.localeCompare(y.company.name, "ko"));
}

// ─── 보고서 ───
export type Report = {
  from: string; to: string;
  funnel: { stage: Stage; count: number; fromPrev: number | null; fromStart: number | null }[];
  dwell: { stage: Stage; days: number | null; n: number }[];
  winRate: number | null; wonSum: number; won: number; lost: number;
  reasons: { reason: string; count: number }[];
  bySource: { key: "danchu" | "direct"; label: string; won: number; closed: number; rate: number | null }[];
  activity: { member: string; meeting: number; call: number; email: number; memo: number; tasks: number }[];
  closed: CrmDeal[];
  created: number;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
export function buildReport(a: { deals: CrmDeal[]; history: DealHistory[]; activities: CrmActivity[]; tasks: CrmTask[]; members: Member[]; from: string; to: string; owner?: string | null; now?: number }): Report {
  const now = a.now ?? Date.now();
  const inR = (iso: string) => { const d = ymdKst(iso); return d >= a.from && d <= a.to; };
  const deals = a.deals.filter((d) => !a.owner || d.owner === a.owner);
  const ids = new Set(deals.map((d) => d.id));
  const hist = a.history.filter((h) => ids.has(h.deal_id));
  const hBy = group(hist, (h) => h.deal_id);
  // 기간 안에 생긴 안건이 어디까지 갔는지 (가장 멀리 간 단계, 수주는 계약까지 간 것)
  const cohort = deals.filter((d) => inR(d.created_at));
  const reach = (d: CrmDeal) => Math.max(stageIdx(d.stage), ...(hBy.get(d.id) ?? []).map((h) => stageIdx(h.to_stage)), d.status === "won" ? STAGES.length - 1 : 0);
  const counts = STAGES.map((_, i) => cohort.filter((d) => reach(d) >= i).length);
  const funnel = STAGES.map((stage, i) => ({ stage, count: counts[i], fromPrev: i ? pct(counts[i], counts[i - 1]) : null, fromStart: i ? pct(counts[i], counts[0]) : null }));
  // 단계에 머문 평균 일수: 기간 안에 끝난 머묾 (다음 단계로 넘어간 시각이 기간 안)
  const dw = new Map<Stage, number[]>();
  for (const [, hs] of hBy) {
    const s = [...hs].sort((x, y) => x.at.localeCompare(y.at));
    for (let i = 0; i + 1 < s.length; i++) {
      if (s[i].to_stage === s[i + 1].to_stage && s[i + 1].to_status === "open") continue;
      if (!inR(s[i + 1].at)) continue;
      const st = s[i].to_stage as Stage;
      dw.set(st, [...(dw.get(st) ?? []), (new Date(s[i + 1].at).getTime() - new Date(s[i].at).getTime()) / DAY]);
    }
  }
  const dwell = STAGES.map((stage) => {
    const xs = dw.get(stage) ?? [];
    return { stage, days: xs.length ? Math.max(1, Math.round(xs.reduce((p, c) => p + c, 0) / xs.length)) : null, n: xs.length };
  });
  const closed = deals.filter((d) => d.closed_at && inR(d.closed_at)).sort((x, y) => (y.closed_at as string).localeCompare(x.closed_at as string));
  const won = closed.filter((d) => d.status === "won");
  const lost = closed.filter((d) => d.status === "lost");
  const rc = new Map<string, number>();
  for (const d of lost) rc.set(d.lost_reason || "기타", (rc.get(d.lost_reason || "기타") ?? 0) + 1);
  const reasons = [...LOST_REASONS.map((r) => ({ reason: r as string, count: rc.get(r) ?? 0 })), ...[...rc.entries()].filter(([r]) => !(LOST_REASONS as readonly string[]).includes(r)).map(([reason, count]) => ({ reason, count }))]
    .filter((x) => x.count > 0).sort((x, y) => y.count - x.count);
  const src = (key: "danchu" | "direct") => {
    const cs = closed.filter((d) => (key === "danchu") === (d.source === "danchu"));
    const w = cs.filter((d) => d.status === "won").length;
    return { key, label: key === "danchu" ? "단추 요청" : "직접 받은 문의", won: w, closed: cs.length, rate: pct(w, cs.length) };
  };
  const acts = a.activities.filter((x) => inR(x.occurred_at));
  const activity = a.members.filter((m) => !a.owner || m.id === a.owner).map((m) => {
    const mine = acts.filter((x) => x.created_by === m.id);
    const c = (k: string) => mine.filter((x) => x.kind === k).length;
    return { member: m.name, meeting: c("meeting"), call: c("call"), email: c("email"), memo: c("memo"), tasks: a.tasks.filter((t) => t.done_at && t.done_by === m.id && inR(t.done_at)).length };
  });
  void now;
  return {
    from: a.from, to: a.to, funnel, dwell, winRate: pct(won.length, closed.length), wonSum: won.reduce((s, d) => s + (d.won_amount ?? d.amount ?? 0), 0), won: won.length, lost: lost.length,
    reasons, bySource: [src("danchu"), src("direct")], activity, closed, created: cohort.length,
  };
}

// ─── 엑셀 가져오기 ───
export const IMPORT_FIELDS = {
  company: "고객사 이름", biz_no: "사업자번호", industry: "업종", contact: "담당자 이름", email: "담당자 메일", phone: "담당자 전화", title: "담당자 직책", dept: "담당자 부서",
  deal: "안건 이름", amount: "금액", stage: "단계", owner: "담당 영업", created: "문의일", expected: "예상 계약", memo: "메모로 보관", skip: "가져오지 않음",
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
const SYN: [ImportField, RegExp][] = [
  ["biz_no", /사업자(등록)?번호|사업자|biz/i],
  ["company", /거래처|고객사|회사|업체|기관명|의뢰(사|처|기관)|company|client|customer/i],
  ["email", /메일|e-?mail/i],
  ["phone", /연락처|전화|휴대폰|핸드폰|phone|mobile|tel/i],
  ["title", /직책|직급|직위|title/i],
  ["dept", /부서|팀|dept/i],
  ["owner", /영업\s*담당|담당\s*영업|담당자\(우리\)|sales|owner/i],
  ["contact", /담당자|성명|이름|contact|name/i],
  ["deal", /건명|안건|시험명|과제|프로젝트|견적명|품목|deal|project/i],
  ["amount", /금액|견적가|계약가|단가|amount|price/i],
  ["stage", /진행|상태|단계|status|stage/i],
  ["expected", /예상|계약\s*예정|closing/i],
  ["created", /등록일|문의일|접수일|일자|날짜|date|created/i],
  ["industry", /업종|분야|industry/i],
  ["memo", /비고|메모|특이|note|memo/i],
];
export function guessField(header: string): ImportField {
  const h = header.trim();
  for (const [f, re] of SYN) if (re.test(h)) return f;
  return "memo";
}
/** 엑셀 진행상태 값 → 단계·상태. CRO 엑셀에 흔한 말("견적발송", "네고", "드랍")을 먼저 맞춘다 */
export type StageValue = { stage: Stage; status: Status; reason?: string };
export function guessStage(v: string): StageValue | null {
  const s = v.replace(/\s/g, "");
  if (!s) return null;
  if (/드랍|드롭|실패|미수주|취소|무산|보류|중단|drop|lost/i.test(s)) return { stage: "quote", status: "lost", reason: "기타" };
  if (/계약완료|수주|성사|체결|완료|won/i.test(s)) return { stage: "contract", status: "won" };
  if (/계약/.test(s)) return { stage: "contract", status: "open" };
  if (/접수|의뢰서|시험의뢰/.test(s)) return { stage: "intake", status: "open" };
  if (/네고|협의|협상|검토|조율|nego/i.test(s)) return { stage: "negotiation", status: "open" };
  if (/견적|송부|발송|제출|quote/i.test(s)) return { stage: "quote", status: "open" };
  if (/문의|상담|신규|요청|lead|inquiry/i.test(s)) return { stage: "inquiry", status: "open" };
  return null;
}
/** "214,500,000" · "2.1억" · "6,200만" · "₩3,300,000원" → 원 */
export function parseWon(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  const s = String(v ?? "").replace(/[\s,₩원]/g, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)(억|천만|백만|만)?(?:(\d+(?:\.\d+)?)(만|천)?)?$/);
  if (!m) return null;
  const unit = (u?: string) => (u === "억" ? 1e8 : u === "천만" ? 1e7 : u === "백만" ? 1e6 : u === "만" ? 1e4 : u === "천" ? 1e3 : 1);
  const n = +m[1] * unit(m[2]) + (m[3] ? +m[3] * unit(m[4] ?? (m[2] === "억" ? "만" : undefined)) : 0);
  return Number.isFinite(n) ? Math.round(n) : null;
}
/** 날짜 칸: 2026-11-02 · 2026.11.2 · 26/11/02 · 엑셀 일련번호 */
export function parseYmd(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * DAY).toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{2,4})[.\-/년\s]+(\d{1,2})[.\-/월\s]*(\d{1,2})?/);
  if (!m) return null;
  const y = m[1].length === 2 ? 2000 + +m[1] : +m[1];
  const mo = +m[2];
  const d = m[3] ? +m[3] : 1;
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type ImportMode = "merge" | "skip" | "new";
export type ImportPlanRow = {
  line: number;
  company: { name: string; biz_no: string; industry: string; match: string | null };
  contact: { name: string; email: string; phone: string; title: string; dept: string } | null;
  deal: { title: string; amount: number | null; stage: Stage; status: Status; reason: string; created: string | null; expected: string | null; memo: string; owner: string | null } | null;
  skip: string | null;
};
export type ImportPlan = { rows: ImportPlanRow[]; newCompanies: number; mergedCompanies: number; contacts: number; deals: number; open: number; won: number; lost: number; skipped: number; unmappedStatus: string[] };

/**
 * 엑셀 줄 → 들여올 모양. 같은 회사는 사업자번호 → 이름(별칭) 순으로 기존 고객사와 맞춘다.
 * mode: merge 기존 고객사에 더함 · skip 겹치는 줄은 건너뜀 · new 이름이 같아도 새로 만듦
 */
export function planImport(a: {
  header: string[]; rows: unknown[][]; map: ImportField[]; stageMap: Record<string, StageValue>; mode: ImportMode;
  companies: Pick<CrmCompany, "id" | "name" | "aliases" | "biz_no">[]; members: Member[]; defaultOwner: string | null;
}): ImportPlan {
  const col = (f: ImportField) => a.map.indexOf(f);
  const cell = (r: unknown[], f: ImportField) => { const i = col(f); return i < 0 ? "" : String(r[i] ?? "").trim(); };
  const memoCols = a.map.map((f, i) => (f === "memo" ? i : -1)).filter((i) => i >= 0);
  const bizKey = (s: string) => s.replace(/[^0-9]/g, "");
  const byBiz = new Map(a.companies.filter((c) => bizKey(c.biz_no).length === 10).map((c) => [bizKey(c.biz_no), c]));
  const seenNew = new Map<string, string>();
  const plan: ImportPlanRow[] = [];
  const unmapped = new Set<string>();
  const memberBy = (s: string) => (s ? a.members.find((m) => m.name === s || m.name.startsWith(s) || s.startsWith(m.name))?.id ?? null : null);
  a.rows.forEach((r, idx) => {
    const name = cell(r, "company");
    const line = idx + 2;
    if (!name) { plan.push({ line, company: { name: "", biz_no: "", industry: "", match: null }, contact: null, deal: null, skip: "고객사 이름이 비어 있어요" }); return; }
    const biz = cell(r, "biz_no");
    const hit = (bizKey(biz).length === 10 ? byBiz.get(bizKey(biz)) : null) ?? findCompanyByName(a.companies, name);
    const match = a.mode === "new" ? null : hit?.id ?? null;
    if (hit && a.mode === "skip") { plan.push({ line, company: { name, biz_no: biz, industry: "", match: hit.id }, contact: null, deal: null, skip: "이미 있는 고객사" }); return; }
    if (!match) seenNew.set(a.mode === "new" ? `${line}` : normName(name) || name, name);
    const cname = cell(r, "contact");
    const st = cell(r, "stage");
    const sv = st ? a.stageMap[st] ?? guessStage(st) : null;
    if (st && !a.stageMap[st] && !guessStage(st)) unmapped.add(st);
    const title = cell(r, "deal");
    const memo = memoCols.map((i) => `${a.header[i] ?? ""}: ${String(r[i] ?? "").trim()}`).filter((x) => !x.endsWith(": ")).join("\n");
    plan.push({
      line,
      company: { name, biz_no: biz, industry: cell(r, "industry"), match },
      contact: cname ? { name: cname, email: cell(r, "email"), phone: cell(r, "phone"), title: cell(r, "title"), dept: cell(r, "dept") } : null,
      deal: title || col("deal") < 0 && (sv || col("amount") >= 0)
        ? {
          title: title || `${name} 안건`, amount: parseWon(r[col("amount")]), stage: sv?.stage ?? "inquiry", status: sv?.status ?? "open", reason: sv?.status === "lost" ? sv.reason ?? "기타" : "",
          created: parseYmd(r[col("created")]), expected: parseYmd(r[col("expected")]), memo, owner: memberBy(cell(r, "owner")) ?? a.defaultOwner,
        }
        : null,
      skip: null,
    });
  });
  const live = plan.filter((p) => !p.skip);
  const ds = live.map((p) => p.deal).filter(Boolean) as NonNullable<ImportPlanRow["deal"]>[];
  return {
    rows: plan,
    newCompanies: seenNew.size,
    mergedCompanies: new Set(live.map((p) => p.company.match).filter(Boolean)).size,
    contacts: live.filter((p) => p.contact).length,
    deals: ds.length,
    open: ds.filter((d) => d.status === "open").length,
    won: ds.filter((d) => d.status === "won").length,
    lost: ds.filter((d) => d.status === "lost").length,
    skipped: plan.length - live.length,
    unmappedStatus: [...unmapped],
  };
}

// ─── 안건 입력 검사 ───
export type DealInput = {
  title: string; company_id: string | null; contact_ids: string[]; kind: string; substance: string; submit_to: string; report_lang: string; amount: number | null;
  expected_on: string | null; owner: string | null; memo: string; stage: Stage;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseDeal(b: Record<string, unknown>, partial = false): { ok: true; value: Partial<DealInput> } | { ok: false; error: string } {
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const title = b.title === undefined ? undefined : s(b.title, 200);
  if (!partial && !title) return { ok: false, error: "안건 이름을 적어 주세요. 예: 13주 반복투여독성 · 랫드" };
  if (title !== undefined && !title) return { ok: false, error: "안건 이름은 비워 둘 수 없어요." };
  const amount = b.amount === undefined ? undefined : b.amount === null || b.amount === "" ? null : parseWon(b.amount);
  if (b.amount !== undefined && b.amount !== null && b.amount !== "" && amount == null) return { ok: false, error: "금액은 숫자로 적어 주세요. 예: 62,000,000 또는 6,200만" };
  const exp = b.expected_on === undefined ? undefined : b.expected_on === null || b.expected_on === "" ? null : parseYmd(b.expected_on);
  if (b.expected_on && exp === null) return { ok: false, error: "예상 계약 날짜를 확인해 주세요." };
  const kind = b.kind === undefined ? undefined : (DEAL_KINDS as readonly string[]).includes(String(b.kind)) ? String(b.kind) : "";
  const stage = b.stage === undefined ? (partial ? undefined : "inquiry") : isStage(b.stage) ? b.stage : null;
  if (stage === null) return { ok: false, error: "단계를 골라 주세요." };
  const v: Partial<DealInput> = {
    title, kind, amount, expected_on: exp, stage: stage as Stage | undefined,
    company_id: b.company_id === undefined ? undefined : typeof b.company_id === "string" && UUID.test(b.company_id) ? b.company_id : null,
    contact_ids: b.contact_ids === undefined ? undefined : Array.isArray(b.contact_ids) ? [...new Set(b.contact_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 10) : [],
    owner: b.owner === undefined ? undefined : typeof b.owner === "string" && UUID.test(b.owner) ? b.owner : null,
    substance: b.substance === undefined ? undefined : s(b.substance, 200), submit_to: b.submit_to === undefined ? undefined : s(b.submit_to, 100),
    report_lang: b.report_lang === undefined ? undefined : s(b.report_lang, 40), memo: b.memo === undefined ? undefined : s(b.memo, 4000),
  };
  return { ok: true, value: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Partial<DealInput> };
}
/** 단추 안건에서 기관이 고칠 수 없는 칸 (단추가 채움) */
export const DANCHU_LOCKED = ["rfq_no", "invite_id", "source"] as const;
