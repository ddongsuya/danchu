import type { NavItem } from "@/components/shell/Shell";
import { type CroPaths } from "@/components/cro/Pipeline";
import type { CrmPaths } from "@/components/cro/crm/opts";
import type { Session } from "@/lib/auth";
import type { CrmData } from "@/lib/crm";
import { kstToIso, mondayOf, todayKst, addDaysYmd } from "@/lib/crm-shape";

export const PATHS: CroPaths = { pipe: "/design-preview/cro-crm", clients: "/design-preview/cro-crm/clients" };
export const CPATHS: CrmPaths = { clients: PATHS.clients, calendar: "/design-preview/cro-crm/calendar", pipe: PATHS.pipe, docs: "/cro/docs", newDoc: "/cro/docs/new", ics: "/api/cro/crm/ics" };
export const NAV: NavItem[] = [
  { href: PATHS.pipe, label: "견적 진행", icon: "inbox", exact: true },
  { href: PATHS.clients, label: "고객사", icon: "clients" },
  { href: CPATHS.calendar, label: "캘린더", icon: "calendar" },
  { href: "/cro/docs", label: "견적서", icon: "quote" },
  { href: "/cro/notifications", label: "알림", icon: "bell" },
  { href: "/design-preview/catalog", label: "시험 목록", icon: "list" },
  { href: "/cro/org", label: "기관", icon: "org" },
  { href: "/cro/billing", label: "청구", icon: "receipt" },
];

const DAY = 864e5;
const at = (now: number, d: number) => new Date(now + d * DAY).toISOString();
const ymd = (now: number, d: number) => new Date(now + d * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/**
 * 화면 설명용 예시. 회사·금액은 실제 값이 아니다.
 * 한 기관이 받은 요청 6건: 참여 결정 전 2, 작성 중 1, 제출 1, 선정 2(하나는 계약 보고 남음), 미선정 1
 */
export function sample(now = Date.now()) {
  const rfq = (n: number, o: Record<string, unknown> = {}) => ({
    rfq_no: `DC-2026-01${n}`, substance: `예시 물질 ${n}`, categories: ["일반독성"], org_type: "제약사", company: `예시 의뢰사 ${String.fromCharCode(64 + n)}`,
    status: "distributed", selected_quote_id: null, compared_at: null, join_by: ymd(now, 3), user_id: `u${n}`, contact_name: "담당자", email: `contact${n}@example.invalid`, phone: "", ...o,
  });
  const inv = (n: number, o: Record<string, unknown>) => ({
    id: `00000000-0000-4000-8000-00000000010${n}`, rfq_id: `r${n}`, rfq_no: `DC-2026-01${n}`, status: "sent", sent_at: at(now, -4), reply_by: ymd(now, 12), expires_at: at(now, 30),
    joined_at: null, withdrawn_at: null, revoked_at: null, quote: null, rfq: rfq(n), ...o,
  });
  const q = (id: string, amount: number, o: Record<string, unknown> = {}) => ({ id, status: "submitted", total_amount: amount, submitted_at: at(now, -6), first_submitted_at: at(now, -6), valid_until: ymd(now, 40), ...o });
  const invites = [
    inv(1, { rfq: rfq(1, { categories: ["일반독성", "유전독성"] }) }),
    inv(2, { rfq: rfq(2, { categories: ["안전성약리"], join_by: ymd(now, 11) }), reply_by: ymd(now, 20) }),
    inv(3, { joined_at: at(now, -2), status: "draft", quote: q("q3", 42_000_000, { status: "draft", submitted_at: null, first_submitted_at: null }) }),
    inv(4, { joined_at: at(now, -9), status: "submitted", quote: q("q4", 86_000_000), rfq: rfq(4, { compared_at: at(now, -1) }) }),
    inv(5, { joined_at: at(now, -30), status: "submitted", quote: q("q5", 120_000_000), rfq: rfq(5, { status: "selected", selected_quote_id: "q5", company: "가람바이오", contact_name: "박 팀장" }) }),
    inv(6, { joined_at: at(now, -60), status: "submitted", quote: q("q6", 64_000_000), rfq: rfq(6, { status: "contracting", selected_quote_id: "q6", company: "가람바이오", contact_name: "박 팀장", user_id: "u5" }) }),
    inv(7, { joined_at: at(now, -20), status: "submitted", quote: q("q7", 55_000_000), rfq: rfq(7, { status: "selected", selected_quote_id: "other" }) }),
  ];
  const award = (n: number, i: (typeof invites)[number], amount: number, o: Record<string, unknown>) => ({
    id: `a${n}`, invite_id: i.id, rfq_id: i.rfq_id, awarded_at: at(now, -5), contract_reported_at: null, contract_amount: null, substance_updated_at: null, quoteAmount: amount,
    rfq: i.rfq, ...o,
  });
  const awards = [
    award(5, invites[4], 120_000_000, {}),
    award(6, invites[5], 64_000_000, { awarded_at: at(now, -40), contract_reported_at: at(now, -30), contract_amount: 61_500_000 }),
  ];
  return { invites, awards };
}

export const SESSION: Session = {
  userId: "crm-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
  profile: { id: "crm-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
};

export function previewEnabled() {
  return process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
}

/** 검토 화면의 "이번 주": 주말이면 다음 주 월요일 (예시 일정이 비어 보이지 않게) */
export function previewMonday(now = Date.now()) {
  const t = todayKst(now);
  const wd = new Date(`${t}T12:00:00+09:00`).getUTCDay();
  return wd === 0 || wd === 6 ? mondayOf(addDaysYmd(t, 2)) : mondayOf(t);
}
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ME = "crm-preview";
const MEMBERS = [{ id: ME, name: "검토 계정" }, { id: id(901), name: "오 연구원" }];

/**
 * CRM 화면 설명용 예시 (0038). 회사·사람·금액은 실제 값이 아니다. 날짜는 오늘 기준으로 움직인다.
 * 가람바이오: 단추에서 선정된 고객사(담당자 3, 견적 2, 기록·일정·할 일). 나머지 네 곳은 기관이 직접 추가.
 */
export function crmSample(now = Date.now()): CrmData {
  const t = todayKst(now);
  const mon = previewMonday(now);
  const d = (n: number) => addDaysYmd(t, n);
  const iso = (n: number, hm = "10:00") => kstToIso(d(n), hm);
  const wk = (n: number, hm: string) => kstToIso(addDaysYmd(mon, n), hm);
  const co = (n: number, name: string, o: Partial<CrmData["companies"][number]> = {}) => ({
    id: id(n), org_id: "org", name, aliases: [], industry: "바이오텍", biz_no: "", address: "", website: "", memo: "", first_deal: false, source: "manual", created_by: ME, created_at: iso(-90), updated_at: iso(-3), ...o,
  });
  const companies = [
    co(1, "가람바이오", { source: "danchu", first_deal: true, biz_no: "000-00-00000", address: "본사 3층 회의실", aliases: ["Garam Bio"] }),
    co(2, "나래제약", { industry: "제약사" }),
    co(3, "다온메디칼", { industry: "의료기기", created_at: iso(-60) }),
    co(4, "라온코스메틱", { industry: "화장품", created_at: iso(-80) }),
    co(5, "마루테라퓨틱스", { first_deal: false }),
    co(6, "(주)나래제약", { industry: "제약사", created_at: iso(-10) }),
  ];
  const ct = (n: number, c: number, name: string, o: Partial<CrmData["contacts"][number]> = {}) => ({
    id: id(100 + n), org_id: "org", company_id: id(c), name, dept: "", title: "", role: null, email: `contact${n}@example.invalid`, phone: "", mobile: "", memo: "", source: "manual", danchu_key: null, created_by: ME, created_at: iso(-60), updated_at: iso(-3), ...o,
  });
  const contacts = [
    ct(1, 1, "박 팀장", { dept: "비임상팀", title: "팀장", role: "decision", phone: "02-000-0000", mobile: "010-0000-0000", source: "danchu", danchu_key: "u5" }),
    ct(2, 1, "윤 선임", { dept: "비임상팀", title: "선임", role: "user" }),
    ct(3, 1, "강 과장", { dept: "구매팀", title: "과장", role: "contract" }),
    ct(4, 2, "이 수석", { title: "수석", role: "decision" }),
    ct(5, 2, "한 책임", { title: "책임" }),
    ct(6, 3, "최 책임", { title: "책임", role: "decision" }),
    ct(7, 4, "정 대리", { title: "대리" }),
    ct(8, 5, "한 이사", { title: "이사", role: "decision" }),
  ];
  const ev = (n: number, c: number | null, title: string, starts: string, ends: string | null, o: Partial<CrmData["events"][number]> = {}) => ({
    id: id(200 + n), org_id: "org", company_id: c ? id(c) : null, contact_id: null, quote_doc_id: null, kind: "meeting", title, starts_at: starts, ends_at: ends, all_day: false, mode: "in_person", location: "",
    attendee_contacts: [], attendee_members: [ME], attendees_extra: "", requests: "", remind: true, reminded_at: null, done_at: null, created_by: ME, created_at: iso(-5), updated_at: iso(-5), ...o,
  });
  const events = [
    ev(1, 1, "견적 설명 · 회복군 포함 여부 결정", wk(1, "14:00"), wk(1, "15:00"), { location: "가람바이오 본사 3층 회의실", contact_id: id(101), attendee_contacts: [id(101), id(102)], attendee_members: [ME, id(901)], requests: "회복군 4주 포함안과 미포함안 금액 비교, 시험 시작 가능 시점", quote_doc_id: id(301) }),
    ev(2, 3, "통화 · 다온 최 책임", wk(0, "10:00"), wk(0, "10:30"), { kind: "call", mode: "phone", contact_id: id(106), attendee_contacts: [id(106)] }),
    ev(3, 5, "마루테라퓨틱스 킥오프", wk(2, "11:00"), wk(2, "12:00"), { mode: "video", location: "https://meet.example.invalid/maru", attendee_contacts: [id(108)] }),
    ev(4, 3, "다온메디칼 시설 방문", wk(4, "10:00"), wk(4, "12:00"), { attendee_contacts: [id(106)], attendee_members: [id(901)] }),
    ev(5, 4, "통화 · 라온 정 대리", wk(3, "16:00"), wk(3, "16:30"), { kind: "call", mode: "phone", attendee_contacts: [id(107)] }),
    ev(6, 5, "회신 약속 · 수정 견적", kstToIso(d(9), "00:00"), null, { kind: "deadline", all_day: true, mode: null, attendee_contacts: [id(108)] }),
    ev(7, 2, "나래제약 견적 검토 회의", iso(-2, "15:00"), iso(-2, "16:00"), { mode: "video", attendee_contacts: [id(104)] }),
  ];
  const act = (n: number, c: number, kind: string, at: string, title: string, body: string, o: Partial<CrmData["activities"][number]> = {}) => ({
    id: id(400 + n), org_id: "org", company_id: id(c), contact_id: null, quote_doc_id: null, event_id: null, kind, occurred_at: at, duration_min: null, title, body, attendee_contacts: [], attendee_members: [ME],
    created_by: ME, created_at: at, updated_at: at, ...o,
  });
  const activities = [
    act(1, 1, "call", iso(-3, "16:20"), "", "13주 반복투여에 회복군 4주 넣은 금액도 같이 받고 싶다고 함. 내부 예산은 2억 안쪽. 다음 주 화요일 대면 미팅 잡음.", { contact_id: id(101), attendee_contacts: [id(101)], duration_min: 12 }),
    act(2, 1, "email", iso(-8, "09:40"), "시험물질 정보 요청", "물질 형태, 용해도, 보관 조건을 물어봄", { contact_id: id(102), attendee_contacts: [id(102)] }),
    act(3, 2, "email", iso(-7, "11:00"), "견적 유효기간 안내", "", { contact_id: id(104) }),
    act(4, 3, "meeting", iso(-14, "14:00"), "시설 소개", "동물실 견학 희망. 다음 달 방문 일정 조율", { contact_id: id(106), duration_min: 60 }),
    act(5, 5, "meeting", iso(-1, "10:00"), "과제 범위 협의", "단회·반복 두 건을 묶어서 볼 예정", { contact_id: id(108), duration_min: 50 }),
    act(6, 4, "call", iso(-34, "15:00"), "", "다음 분기 예산 확정 뒤 다시 연락하기로", { contact_id: id(107), duration_min: 8 }),
  ];
  const tk = (n: number, c: number, title: string, due: string | null, o: Partial<CrmData["tasks"][number]> = {}) => ({
    id: id(500 + n), org_id: "org", company_id: id(c), contact_id: null, quote_doc_id: null, activity_id: null, title, memo: "", category: "contact", due_on: due, assignee: ME, done_at: null, done_by: null,
    created_by: ME, created_at: iso(-3), updated_at: iso(-3), actions: [], ...o,
  });
  const tasks = [
    tk(1, 1, "회복군 포함안 금액 다시 보내기", d(1), { contact_id: id(101), category: "reply", activity_id: id(401), actions: [{ id: id(601), task_id: id(501), body: "원가 검토 요청함", at: iso(-1), created_by: ME }] }),
    tk(2, 1, "시험물질 안정성 자료 받기", null, { contact_id: id(102), category: "material", assignee: id(901) }),
    tk(3, 4, "정 대리에게 안부 연락", d(0), { contact_id: id(107) }),
    tk(4, 1, "시험의뢰서 초안 공유", d(-6), { done_at: iso(-5), done_by: ME, contact_id: id(101) }),
  ];
  const qd = (n: number, c: number | null, doc: string, title: string, supply: number, o: Partial<CrmData["quotes"][number]> = {}) => ({
    id: id(300 + n), doc_no: doc, title, client: c ? companies[c - 1].name : "", supply, status: "sent", deal_stage: null, sent_at: iso(-8, "10:05"), valid_until: d(22), contract_amount: null, lost_reason: "",
    company_id: c ? id(c) : null, contact_id: null, rfq_no: null, updated_at: iso(-8), issued_on: d(-8), invite_id: null, ...o,
  });
  const quotes = [
    qd(1, 1, "Q-2610-014", "반복투여 13주 (랫드)", 122_000_000, { contact_id: id(101), deal_stage: "negotiating" }),
    qd(2, 1, "Q-2610-009", "단회투여 (랫드)", 62_000_000, { contact_id: id(101), deal_stage: "won", contract_amount: 60_000_000, sent_at: iso(-30), valid_until: d(-1) }),
    qd(3, 2, "Q-2610-011", "유전독성 3종", 62_000_000, { contact_id: id(104), valid_until: d(5) }),
    qd(4, 5, "Q-2611-002", "반복투여 4주 (비글)", 180_000_000, { contact_id: id(108) }),
    qd(5, 5, "Q-2611-003", "단회투여 (비글)", 230_000_000, { contact_id: id(108), deal_stage: "negotiating" }),
    qd(6, 4, "Q-2609-021", "피부자극", 29_000_000, { contact_id: id(107), sent_at: iso(-40), valid_until: d(10) }),
    qd(7, null, "Q-2611-005", "안전성약리 핵심 3종", 48_000_000, { status: "draft", sent_at: null, client: "단추 밖 의뢰자" }),
  ];
  const tracks = [
    { id: id(701), doc_id: id(301), stage: "negotiating", note: "회복군 포함안 따로 받기를 원함", created_by: ME, created_at: iso(-3, "16:30") },
    { id: id(702), doc_id: id(302), stage: "won", note: "", created_by: ME, created_at: iso(-20) },
  ];
  return { ready: true, companies, contacts, events, activities, tasks, quotes, tracks, members: MEMBERS };
}
