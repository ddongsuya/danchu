/**
 * 기관 CRM 1차 (2026-11-07, 0038) 공통 규칙. 서버·화면·테스트가 함께 쓴다 (DB 접근 없음).
 * 구조는 CRMQUOTATION(Company·Contact·Quote·Note·Task·TaskAction·CalendarEvent)을 기관 단위로 옮겼다.
 * 고객사 → 담당자 → 담당자에게 보낸 견적 → 기록(미팅·통화·메일·메모) → 할 일 → 일정.
 */

// ─── 행 타입 (DB 그대로) ───
export type CrmCompany = {
  id: string; org_id: string; name: string; aliases: string[]; industry: string; biz_no: string; address: string; website: string; memo: string;
  first_deal: boolean; source: string; created_by: string | null; created_at: string; updated_at: string;
};
export type CrmContact = {
  id: string; org_id: string; company_id: string; name: string; dept: string; title: string; role: string | null; email: string; phone: string; mobile: string; memo: string;
  source: string; danchu_key: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type CrmEvent = {
  id: string; org_id: string; company_id: string | null; contact_id: string | null; quote_doc_id: string | null; kind: string; title: string;
  starts_at: string; ends_at: string | null; all_day: boolean; mode: string | null; location: string; attendee_contacts: string[]; attendee_members: string[];
  attendees_extra: string; requests: string; remind: boolean; reminded_at: string | null; done_at: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type CrmActivity = {
  id: string; org_id: string; company_id: string; contact_id: string | null; quote_doc_id: string | null; event_id: string | null; kind: string;
  occurred_at: string; duration_min: number | null; title: string; body: string; attendee_contacts: string[]; attendee_members: string[];
  created_by: string | null; created_at: string; updated_at: string;
};
export type CrmTaskAction = { id: string; task_id: string; body: string; at: string; created_by: string | null };
export type CrmTask = {
  id: string; org_id: string; company_id: string | null; contact_id: string | null; quote_doc_id: string | null; activity_id: string | null; title: string; memo: string;
  category: string; due_on: string | null; assignee: string | null; done_at: string | null; done_by: string | null; created_by: string | null; created_at: string; updated_at: string;
  actions?: CrmTaskAction[];
};
/** 고객사 화면에서 쓰는 견적서 줄 (cro_quote_docs 일부) */
export type CrmQuote = {
  id: string; doc_no: string; title: string; client: string; supply: number; status: string; deal_stage: string | null; sent_at: string | null; valid_until: string | null;
  contract_amount: number | null; lost_reason: string; company_id: string | null; contact_id: string | null; rfq_no: string | null; updated_at: string; issued_on: string; invite_id: string | null;
};
export type QuoteTrack = { id: string; doc_id: string; stage: string | null; note: string; created_by: string | null; created_at: string };
export type Member = { id: string; name: string };

// ─── 라벨 ───
export const ACT_KIND: Record<string, string> = { meeting: "미팅", call: "통화", email: "메일", memo: "메모" };
export const ACT_KINDS = ["meeting", "call", "email", "memo"] as const;
export const EVENT_KIND: Record<string, string> = { meeting: "미팅", call: "통화", deadline: "기한", other: "기타" };
export const EVENT_KINDS = ["meeting", "call", "deadline", "other"] as const;
export const EVENT_MODE: Record<string, string> = { in_person: "대면", video: "화상", phone: "전화" };
export const EVENT_MODES = ["in_person", "video", "phone"] as const;
export const CONTACT_ROLE: Record<string, string> = { decision: "결정권자", user: "실무", contract: "계약", finance: "정산", other: "기타" };
export const CONTACT_ROLES = ["decision", "user", "contract", "finance", "other"] as const;
export const TASK_CAT: Record<string, string> = { contact: "연락", reply: "회신", material: "자료 준비", meeting: "미팅 준비", internal: "내부", other: "기타" };
export const TASK_CATS = ["contact", "reply", "material", "meeting", "internal", "other"] as const;
export const QUOTE_STAGE: Record<string, string> = { draft: "작성 중", sent: "보냄", negotiating: "협의 중", won: "수주", lost: "실패" };
export const QUOTE_STAGES = ["draft", "sent", "negotiating", "won", "lost"] as const;
/** 실패 사유 기본 선택지 (CRMQUOTATION LOST_REASONS, "경쟁사 선정"은 단추 표현으로) */
export const LOST_REASONS = ["가격", "다른 기관 선정", "일정이 맞지 않음", "과제 중단·보류", "의뢰자 내부 검토 종료", "기타"] as const;
/** 연락이 이 날수보다 오래 없으면 "연락 30일 넘음"으로 묶는다 */
export const QUIET_DAYS = 30;

export const quoteStage = (q: Pick<CrmQuote, "status" | "deal_stage">): string => q.deal_stage ?? (q.status === "sent" ? "sent" : "draft");
export const isOpenQuote = (q: Pick<CrmQuote, "status" | "deal_stage">) => ["sent", "negotiating"].includes(quoteStage(q));

// ─── 날짜 (KST) ───
const DAY = 864e5;
export const ymdKst = (iso: string | Date) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
export const hmKst = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
export const todayKst = (now = Date.now()) => ymdKst(new Date(now));
/** YYYY-MM-DD + HH:MM (KST) → ISO */
export const kstToIso = (ymd: string, hm = "00:00") => new Date(`${ymd}T${hm}:00+09:00`).toISOString();
export const addDaysYmd = (ymd: string, n: number) => ymdKst(new Date(new Date(`${ymd}T12:00:00+09:00`).getTime() + n * DAY));
/** 그 주 월요일 (KST) */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  return addDaysYmd(ymd, -dow);
}
const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const weekdayKo = (ymd: string) => WD[new Date(`${ymd}T12:00:00+09:00`).getUTCDay()];
/** 11.10 화 */
export const mdW = (ymd: string) => `${+ymd.slice(5, 7)}.${ymd.slice(8, 10)} ${weekdayKo(ymd)}`;
/** 오늘 기준 D-n / D-day / n일 지남 */
export function dLabel(ymd: string, now = Date.now()): { n: number; label: string } {
  const t = todayKst(now);
  const n = Math.round((new Date(`${ymd}T12:00:00+09:00`).getTime() - new Date(`${t}T12:00:00+09:00`).getTime()) / DAY);
  return { n, label: n === 0 ? "오늘" : n === 1 ? "내일" : n > 0 ? `D-${n}` : `${-n}일 지남` };
}
/** 3일 전 · 어제 · 오늘 */
export function agoLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "연락 기록 없음";
  const n = -dLabel(ymdKst(iso), now).n;
  if (n <= 0) return "오늘";
  if (n === 1) return "어제";
  if (n < 7) return `${n}일 전`;
  if (n < 35) return `${Math.floor(n / 7)}주 전`;
  return `${Math.floor(n / 30)}달 전`;
}
/** 이름 + 직책 (이름에 이미 직책이 들어 있으면 한 번만) */
export const personLabel = (name: string, title?: string | null) => (title && !name.includes(title) ? `${name} ${title}` : name);

export const won = (n: number | null | undefined) => (n == null ? "-" : `${n.toLocaleString("ko-KR")}원`);
/** 1억 2,200만 원 */
export function wonKo(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n < 10000) return `${n.toLocaleString("ko-KR")}원`;
  const eok = Math.floor(n / 1e8);
  const man = Math.round((n % 1e8) / 1e4);
  return [eok ? `${eok}억` : "", man ? `${man.toLocaleString("ko-KR")}만` : ""].filter(Boolean).join(" ") + " 원";
}

// ─── 이름 맞추기 · 중복 ───
/** (주)·㈜·주식회사·공백·대소문자를 걷어 낸 회사 이름 */
export function normName(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\(\s*주\s*\)|㈜|주식회사|유한회사|\(\s*유\s*\)|co\.?,?\s*ltd\.?|inc\.?|corp\.?/gi, "")
    .replace(/[\s·.,\-_()]/g, "")
    .toLowerCase();
}
export const companyKeys = (c: Pick<CrmCompany, "name" | "aliases">) => [...new Set([c.name, ...(c.aliases ?? [])].map(normName).filter(Boolean))];
/** 같은 회사로 보이는 고객사 쌍 (이름·다른 표기 중 하나라도 같으면) */
export function duplicatePairs(cs: Pick<CrmCompany, "id" | "name" | "aliases">[]): [string, string][] {
  const by = new Map<string, string[]>();
  for (const c of cs) for (const k of companyKeys(c)) by.set(k, [...(by.get(k) ?? []), c.id]);
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const ids of by.values()) {
    const u = [...new Set(ids)];
    for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
      const k = [u[i], u[j]].sort().join(":");
      if (!seen.has(k)) { seen.add(k); out.push([u[i], u[j]]); }
    }
  }
  return out;
}
export function findCompanyByName<T extends Pick<CrmCompany, "name" | "aliases">>(cs: T[], name: string): T | null {
  const k = normName(name);
  if (!k) return null;
  return cs.find((c) => companyKeys(c).includes(k)) ?? null;
}

// ─── 입력 검사 ───
type Ok<T> = { ok: true; value: T };
type Bad = { ok: false; error: string };
export type Parsed<T> = Ok<T> | Bad;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strOr = (v: unknown, max: number): string | undefined => (v === undefined ? undefined : str(v, max));
const uuidOrNull = (v: unknown): string | null | undefined => (v === undefined ? undefined : isUuid(v) ? v : null);
const uuids = (v: unknown, max = 30): string[] => (Array.isArray(v) ? [...new Set(v.filter(isUuid))].slice(0, max) : []);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const okDate = (v: unknown): v is string => typeof v === "string" && YMD.test(v) && !Number.isNaN(new Date(`${v}T00:00:00+09:00`).getTime());
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 고치기(PATCH)에서는 보낸 칸만 바꾼다 */
const pick = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export type CompanyInput = { name: string; aliases: string[]; industry: string; biz_no: string; address: string; website: string; memo: string; first_deal: boolean };
export function parseCompany(b: Record<string, unknown>, partial = false): Parsed<Partial<CompanyInput>> {
  const name = strOr(b.name, 200);
  if (!partial && !name) return { ok: false, error: "고객사 이름을 적어 주세요." };
  if (partial && name !== undefined && !name) return { ok: false, error: "고객사 이름은 비워 둘 수 없어요." };
  const aliases = b.aliases === undefined ? undefined : (Array.isArray(b.aliases) ? b.aliases : String(b.aliases).split(",")).map((x) => str(x, 200)).filter(Boolean).slice(0, 20);
  const biz = strOr(b.biz_no, 20);
  if (biz && !/^[0-9-]{10,12}$/.test(biz)) return { ok: false, error: "사업자등록번호는 숫자 10자리로 적어 주세요. 예: 123-45-67890" };
  const v = pick({
    name, aliases, industry: strOr(b.industry, 60), biz_no: biz, address: strOr(b.address, 300), website: strOr(b.website, 300), memo: strOr(b.memo, 4000),
    first_deal: typeof b.first_deal === "boolean" ? b.first_deal : undefined,
  });
  return { ok: true, value: v };
}

export type ContactInput = { company_id: string; name: string; dept: string; title: string; role: string | null; email: string; phone: string; mobile: string; memo: string };
export function parseContact(b: Record<string, unknown>, partial = false): Parsed<Partial<ContactInput>> {
  const name = strOr(b.name, 100);
  if (!partial && !name) return { ok: false, error: "담당자 이름을 적어 주세요." };
  if (partial && name !== undefined && !name) return { ok: false, error: "담당자 이름은 비워 둘 수 없어요." };
  if (!partial && !isUuid(b.company_id)) return { ok: false, error: "고객사를 골라 주세요." };
  const email = strOr(b.email, 200);
  if (email && !EMAIL.test(email)) return { ok: false, error: "이메일 형식을 확인해 주세요." };
  const v = pick({
    company_id: partial ? undefined : (b.company_id as string), name, dept: strOr(b.dept, 100), title: strOr(b.title, 60),
    role: b.role === undefined ? undefined : oneOf(b.role, CONTACT_ROLES), email, phone: strOr(b.phone, 40), mobile: strOr(b.mobile, 40), memo: strOr(b.memo, 2000),
  });
  return { ok: true, value: v };
}

export type ActivityInput = {
  company_id: string; contact_id: string | null; quote_doc_id: string | null; event_id: string | null; kind: string; occurred_at: string; duration_min: number | null;
  title: string; body: string; attendee_contacts: string[]; attendee_members: string[];
};
/** 기록. date(YYYY-MM-DD)+time(HH:MM)은 KST. 없으면 지금 */
export function parseActivity(b: Record<string, unknown>, partial = false, now = Date.now()): Parsed<Partial<ActivityInput>> {
  if (!partial && !isUuid(b.company_id)) return { ok: false, error: "고객사를 골라 주세요." };
  const kind = b.kind === undefined && partial ? undefined : oneOf(b.kind, ACT_KINDS);
  if (kind === null) return { ok: false, error: "미팅·통화·메일·메모 중 하나를 골라 주세요." };
  const title = strOr(b.title, 200);
  const body = strOr(b.body, 8000);
  if (!partial && !title && !body) return { ok: false, error: "내용을 적어 주세요." };
  let occurred_at: string | undefined;
  if (b.date !== undefined || !partial) {
    const d = okDate(b.date) ? (b.date as string) : todayKst(now);
    const t = typeof b.time === "string" && HM.test(b.time) ? b.time : b.date === undefined ? new Date(now).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) : "09:00";
    occurred_at = kstToIso(d, t);
    if (new Date(occurred_at).getTime() > now + 7 * DAY) return { ok: false, error: "기록은 이미 있었던 일만 남겨요. 앞으로의 약속은 일정으로 잡아 주세요." };
  }
  const dur = b.duration_min === undefined || b.duration_min === null || b.duration_min === "" ? (b.duration_min === undefined ? undefined : null) : Math.round(Number(b.duration_min));
  if (dur != null && (!Number.isFinite(dur) || dur < 0 || dur > 1440)) return { ok: false, error: "걸린 시간은 0~1,440분 사이로 적어 주세요." };
  const v = pick({
    company_id: partial ? undefined : (b.company_id as string), contact_id: uuidOrNull(b.contact_id), quote_doc_id: uuidOrNull(b.quote_doc_id), event_id: uuidOrNull(b.event_id),
    kind: kind ?? undefined, occurred_at, duration_min: dur as number | null | undefined, title, body,
    attendee_contacts: b.attendee_contacts === undefined ? undefined : uuids(b.attendee_contacts), attendee_members: b.attendee_members === undefined ? undefined : uuids(b.attendee_members),
  });
  return { ok: true, value: v };
}

export type EventInput = {
  company_id: string | null; contact_id: string | null; quote_doc_id: string | null; kind: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean;
  mode: string | null; location: string; attendee_contacts: string[]; attendee_members: string[]; attendees_extra: string; requests: string; remind: boolean; done_at: string | null;
};
/** 일정. date + start/end(HH:MM, KST). all_day 면 시간 없이 그날 */
export function parseEvent(b: Record<string, unknown>, partial = false): Parsed<Partial<EventInput>> {
  const title = strOr(b.title, 200);
  if (!partial && !title) return { ok: false, error: "일정 제목을 적어 주세요." };
  if (partial && title !== undefined && !title) return { ok: false, error: "일정 제목은 비워 둘 수 없어요." };
  const kind = b.kind === undefined ? (partial ? undefined : "meeting") : oneOf(b.kind, EVENT_KINDS);
  if (kind === null) return { ok: false, error: "일정 종류를 골라 주세요." };
  let starts_at: string | undefined;
  let ends_at: string | null | undefined;
  let all_day: boolean | undefined;
  if (b.date !== undefined || !partial) {
    if (!okDate(b.date)) return { ok: false, error: "날짜를 골라 주세요." };
    all_day = b.all_day === true || kind === "deadline";
    const s = typeof b.start === "string" && HM.test(b.start) ? b.start : null;
    const e = typeof b.end === "string" && HM.test(b.end) ? b.end : null;
    if (!all_day && !s) return { ok: false, error: "시작 시간을 골라 주세요. 시간이 없으면 하루 종일로 바꿔 주세요." };
    starts_at = kstToIso(b.date as string, all_day ? "00:00" : (s as string));
    ends_at = all_day || !e ? null : kstToIso(b.date as string, e);
    if (ends_at && ends_at < starts_at) return { ok: false, error: "끝나는 시간이 시작보다 빨라요." };
  }
  const v = pick({
    company_id: uuidOrNull(b.company_id), contact_id: uuidOrNull(b.contact_id), quote_doc_id: uuidOrNull(b.quote_doc_id), kind: kind ?? undefined, title, starts_at, ends_at, all_day,
    mode: b.mode === undefined ? undefined : oneOf(b.mode, EVENT_MODES), location: strOr(b.location, 300),
    attendee_contacts: b.attendee_contacts === undefined ? undefined : uuids(b.attendee_contacts), attendee_members: b.attendee_members === undefined ? undefined : uuids(b.attendee_members),
    attendees_extra: strOr(b.attendees_extra, 300), requests: strOr(b.requests, 2000), remind: typeof b.remind === "boolean" ? b.remind : undefined,
    done_at: b.done === undefined ? undefined : b.done === true ? new Date().toISOString() : null,
  });
  return { ok: true, value: v };
}

export type TaskInput = {
  company_id: string | null; contact_id: string | null; quote_doc_id: string | null; activity_id: string | null; title: string; memo: string; category: string; due_on: string | null; assignee: string | null;
};
export function parseTask(b: Record<string, unknown>, partial = false): Parsed<Partial<TaskInput>> {
  const title = strOr(b.title, 200);
  if (!partial && !title) return { ok: false, error: "할 일을 적어 주세요." };
  if (partial && title !== undefined && !title) return { ok: false, error: "할 일은 비워 둘 수 없어요." };
  const due = b.due_on === undefined ? undefined : b.due_on === null || b.due_on === "" ? null : okDate(b.due_on) ? (b.due_on as string) : "bad";
  if (due === "bad") return { ok: false, error: "기한 날짜를 확인해 주세요." };
  const v = pick({
    company_id: uuidOrNull(b.company_id), contact_id: uuidOrNull(b.contact_id), quote_doc_id: uuidOrNull(b.quote_doc_id), activity_id: uuidOrNull(b.activity_id), title, memo: strOr(b.memo, 2000),
    category: b.category === undefined ? (partial ? undefined : "other") : (oneOf(b.category, TASK_CATS) ?? "other"), due_on: due as string | null | undefined, assignee: uuidOrNull(b.assignee),
  });
  return { ok: true, value: v };
}

export type QuoteLinkInput = { company_id: string | null; contact_id: string | null; deal_stage: string | null; lost_reason: string; contract_amount: number | null; sent_at: string | null; note: string };
/** 견적서 연결·진행 상태. stage 가 draft/sent 면 deal_stage 를 비운다 (견적서 status 를 따른다) */
export function parseQuoteLink(b: Record<string, unknown>): Parsed<Partial<QuoteLinkInput> & { stage?: string }> {
  const stage = b.stage === undefined ? undefined : oneOf(b.stage, QUOTE_STAGES);
  if (stage === null) return { ok: false, error: "진행 상태를 골라 주세요." };
  const amt = b.contract_amount === undefined ? undefined : b.contract_amount === null || b.contract_amount === "" ? null : Math.round(Number(String(b.contract_amount).replace(/[^0-9]/g, "")));
  if (amt != null && (!Number.isFinite(amt) || amt < 0)) return { ok: false, error: "계약 금액을 확인해 주세요." };
  const lost = strOr(b.lost_reason, 100);
  if (stage === "lost" && !lost) return { ok: false, error: "실패 사유를 골라 주세요." };
  const v = pick({
    company_id: uuidOrNull(b.company_id), contact_id: uuidOrNull(b.contact_id), stage: stage ?? undefined,
    deal_stage: stage === undefined ? undefined : stage === "negotiating" || stage === "won" || stage === "lost" ? stage : null,
    lost_reason: stage !== undefined && stage !== "lost" ? "" : lost, contract_amount: amt as number | null | undefined,
    sent_at: b.sent_on === undefined ? undefined : okDate(b.sent_on) ? kstToIso(b.sent_on as string, "09:00") : null, note: strOr(b.note, 2000),
  });
  return { ok: true, value: v };
}

// ─── 기록 묶음 (고객사 화면 가운데) ───
export type FeedItem = {
  at: string;
  kind: "meeting" | "call" | "email" | "memo" | "quote" | "track" | "task" | "award" | "contract";
  title: string;
  sub: string;
  body?: string;
  contactId: string | null;
  ref?: { type: "activity" | "quote" | "task"; id: string };
  by?: string | null;
};
export type AwardLite = { id: string; awarded_at: string; contract_reported_at: string | null; contract_amount: number | null; quoteAmount: number | null; rfqNo: string; substance: string; danchuKey: string | null };

export function buildFeed(a: {
  activities: CrmActivity[]; quotes: CrmQuote[]; tracks: QuoteTrack[]; tasks: CrmTask[]; awards: AwardLite[]; contacts: CrmContact[]; members: Member[];
}): FeedItem[] {
  const who = new Map(a.members.map((m) => [m.id, m.name]));
  const cname = new Map(a.contacts.map((c) => [c.id, c.name]));
  const byKey = new Map(a.contacts.filter((c) => c.danchu_key).map((c) => [c.danchu_key as string, c.id]));
  const out: FeedItem[] = [];
  for (const x of a.activities) {
    const ppl = [...new Set([x.contact_id, ...x.attendee_contacts].filter(Boolean) as string[])].map((id) => cname.get(id)).filter(Boolean);
    out.push({
      at: x.occurred_at, kind: x.kind as FeedItem["kind"], title: x.title || `${ppl[0] ?? ""} ${ACT_KIND[x.kind] ?? ""}`.trim(),
      sub: [ppl.join(", "), x.duration_min ? `${x.duration_min}분` : ""].filter(Boolean).join(" · "), body: x.body || undefined, contactId: x.contact_id, ref: { type: "activity", id: x.id }, by: x.created_by ? who.get(x.created_by) ?? null : null,
    });
  }
  const qById = new Map(a.quotes.map((q) => [q.id, q]));
  for (const q of a.quotes) {
    if (q.sent_at || q.status === "sent") out.push({ at: q.sent_at ?? q.updated_at, kind: "quote", title: `견적서 ${q.doc_no} 보냄 · ${wonKo(q.supply)}`, sub: [q.title, q.valid_until ? `유효기간 ${mdW(q.valid_until)}` : "", q.contact_id ? `${cname.get(q.contact_id) ?? ""} 앞` : ""].filter(Boolean).join(" · "), contactId: q.contact_id, ref: { type: "quote", id: q.id } });
  }
  for (const t of a.tracks) {
    const q = qById.get(t.doc_id);
    if (!q) continue;
    out.push({ at: t.created_at, kind: "track", title: `${q.doc_no} ${t.stage ? QUOTE_STAGE[t.stage] ?? "" : "추적 메모"}`.trim(), sub: q.title, body: t.note || undefined, contactId: q.contact_id, ref: { type: "quote", id: q.id }, by: t.created_by ? who.get(t.created_by) ?? null : null });
  }
  for (const t of a.tasks) if (t.done_at) out.push({ at: t.done_at, kind: "task", title: `할 일 끝냄 · ${t.title}`, sub: t.contact_id ? cname.get(t.contact_id) ?? "" : "", contactId: t.contact_id, ref: { type: "task", id: t.id }, by: t.done_by ? who.get(t.done_by) ?? null : null });
  for (const w of a.awards) {
    const cid = w.danchuKey ? byKey.get(w.danchuKey) ?? null : null;
    out.push({ at: w.awarded_at, kind: "award", title: `단추 요청 ${w.rfqNo}에서 이 기관을 선정`, sub: [w.substance, w.quoteAmount != null ? `선정 금액 ${wonKo(w.quoteAmount)}` : "", "회사와 담당자가 공개됐어요"].filter(Boolean).join(" · "), contactId: cid });
    if (w.contract_reported_at) out.push({ at: w.contract_reported_at, kind: "contract", title: `계약 결과 보고 · ${wonKo(w.contract_amount)}`, sub: `단추 요청 ${w.rfqNo}`, contactId: cid });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

/** 마지막 연락 (기록·보낸 견적 중 가장 최근) */
export function lastTouch(activities: Pick<CrmActivity, "company_id" | "occurred_at">[], quotes: Pick<CrmQuote, "company_id" | "sent_at">[]): Map<string, string> {
  const m = new Map<string, string>();
  const put = (k: string | null, at: string | null) => { if (k && at && (!m.has(k) || (m.get(k) as string) < at)) m.set(k, at); };
  for (const a of activities) put(a.company_id, a.occurred_at);
  for (const q of quotes) put(q.company_id, q.sent_at);
  return m;
}

// ─── 일정 모으기 (캘린더) ───
export type AgendaItem = {
  key: string;
  date: string; // YYYY-MM-DD (KST)
  start: string | null; // HH:MM, 하루 종일이면 null
  end: string | null;
  kind: "meeting" | "call" | "deadline" | "other" | "task" | "quote" | "danchu";
  title: string;
  sub: string;
  href: string | null;
  companyId: string | null;
  eventId?: string;
  taskId?: string;
  done: boolean;
  mine: boolean;
};
export type PipeDue = { id: string; no: string; title: string; next: string; due: string | null; group: string };

export function buildAgenda(a: {
  events: CrmEvent[]; tasks: CrmTask[]; quotes: CrmQuote[]; pipeline: PipeDue[]; companies: Pick<CrmCompany, "id" | "name">[]; contacts: Pick<CrmContact, "id" | "name">[];
  from: string; to: string; me?: string; base?: { clients: string; pipe: string; docs: string };
}): AgendaItem[] {
  const base = a.base ?? { clients: "/cro/clients", pipe: "/cro", docs: "/cro/docs" };
  const co = new Map(a.companies.map((c) => [c.id, c.name]));
  const ct = new Map(a.contacts.map((c) => [c.id, c.name]));
  const inR = (d: string) => d >= a.from && d <= a.to;
  const out: AgendaItem[] = [];
  for (const e of a.events) {
    const d = ymdKst(e.starts_at);
    if (!inR(d)) continue;
    out.push({
      key: `e:${e.id}`, date: d, start: e.all_day ? null : hmKst(e.starts_at), end: e.all_day || !e.ends_at ? null : hmKst(e.ends_at), kind: e.kind as AgendaItem["kind"], title: e.title,
      sub: [e.company_id ? co.get(e.company_id) : "", e.mode ? EVENT_MODE[e.mode] : "", e.location].filter(Boolean).join(" · "),
      href: null, companyId: e.company_id, eventId: e.id, done: !!e.done_at, mine: !a.me || e.created_by === a.me || e.attendee_members.includes(a.me),
    });
  }
  for (const t of a.tasks) {
    if (!t.due_on || !inR(t.due_on)) continue;
    out.push({
      key: `t:${t.id}`, date: t.due_on, start: null, end: null, kind: "task", title: t.title, sub: [t.company_id ? co.get(t.company_id) : "", t.contact_id ? ct.get(t.contact_id) : ""].filter(Boolean).join(" · "),
      href: t.company_id ? `${base.clients}/${t.company_id}?tab=tasks` : null, companyId: t.company_id, taskId: t.id, done: !!t.done_at, mine: !a.me || t.assignee === a.me || (!t.assignee && t.created_by === a.me),
    });
  }
  for (const q of a.quotes) {
    if (!q.valid_until || !isOpenQuote(q) || !inR(q.valid_until)) continue;
    out.push({ key: `q:${q.id}`, date: q.valid_until, start: null, end: null, kind: "quote", title: `${q.company_id ? co.get(q.company_id) ?? q.client : q.client || q.doc_no} 견적 유효기간`, sub: `${q.doc_no} · ${wonKo(q.supply)}`, href: `${base.docs}/${q.id}`, companyId: q.company_id, done: false, mine: true });
  }
  for (const p of a.pipeline) {
    if (!p.due || p.group === "done") continue;
    const d = p.due.slice(0, 10);
    if (!inR(d)) continue;
    // 단추 요청: 선정 전이면 회사 이름이 없다 (견적 진행판 제목 그대로)
    out.push({ key: `p:${p.id}`, date: d, start: null, end: null, kind: "danchu", title: `${p.no} ${p.next}`, sub: `단추 요청 · ${p.title}`, href: `${base.pipe}?sel=${p.id}`, companyId: null, done: false, mine: true });
  }
  const rank = (x: AgendaItem) => `${x.date} ${x.start ?? "00:00"} ${x.start ? 1 : 0}`;
  return out.sort((x, y) => rank(x).localeCompare(rank(y)));
}

// ─── 캘린더 파일 (.ics, RFC 5545) ───
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** 75바이트 줄 접기 (UTF-8 기준, 다음 줄은 공백으로 시작) */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (parts.length ? 74 : 75)) { parts.push(cur); cur = ch; } else cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}
export function icsForEvent(e: Pick<CrmEvent, "id" | "title" | "starts_at" | "ends_at" | "all_day" | "location" | "requests" | "updated_at">, extra: { company?: string; attendees?: string; url?: string } = {}): string {
  const start = e.all_day ? `DTSTART;VALUE=DATE:${ymdKst(e.starts_at).replace(/-/g, "")}` : `DTSTART:${icsTime(e.starts_at)}`;
  const end = e.all_day
    ? `DTEND;VALUE=DATE:${addDaysYmd(ymdKst(e.starts_at), 1).replace(/-/g, "")}`
    : `DTEND:${icsTime(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 36e5).toISOString())}`;
  const desc = [extra.company ? `고객사: ${extra.company}` : "", extra.attendees ? `참석: ${extra.attendees}` : "", e.requests ? `요청사항: ${e.requests}` : "", extra.url ?? ""].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//danchu//crm//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${e.id}@danchu.kr`, `DTSTAMP:${icsTime(e.updated_at)}`, start, end, `SUMMARY:${icsEsc(e.title)}`,
    ...(e.location ? [`LOCATION:${icsEsc(e.location)}`] : []), ...(desc ? [`DESCRIPTION:${icsEsc(desc)}`] : []), ...(extra.url ? [`URL:${extra.url}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ─── 고객사 목록 줄 ───
export type CompanyRow = {
  company: CrmCompany; contacts: number; leadName: string | null; openQuotes: number; openAmount: number; won: number; nextAt: string | null; nextTitle: string | null;
  nextKind: string | null; lastAt: string | null; quiet: boolean; danchu: boolean; openTasks: number;
};
export function companyRows(a: {
  companies: CrmCompany[]; contacts: CrmContact[]; quotes: CrmQuote[]; events: CrmEvent[]; activities: Pick<CrmActivity, "company_id" | "occurred_at">[]; tasks: CrmTask[]; now?: number;
}): CompanyRow[] {
  const now = a.now ?? Date.now();
  const touch = lastTouch(a.activities, a.quotes);
  const t = todayKst(now);
  return a.companies.map((c) => {
    const cs = a.contacts.filter((x) => x.company_id === c.id);
    const lead = cs.find((x) => x.role === "decision") ?? cs[0] ?? null;
    const qs = a.quotes.filter((q) => q.company_id === c.id);
    const open = qs.filter(isOpenQuote);
    const up = a.events.filter((e) => e.company_id === c.id && !e.done_at && ymdKst(e.starts_at) >= t).sort((x, y) => x.starts_at.localeCompare(y.starts_at))[0] ?? null;
    const last = touch.get(c.id) ?? null;
    const ref = last ?? c.created_at;
    return {
      company: c, contacts: cs.length, leadName: lead?.name ?? null, openQuotes: open.length, openAmount: open.reduce((s, q) => s + (q.supply || 0), 0), won: qs.filter((q) => quoteStage(q) === "won").length,
      nextAt: up?.starts_at ?? null, nextTitle: up?.title ?? null, nextKind: up?.kind ?? null, lastAt: last, quiet: now - new Date(ref).getTime() > QUIET_DAYS * DAY, danchu: c.source === "danchu" || cs.some((x) => !!x.danchu_key),
      openTasks: a.tasks.filter((x) => x.company_id === c.id && !x.done_at).length,
    };
  });
}
export const COMPANY_FILTERS = { all: "전체", week: "이번 주 일정", open: "열린 견적", danchu: "단추에서 선정", quiet: "연락 30일 넘음" } as const;
export type CompanyFilter = keyof typeof COMPANY_FILTERS;
export function filterRows(rows: CompanyRow[], f: CompanyFilter, q: string, now = Date.now()): CompanyRow[] {
  const t = todayKst(now);
  const weekEnd = addDaysYmd(mondayOf(t), 6);
  const k = normName(q);
  return rows
    .filter((r) => f === "all" || (f === "week" ? !!r.nextAt && ymdKst(r.nextAt) <= weekEnd : f === "open" ? r.openQuotes > 0 : f === "danchu" ? r.danchu : r.quiet))
    .filter((r) => !k || companyKeys(r.company).some((x) => x.includes(k)) || (r.leadName ?? "").includes(q.trim()))
    .sort((x, y) => (x.nextAt ?? "9").localeCompare(y.nextAt ?? "9") || y.openQuotes - x.openQuotes || (y.lastAt ?? "").localeCompare(x.lastAt ?? ""));
}
