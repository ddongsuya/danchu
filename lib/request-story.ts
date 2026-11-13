/**
 * 의뢰자 화면의 "요청 이야기" 숫자와 문장 (2026-10-29 대표 지시: 홈은 한 장면 요약, 요청은 지나온 길, 비교표는 보고서).
 * 화면은 숫자를 직접 세지 않고 여기의 함수만 쓴다. 참여·제출은 participation() 과 같은 규칙(request-policy.ts)이다.
 *
 * 공개 범위 (2026-10-20 결정 1을 지키는 선): 비교표가 열리기 전에도 의뢰자에게 합계 숫자(보낸 곳·확인한 곳·참여·제출)는 보인다.
 * 기관 이름, 기관별 불참 여부는 보이지 않는다. 그래서 "참여하지 않음"과 "아직 정하지 않음"은 한 숫자(rest)로 묶는다.
 */
import { occupiesSeat, participationLabel, type JoinFields } from "./request-policy";

export type StoryInvite = JoinFields & { opened_at?: string | null };

export type Funnel = {
  /** 요청이 전달된 기관 (운영자가 취소한 안내는 빼고) */
  sent: number;
  /** 그중 요약을 열어 본 기관 */
  opened: number;
  /** 참여한 기관 (참여·작성 중·제출) */
  joined: number;
  /** 견적을 낸 기관 */
  submitted: number;
  /** 참여하지 않았거나 아직 정하지 않은 기관 (둘을 나누지 않는다) */
  rest: number;
};

export function funnel(invites: StoryInvite[]): Funnel {
  const live = invites.filter((i) => !i.revoked_at);
  const joined = live.filter(occupiesSeat);
  // 참여·불참·철회를 했다면 요약을 본 것이다 (예전 기록에는 opened_at 이 비어 있을 수 있다)
  const opened = live.filter((i) => !!i.opened_at || !!i.joined_at || ["draft", "submitted", "declined"].includes(i.status)).length;
  const submitted = joined.filter((i) => i.status === "submitted").length;
  return { sent: live.length, opened: Math.max(opened, joined.length), joined: joined.length, submitted, rest: Math.max(0, live.length - joined.length) };
}

/** 목록·홈이 받는 합계 (요약 행에는 rest 가 없다) */
export type Counts = Pick<Funnel, "sent" | "joined" | "submitted">;

/** 홈 궤도 그림의 점 하나 = 기관 하나. f 견적 제출, h 참여(작성 중), w 그 밖(참여 안 함·아직 정하지 않음을 나누지 않음) */
export type Dot = "f" | "h" | "w";
export function dotsOf(f: Counts, max = 24): Dot[] {
  const out: Dot[] = [];
  for (let i = 0; i < f.submitted; i++) out.push("f");
  for (let i = 0; i < f.joined - f.submitted; i++) out.push("h");
  while (out.length < f.sent) out.push("w");
  return out.slice(0, max);
}

type StoryReq = { status: string; compared_at?: string | null; reply_by: string | null; selected_quote_id?: string | null; outcome?: string | null; started_at?: string | null };

const DONE = ["closed", "cancelled"];
const WAITING = ["received", "distributed", "quoted"];

/** 비교 보고서를 지금 볼 수 있는 요청 (열렸고 견적이 있다) */
export function reportReady(r: StoryReq & { submitted: number }): boolean {
  return !!r.compared_at && r.submitted > 0;
}

/** 회신 기한이 지났는데 참여한 기관이 없는 요청 (서울 날짜 today) */
export function noJoinPastDue(r: StoryReq & { joined: number }, today: string): boolean {
  return ["distributed", "quoted"].includes(r.status) && !r.compared_at && !!r.reply_by && r.reply_by < today && r.joined === 0;
}

/** 요청 목록 한 줄 설명. late 이면 빨강으로 보인다 */
export function rowLine(r: StoryReq & Counts & { cap?: number | null }, today: string, md: (d: string) => string): { text: string; late: boolean } {
  if (r.status === "cancelled") return { text: "취소한 요청이에요", late: false };
  if (r.status === "closed") return { text: r.outcome ? `선택 없이 마무리 · ${r.outcome}` : "마무리한 요청이에요", late: false };
  if (r.status === "selected" || r.status === "contracting") return { text: r.status === "contracting" ? "기관 선택 · 계약 진행 중" : "기관을 선택했어요 · 계약 소식을 기다리는 중", late: false };
  if (reportReady(r)) return { text: `비교 보고서가 열렸어요 · 견적 ${r.submitted}건`, late: false };
  if (r.status === "received" && !r.sent) return { text: "기관에 보내기 전이에요", late: false };
  if (noJoinPastDue(r, today)) return { text: "참여한 기관 없이 회신 기한이 지났어요", late: true };
  if (r.compared_at && r.submitted === 0) return { text: "도착한 견적 없이 회신이 마감됐어요", late: true };
  const pastDue = !!r.reply_by && r.reply_by < today;
  const when = r.reply_by ? (pastDue ? "곧 비교 보고서가 열려요" : `${md(r.reply_by)}까지 회신`) : "회신 기한 미정";
  if (!r.joined) return { text: `${r.sent}곳에 보냈어요 · 참여 결정 기다리는 중 · ${when}`, late: false };
  return { text: `${participationLabel({ joined: r.joined, cap: r.cap ?? null })} · 견적 ${r.submitted}건 도착 · ${when}`, late: false };
}

/** 홈 첫 장면 숫자: 진행 중인 요청이 있으면 그것만, 없으면 전체 */
export function homeTotals<T extends StoryReq & Counts>(list: T[]): { scope: "active" | "all"; reqs: T[]; sent: number; joined: number; submitted: number; ready: T[] } {
  const active = list.filter((r) => !DONE.includes(r.status));
  const reqs = active.length ? active : list;
  const sum = (k: "sent" | "joined" | "submitted") => reqs.reduce((a, r) => a + r[k], 0);
  return {
    scope: active.length ? "active" : "all",
    reqs,
    sent: sum("sent"),
    joined: sum("joined"),
    submitted: sum("submitted"),
    ready: list.filter((r) => !DONE.includes(r.status) && !r.selected_quote_id && reportReady(r)),
  };
}

/** 회신을 기다리는 단계인지 (비교표가 열리기 전) */
export const waitingReplies = (r: StoryReq) => WAITING.includes(r.status) && !r.compared_at;

/* ---- 홈 시간축 (2026-11-10 대표 선택: 시안 5 "시간축", 문구는 설명 없이 짧게) ---- */

/** ISO 시각 또는 날짜 → 서울 날짜 YYYY-MM-DD */
export function seoulDay(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
const dayNo = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 864e5);
/** b - a (일) */
export const daysBetween = (a: string, b: string) => dayNo(b) - dayNo(a);

/** 시간축의 점 하나. late 기한 지남(할 일), open 보고서 열림, plain 그 밖의 일정 */
export type TimelineEvent = { key: string; rfq_no: string; date: string; kind: "late" | "open" | "plain"; label: string; sub: string; href: string };
type TimelineReq = StoryReq & Counts & { id: string; rfq_no: string; created_at: string };

/** 진행 중인 요청마다 지금 가장 중요한 날짜 하나를 점으로 만든다. 날짜순 */
export function timelineEvents(list: TimelineReq[], today: string): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const r of list) {
    if (DONE.includes(r.status) || r.status === "selected" || r.status === "contracting") continue;
    const base = { key: r.id, rfq_no: r.rfq_no, href: `/app/r/${r.rfq_no}` };
    if (reportReady(r)) out.push({ ...base, href: `${base.href}/compare`, date: seoulDay(r.compared_at!), kind: "open", label: "보고서 열림", sub: `견적 ${r.submitted}건` });
    else if (r.compared_at) out.push({ ...base, date: seoulDay(r.compared_at), kind: "late", label: "견적 없이 마감", sub: "견적 0건" });
    else if (noJoinPastDue(r, today)) out.push({ ...base, date: r.reply_by!, kind: "late", label: "회신 기한 지남", sub: "참여 0곳" });
    else if (r.status === "received" && !r.sent) out.push({ ...base, date: seoulDay(r.created_at), kind: "plain", label: "접수", sub: "전달 전" });
    else if (r.reply_by) out.push({ ...base, date: r.reply_by, kind: "plain", label: "회신 마감", sub: r.reply_by < today ? "보고서 준비 중" : `참여 ${r.joined}곳, 견적 ${r.submitted}건` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.rfq_no.localeCompare(b.rfq_no));
}

/** 홈 제목 숫자: 할 일(기한 지남)과 다가오는 마감 */
export function timelineCounts(events: TimelineEvent[], today: string): { todo: number; due: number; open: number } {
  return {
    todo: events.filter((e) => e.kind === "late").length,
    due: events.filter((e) => e.kind === "plain" && e.label === "회신 마감" && e.date >= today).length,
    open: events.filter((e) => e.kind === "open").length,
  };
}

/** 가로 축에 놓을 자리. 축은 오늘을 포함해 앞뒤로 넉넉히 잡고, 가까운 점끼리는 줄(row)을 달리해 겹치지 않게 한다 */
export function timelineLayout(events: TimelineEvent[], today: string, minGapPct = 14): { start: string; end: string; todayPct: number; ticks: { date: string; pct: number }[]; items: (TimelineEvent & { pct: number; row: number; hidden: boolean })[] } {
  const shift = (ymd: string, n: number) => new Date(dayNo(ymd) * 864e5 + n * 864e5).toISOString().slice(0, 10);
  const clampDay = (d: string) => (d < shift(today, -45) ? shift(today, -45) : d > shift(today, 60) ? shift(today, 60) : d);
  const days = events.map((e) => clampDay(e.date));
  const first = days.reduce((a, d) => (d < a ? d : a), shift(today, -14));
  const last = days.reduce((a, d) => (d > a ? d : a), shift(today, 21));
  const start = shift(first, -5), end = shift(last, 7);
  const span = Math.max(1, daysBetween(start, end));
  const pct = (d: string) => Math.round((daysBetween(start, d) / span) * 1000) / 10;
  const lastAt: number[] = [];
  const todayPct = pct(today);
  const items = events.map((e, i) => {
    const p = pct(days[i]);
    // 오늘 선에 붙은 점은 첫 줄을 비워 선 위 이름표와 겹치지 않게 한다
    const from = Math.abs(p - todayPct) < minGapPct / 2 ? 1 : 0;
    if (from && lastAt.length === 0) lastAt[0] = -100;
    let row = lastAt.findIndex((x, k) => k >= from && p - x >= minGapPct);
    if (row < 0 && from && lastAt.length === 1) row = 1;
    // 세 줄이 다 찼는데 같은 자리에 또 오는 일정은 축에 올리지 않는다 (글자가 겹친다). 화면은 "외 n건"으로 알리고 아래 목록이 전부 보여 준다
    if (row < 0 && lastAt.length >= 3) return { ...e, pct: p, row: 0, hidden: true };
    if (row < 0) row = lastAt.length;
    lastAt[row] = p;
    return { ...e, pct: p, row, hidden: false };
  });
  const ticks: { date: string; pct: number }[] = [];
  const step = span > 70 ? 14 : 7;
  for (let d = shift(start, 4); d < end; d = shift(d, step)) ticks.push({ date: d, pct: pct(d) });
  return { start, end, todayPct, ticks, items };
}

/** 목록 한 줄: 설명 문장 없이 사실만. stage 는 5칸 진행 막대의 지금 칸(0 전달, 1 참여, 2 견적, 3 보고서, 4 선택) */
export const TRACK_STAGES = ["전달", "참여", "견적", "보고서", "선택"] as const;
export function terseRow(r: TimelineReq & { cap?: number | null }, today: string, md: (d: string) => string): { text: string; late: boolean; stage: number; done: boolean; when: string; go: string } {
  const created = `${md(seoulDay(r.created_at))} 접수`;
  if (r.status === "cancelled") return { text: "취소", late: false, stage: 0, done: true, when: created, go: "열기" };
  if (r.status === "closed") return { text: r.outcome ? `선택 없이 마무리, ${r.outcome}` : "계약 완료", late: false, stage: 4, done: true, when: created, go: "열기" };
  if (r.status === "selected" || r.status === "contracting") return { text: r.status === "contracting" ? "계약 진행 중" : "기관 선택, 계약 대기", late: false, stage: 4, done: false, when: created, go: "열기" };
  if (reportReady(r)) return { text: `견적 ${r.submitted}건`, late: false, stage: 3, done: false, when: `${md(seoulDay(r.compared_at!))} 열림`, go: "보고서" };
  if (r.status === "received" && !r.sent) return { text: "전달 전", late: false, stage: 0, done: false, when: created, go: "열기" };
  if (noJoinPastDue(r, today)) return { text: `참여 0곳, 기한 ${md(r.reply_by!)} 지남`, late: true, stage: 1, done: false, when: `${daysBetween(r.reply_by!, today)}일 지남`, go: "기한 변경" };
  if (r.compared_at && r.submitted === 0) return { text: "견적 0건, 회신 마감", late: true, stage: 2, done: false, when: `${md(seoulDay(r.compared_at))} 마감`, go: "열기" };
  const when = r.reply_by ? (r.reply_by < today ? "보고서 준비 중" : `${md(r.reply_by)} 마감`) : "기한 미정";
  if (!r.joined) return { text: `${r.sent}곳 전달, 참여 0곳`, late: false, stage: 1, done: false, when, go: "열기" };
  return { text: `참여 ${r.joined}곳, 견적 ${r.submitted}건`, late: false, stage: r.submitted > 0 ? 2 : 1, done: false, when, go: "열기" };
}
