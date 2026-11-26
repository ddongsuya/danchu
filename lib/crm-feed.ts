/**
 * 기관 CRM 활동 목록 (2026-11-26, 와이어프레임 v7 c-activity). DB 접근 없음: 화면·테스트가 함께 쓴다.
 * 기관 전체의 통화·메일·미팅·메모(cro_crm_activities), 할 일(cro_crm_tasks), 일정(cro_crm_events), 단추 요청에서 일어난 일을 한 줄씩 모은다.
 * 기록과 단추 일은 안건·고객사 타임라인과 같은 규칙(buildTimeline)으로 만들고, 할 일·일정은 날짜(마감일·시작 시각)로 줄을 세운다.
 */
import { buildTimeline, type DanchuSrc } from "./crm-deals";
import { EVENT_KIND, EVENT_MODE, addDaysYmd, isUuid, kstToIso, personLabel, todayKst, ymdKst, type CrmActivity, type CrmCompany, type CrmContact, type CrmDeal, type CrmEvent, type CrmTask, type DealHistory, type Member } from "./crm-shape";
import { isAudioFile } from "./crm-files";

export const FEED_KINDS = { call: "통화", email: "메일", meeting: "미팅", memo: "메모", task: "할 일", event: "일정", danchu: "단추 요청" } as const;
export type FeedKind = keyof typeof FEED_KINDS;
export const FEED_PERIODS = { "7": "7일", "30": "30일", "90": "90일", all: "전체 기간" } as const;
export type FeedPeriod = keyof typeof FEED_PERIODS;

export type FeedItem = {
  key: string;
  at: string;
  /** 시각이 없는 줄 (할 일 마감일, 종일 일정) */
  allDay: boolean;
  kind: FeedKind;
  title: string;
  sub: string;
  body: string;
  dealId: string | null;
  companyId: string | null;
  contactIds: string[];
  /** 우리 쪽 담당 (기록 남긴 사람 · 할 일 담당 · 일정 참석 · 안건 담당) */
  owner: string | null;
  company: string | null;
  people: string[];
  files: number;
  audio: boolean;
  /** 할 일·일정: 끝냈는지 */
  done: boolean;
};

const ACT = new Set<string>(["call", "email", "meeting", "memo"]);

export function buildFeed(a: {
  activities: CrmActivity[]; tasks: CrmTask[]; events: CrmEvent[]; deals: CrmDeal[]; history: DealHistory[];
  companies: Pick<CrmCompany, "id" | "name">[]; contacts: Pick<CrmContact, "id" | "name" | "title" | "email">[]; members: Member[]; danchu: Map<string, DanchuSrc>;
}): FeedItem[] {
  const dealBy = new Map(a.deals.map((d) => [d.id, d]));
  const actBy = new Map(a.activities.map((x) => [x.id, x]));
  const coName = new Map(a.companies.map((c) => [c.id, c.name]));
  const ct = new Map(a.contacts.map((c) => [c.id, c]));
  const names = (ids: string[]) => ids.map((id) => ct.get(id)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => personLabel(x.name, x.title));
  const uniq = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x))];
  const where = (companyId: string | null, dealId: string | null) => companyId ?? (dealId ? dealBy.get(dealId)?.company_id ?? null : null);
  const out: FeedItem[] = [];
  const push = (x: Omit<FeedItem, "company" | "people">) => out.push({ ...x, company: x.companyId ? coName.get(x.companyId) ?? null : null, people: names(x.contactIds) });

  // 기록 · 단추 일: 타임라인과 같은 줄 (단추 일에는 단추가 옮긴 단계가 붙는다)
  const danchu = a.deals.filter((d) => d.invite_id && a.danchu.has(d.invite_id)).map((d) => ({ dealId: d.id, src: a.danchu.get(d.invite_id as string)!, contacts: d.contact_ids.length }));
  const tl = buildTimeline({ activities: a.activities, history: a.history.filter((h) => h.actor === "danchu"), quotes: [], tasks: [], contacts: a.contacts, members: a.members, danchu, deals: a.deals });
  let n = 0;
  for (const x of tl) {
    if (x.kind === "danchu") {
      const d = x.dealId ? dealBy.get(x.dealId) : undefined;
      push({ key: `d${n++}`, at: x.at, allDay: false, kind: "danchu", title: x.title, sub: [d?.title, x.sub].filter(Boolean).join(" · "), body: "", dealId: x.dealId, companyId: d?.company_id ?? null, contactIds: d?.contact_ids ?? [], owner: d?.owner ?? null, files: 0, audio: false, done: false });
      continue;
    }
    if (!ACT.has(x.kind) || x.ref?.type !== "activity") continue;
    const r = actBy.get(x.ref.id);
    if (!r) continue;
    push({
      // 종류 · 고객사 · 사람은 줄의 다른 칸에 있으니 제목은 기록 제목과 걸린 시간만
      key: `a${r.id}`, at: x.at, allDay: false, kind: r.kind as FeedKind, title: [r.title, r.duration_min ? `${r.duration_min}분` : ""].filter(Boolean).join(" · "), sub: r.deal_id ? dealBy.get(r.deal_id)?.title ?? "" : "", body: r.body, dealId: r.deal_id, companyId: where(r.company_id, r.deal_id),
      contactIds: uniq([r.contact_id, ...r.attendee_contacts]), owner: r.created_by ?? r.attendee_members[0] ?? null, files: r.files?.length ?? 0, audio: (r.files ?? []).some(isAudioFile), done: false,
    });
  }
  // 할 일: 끝낸 것은 끝낸 시각, 아니면 마감일(없으면 만든 날)
  for (const t of a.tasks) {
    const at = t.done_at ?? (t.due_on ? kstToIso(t.due_on, "12:00") : t.created_at);
    push({
      key: `t${t.id}`, at, allDay: !t.done_at && !!t.due_on, kind: "task", title: t.title, sub: [t.deal_id ? dealBy.get(t.deal_id)?.title : "", t.done_at ? "끝냄" : t.due_on ? "마감" : "기한 없음"].filter(Boolean).join(" · "),
      body: t.memo, dealId: t.deal_id, companyId: where(t.company_id, t.deal_id), contactIds: uniq([t.contact_id]), owner: t.assignee ?? t.created_by, files: 0, audio: false, done: !!t.done_at,
    });
  }
  for (const e of a.events) {
    push({
      key: `e${e.id}`, at: e.starts_at, allDay: e.all_day, kind: "event", title: e.title, sub: [e.deal_id ? dealBy.get(e.deal_id)?.title : "", EVENT_KIND[e.kind], e.mode ? EVENT_MODE[e.mode] : "", e.location].filter(Boolean).join(" · "),
      body: e.requests, dealId: e.deal_id, companyId: where(e.company_id, e.deal_id), contactIds: uniq([e.contact_id, ...e.attendee_contacts]), owner: e.attendee_members[0] ?? e.created_by, files: 0, audio: false, done: !!e.done_at,
    });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

export type FeedQuery = { k: FeedKind | ""; co: string; p: string; o: string; d: FeedPeriod; q: string };

export function parseFeedQuery(sp: Record<string, string | undefined>): FeedQuery {
  return {
    k: sp.k && sp.k in FEED_KINDS ? (sp.k as FeedKind) : "",
    co: isUuid(sp.co) ? sp.co : "",
    p: isUuid(sp.p) ? sp.p : "",
    // 기관 담당자 id 는 uuid 가 아닐 수도 있어(검토 화면) 모양만 본다
    o: typeof sp.o === "string" && /^[A-Za-z0-9-]{1,64}$/.test(sp.o) ? sp.o : "",
    d: sp.d && sp.d in FEED_PERIODS ? (sp.d as FeedPeriod) : "30",
    q: (sp.q ?? "").trim().slice(0, 60),
  };
}

/** 기간은 오늘 앞뒤로 같은 날수 (지난 기록과 다가오는 할 일·일정을 함께 본다) */
export function filterFeed(items: FeedItem[], q: Omit<FeedQuery, "k"> & { k?: FeedKind | "" }, now = Date.now()): FeedItem[] {
  const t = todayKst(now);
  const from = q.d === "all" ? "" : addDaysYmd(t, -Number(q.d));
  const to = q.d === "all" ? "9" : addDaysYmd(t, Number(q.d));
  const needle = q.q.toLowerCase();
  return items.filter((x) => {
    if (q.k && x.kind !== q.k) return false;
    if (q.co && x.companyId !== q.co) return false;
    if (q.p && !x.contactIds.includes(q.p)) return false;
    if (q.o && x.owner !== q.o) return false;
    const day = ymdKst(x.at);
    if (day < from || day > to) return false;
    if (needle && ![x.title, x.sub, x.body, x.company ?? "", ...x.people].some((s) => s.toLowerCase().includes(needle))) return false;
    return true;
  });
}

/** 종류별 건수 (거르기 칩) */
export function feedCounts(items: FeedItem[]): Record<FeedKind, number> {
  const c = Object.fromEntries(Object.keys(FEED_KINDS).map((k) => [k, 0])) as Record<FeedKind, number>;
  for (const x of items) c[x.kind]++;
  return c;
}
