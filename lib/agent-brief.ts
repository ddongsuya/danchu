/**
 * 견적 에이전트 기관 비서가 읽는 묶음 (에이전트 액션 brief·report, 2026-11-19).
 *
 * - "오늘" 화면(components/cro/crm/TodayView)과 같은 계산을 쓴다: 오늘 할 일(todayList), 손이 필요한 안건(dealRows flag).
 * - 비서가 고칠 대상을 고르도록 진행 중인 안건·할 일·다가오는 일정·고객사·담당자·기관 담당자 목록을 함께 준다(크기 상한 있음).
 * - 금액은 넣지 않는다. 보고 숫자(수주율 등)는 코드가 계산해 따로(report) 준다. 담당자 이메일·전화는 넣지 않는다.
 * - 기관 하나의 것만 읽는다(org_id). 선정 전 단추 의뢰자 회사는 CRM 에 들어오지 않는다(lib/crm.ts syncDanchu).
 */
import { buildReport, dealRows, STAGE_LABEL, todayList, type DanchuSrc, type Stage } from "./crm-deals";
import { addDaysYmd, hmKst, mondayOf, todayKst, ymdKst } from "./crm-shape";
import type { CrmData } from "./crm";

export const BRIEF_LIMITS = { deals: 60, tasks: 60, events: 40, companies: 150, contacts: 150, need: 20 } as const;

export type AgentBrief = {
  date: string;
  /** 오늘 할 일: 일정·기한 지난 할 일·단추 기한(오늘·내일) */
  today: { kind: "event" | "task" | "danchu"; time: string | null; title: string; sub: string; done: boolean; overdue: boolean; badge: string; taskId: string | null; eventId: string | null }[];
  /** 손이 필요한 안건(회신 기한·계약 결과 보고·견적 유효기간·다음 할 일 없음). 제안만 한다 */
  need: { dealId: string; title: string; company: string | null; reason: string; tone: "warn" | "due"; suggest: string; danchuNo: string | null }[];
  deals: { id: string; title: string; company: string | null; stage: string; stageLabel: string; next: string | null; mine: boolean; danchuNo: string | null }[];
  tasks: { id: string; title: string; due: string | null; assignee: string | null; dealId: string | null }[];
  events: { id: string; title: string; date: string; time: string | null; dealId: string | null }[];
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string; title: string; companyId: string }[];
  members: { id: string; name: string; me: boolean }[];
};

/** 순수 함수: CRM 묶음 → 비서 브리핑 */
export function buildBrief(a: { data: CrmData; danchu: Map<string, DanchuSrc>; me: string; now?: number }): AgentBrief {
  const now = a.now ?? Date.now();
  const today = todayKst(now);
  const d = a.data;
  const rows = dealRows({ deals: d.deals, companies: d.companies, contacts: d.contacts, tasks: d.tasks, events: d.events, quotes: d.quotes, danchu: a.danchu, me: a.me, now });
  const undecided = [...a.danchu.values()];
  const list = todayList({ tasks: d.tasks, events: d.events, rows, invites: undecided, me: a.me, now });
  const memberName = new Map(d.members.map((m) => [m.id, m.name]));
  const open = rows.filter((r) => r.deal.status === "open");
  const need = open
    .filter((r) => r.flag)
    .sort((x, y) => (x.flag!.tone === y.flag!.tone ? y.days - x.days : x.flag!.tone === "due" ? -1 : 1))
    .slice(0, BRIEF_LIMITS.need)
    .map((r) => ({ dealId: r.deal.id, title: r.deal.title, company: r.company, reason: r.flag!.label, tone: r.flag!.tone, suggest: r.flag!.action, danchuNo: r.danchuNo }));
  const deals = open
    .sort((x, y) => Number(y.mine) - Number(x.mine) || y.deal.updated_at.localeCompare(x.deal.updated_at))
    .slice(0, BRIEF_LIMITS.deals)
    .map((r) => ({
      id: r.deal.id,
      title: r.deal.title,
      company: r.company,
      stage: r.deal.stage,
      stageLabel: STAGE_LABEL[r.deal.stage as Stage] ?? r.deal.stage,
      next: r.next ? [r.next.at, r.next.label].filter(Boolean).join(" ") : null,
      mine: r.mine,
      danchuNo: r.danchuNo,
    }));
  const tasks = d.tasks
    .filter((t) => !t.done_at)
    .sort((x, y) => (x.due_on ?? "9").localeCompare(y.due_on ?? "9"))
    .slice(0, BRIEF_LIMITS.tasks)
    .map((t) => ({ id: t.id, title: t.title, due: t.due_on, assignee: t.assignee ? memberName.get(t.assignee) ?? null : null, dealId: t.deal_id }));
  const until = addDaysYmd(today, 14);
  const events = d.events
    .filter((e) => !e.done_at && ymdKst(e.starts_at) >= today && ymdKst(e.starts_at) <= until)
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at))
    .slice(0, BRIEF_LIMITS.events)
    .map((e) => ({ id: e.id, title: e.title, date: ymdKst(e.starts_at), time: e.all_day ? null : hmKst(e.starts_at), dealId: e.deal_id }));
  // 고객사: 진행 중 안건의 고객사 먼저, 그다음 최근에 고친 순
  const dealCos = new Set(open.map((r) => r.deal.company_id).filter((x): x is string => !!x));
  const companies = [...d.companies]
    .sort((x, y) => Number(dealCos.has(y.id)) - Number(dealCos.has(x.id)) || y.updated_at.localeCompare(x.updated_at))
    .slice(0, BRIEF_LIMITS.companies);
  const coIds = new Set(companies.map((c) => c.id));
  const contacts = d.contacts.filter((c) => coIds.has(c.company_id)).slice(0, BRIEF_LIMITS.contacts);
  return {
    date: today,
    today: list.map((x) => ({ kind: x.kind, time: x.time, title: x.title, sub: x.sub, done: x.done, overdue: x.overdue, badge: x.badge, taskId: x.taskId ?? null, eventId: x.eventId ?? null })),
    need,
    deals,
    tasks,
    events,
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, title: c.title, companyId: c.company_id })),
    members: d.members.map((m) => ({ id: m.id, name: m.name, me: m.id === a.me })),
  };
}

export type AgentReport = {
  from: string;
  to: string;
  created: number;
  won: number;
  lost: number;
  /** 끝난 안건 중 수주 비율(%) */
  winRate: number | null;
  /** 수주 금액 합계(원). 코드가 계산한 값. 모델 맥락에는 넣지 않는다 */
  wonSum: number;
  reasons: { reason: string; count: number }[];
  funnel: { stage: string; label: string; count: number }[];
  activity: { member: string; meeting: number; call: number; email: number; memo: number; tasks: number }[];
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 기간: 둘 다 맞는 날짜면 그 기간(최대 1년), 아니면 이번 주 월요일 ~ 오늘 */
export function reportRange(from: unknown, to: unknown, now = Date.now()): { from: string; to: string } {
  const today = todayKst(now);
  if (typeof from === "string" && typeof to === "string" && YMD.test(from) && YMD.test(to) && from <= to && to <= addDaysYmd(from, 366)) return { from, to };
  return { from: mondayOf(today), to: today };
}

/** 순수 함수: CRM 묶음 → 기간 보고(코드 계산) */
export function buildAgentReport(d: CrmData, range: { from: string; to: string }, now = Date.now()): AgentReport {
  const r = buildReport({ deals: d.deals, history: d.history, activities: d.activities, tasks: d.tasks, members: d.members, from: range.from, to: range.to, now });
  return {
    from: r.from,
    to: r.to,
    created: r.created,
    won: r.won,
    lost: r.lost,
    winRate: r.winRate,
    wonSum: r.wonSum,
    reasons: r.reasons,
    funnel: r.funnel.map((f) => ({ stage: f.stage, label: STAGE_LABEL[f.stage], count: f.count })),
    activity: r.activity,
  };
}
