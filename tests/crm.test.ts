import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildAgenda, buildFeed, companyRows, dLabel, duplicatePairs, filterRows, findCompanyByName, icsForEvent, kstToIso, mondayOf, normName,
  parseActivity, parseCompany, parseContact, parseEvent, parseQuoteLink, parseTask, personLabel, quoteStage, wonKo,
  type CrmCompany, type CrmContact, type CrmEvent, type CrmQuote, type CrmTask,
} from "@/lib/crm-shape";

const NOW = new Date("2026-11-10T10:00:00+09:00").getTime(); // 화요일
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const co = (n: number, name: string, o: Partial<CrmCompany> = {}): CrmCompany => ({
  id: U(n), org_id: "o", name, aliases: [], industry: "", biz_no: "", address: "", website: "", memo: "", first_deal: false, source: "manual", created_by: null,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...o,
});
const ct = (n: number, c: number, o: Partial<CrmContact> = {}): CrmContact => ({
  id: U(100 + n), org_id: "o", company_id: U(c), name: `담당${n}`, dept: "", title: "", role: null, email: "", phone: "", mobile: "", memo: "", source: "manual", danchu_key: null,
  created_by: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...o,
});
const ev = (n: number, c: number | null, starts: string, o: Partial<CrmEvent> = {}): CrmEvent => ({
  id: U(200 + n), org_id: "o", company_id: c ? U(c) : null, contact_id: null, quote_doc_id: null, kind: "meeting", title: `일정${n}`, starts_at: starts, ends_at: null, all_day: false, mode: null,
  location: "", attendee_contacts: [], attendee_members: [], attendees_extra: "", requests: "", remind: true, reminded_at: null, done_at: null, created_by: "me", created_at: starts, updated_at: starts, ...o,
});
const qd = (n: number, c: number | null, o: Partial<CrmQuote> = {}): CrmQuote => ({
  id: U(300 + n), doc_no: `Q-${n}`, title: `견적${n}`, client: "", supply: 100_000_000, status: "sent", deal_stage: null, sent_at: "2026-11-01T01:00:00Z", valid_until: "2026-11-12", contract_amount: null,
  lost_reason: "", company_id: c ? U(c) : null, contact_id: null, rfq_no: null, updated_at: "2026-11-01T01:00:00Z", issued_on: "2026-11-01", invite_id: null, ...o,
});
const tk = (n: number, c: number | null, o: Partial<CrmTask> = {}): CrmTask => ({
  id: U(500 + n), org_id: "o", company_id: c ? U(c) : null, contact_id: null, quote_doc_id: null, activity_id: null, title: `할 일${n}`, memo: "", category: "contact", due_on: null, assignee: null,
  done_at: null, done_by: null, created_by: "me", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...o,
});

describe("고객사 이름 맞추기", () => {
  it("주식회사·(주)·띄어쓰기·영문 법인 표기를 빼고 같은 회사로 본다", () => {
    expect(normName("(주) 가람 바이오")).toBe(normName("가람바이오 주식회사"));
    expect(normName("㈜가람바이오")).toBe(normName("가람바이오"));
    expect(normName("Garam Bio Inc.")).toBe(normName("garambio"));
  });
  it("별칭으로도 찾고, 같은 이름 둘은 합치기 후보", () => {
    const cs = [co(1, "가람바이오", { aliases: ["Garam Bio"] }), co(2, "나래제약"), co(3, "(주)나래제약")];
    expect(findCompanyByName(cs, "GARAM BIO")?.id).toBe(U(1));
    expect(findCompanyByName(cs, "다온")).toBeNull();
    expect(duplicatePairs(cs)).toEqual([[U(2), U(3)]]);
  });
  it("이름에 직책이 들어 있으면 한 번만", () => {
    expect(personLabel("박 팀장", "팀장")).toBe("박 팀장");
    expect(personLabel("박지훈", "팀장")).toBe("박지훈 팀장");
  });
});

describe("입력 검사", () => {
  it("고객사: 이름 필수, 사업자번호 형식", () => {
    expect(parseCompany({}).ok).toBe(false);
    expect(parseCompany({ name: "가람", biz_no: "12-3" }).ok).toBe(false);
    const r = parseCompany({ name: " 가람 ", aliases: "Garam, 가람바이오", biz_no: "123-45-67890" });
    expect(r.ok && r.value).toMatchObject({ name: "가람", aliases: ["Garam", "가람바이오"] });
  });
  it("고치기는 보낸 칸만 바꾼다", () => {
    const r = parseCompany({ memo: "메모" }, true);
    expect(r.ok && r.value).toEqual({ memo: "메모" });
    expect(parseCompany({ name: "" }, true).ok).toBe(false);
  });
  it("담당자: 고객사와 이름 필수, 이메일 형식, 없는 역할은 비운다", () => {
    expect(parseContact({ name: "박" }).ok).toBe(false);
    expect(parseContact({ name: "박", company_id: U(1), email: "x" }).ok).toBe(false);
    const r = parseContact({ name: "박", company_id: U(1), role: "boss" });
    expect(r.ok && r.value.role).toBeNull();
  });
  it("기록: 날짜·시간은 한국 시간, 일주일 넘게 앞선 날은 일정으로 보낸다", () => {
    const r = parseActivity({ company_id: U(1), kind: "call", body: "통화", date: "2026-11-09", time: "16:20" }, false, NOW);
    expect(r.ok && r.value.occurred_at).toBe("2026-11-09T07:20:00.000Z");
    expect(parseActivity({ company_id: U(1), kind: "call", body: "x", date: "2026-12-30" }, false, NOW).ok).toBe(false);
    expect(parseActivity({ company_id: U(1), kind: "fax", body: "x" }, false, NOW).ok).toBe(false);
    expect(parseActivity({ company_id: U(1), kind: "memo" }, false, NOW).ok).toBe(false);
  });
  it("일정: 시작 시간 필수, 끝이 시작보다 빠르면 막고, 기한은 하루 종일", () => {
    expect(parseEvent({ title: "미팅", date: "2026-11-10" }).ok).toBe(false);
    expect(parseEvent({ title: "미팅", date: "2026-11-10", start: "15:00", end: "14:00" }).ok).toBe(false);
    const r = parseEvent({ title: "회신", kind: "deadline", date: "2026-11-12", start: "10:00" });
    expect(r.ok && r.value).toMatchObject({ all_day: true, ends_at: null, starts_at: "2026-11-11T15:00:00.000Z" });
  });
  it("할 일: 기한 형식, 없는 종류는 기타", () => {
    expect(parseTask({ title: "x", due_on: "11/12" }).ok).toBe(false);
    const r = parseTask({ title: "보내기", category: "??" });
    expect(r.ok && r.value.category).toBe("other");
  });
  it("견적 진행: 실패는 사유 필수, 보냄·작성 중은 견적서 상태를 따른다", () => {
    expect(parseQuoteLink({ stage: "lost" }).ok).toBe(false);
    const lost = parseQuoteLink({ stage: "lost", lost_reason: "가격" });
    expect(lost.ok && lost.value).toMatchObject({ deal_stage: "lost", lost_reason: "가격" });
    const sent = parseQuoteLink({ stage: "sent", lost_reason: "가격" });
    expect(sent.ok && sent.value).toMatchObject({ deal_stage: null, lost_reason: "" });
    const won = parseQuoteLink({ stage: "won", contract_amount: "61,500,000" });
    expect(won.ok && won.value.contract_amount).toBe(61_500_000);
    expect(quoteStage({ status: "draft", deal_stage: null })).toBe("draft");
    expect(quoteStage({ status: "sent", deal_stage: "won" })).toBe("won");
  });
});

describe("고객사 목록", () => {
  const companies = [co(1, "가람"), co(2, "나래", { source: "danchu" }), co(3, "다온")];
  const contacts = [ct(1, 1, { role: "decision", name: "박" }), ct(2, 1), ct(3, 2)];
  const quotes = [qd(1, 1), qd(2, 1, { deal_stage: "won" }), qd(3, 2, { deal_stage: "lost" })];
  const events = [ev(1, 1, "2026-11-12T05:00:00Z"), ev(2, 3, "2026-11-20T05:00:00Z")];
  const activities = [{ company_id: U(3), occurred_at: "2026-11-09T00:00:00Z" }];
  const rows = companyRows({ companies, contacts, quotes, events, activities, tasks: [], now: NOW });
  it("열린 견적·다음 일정·결정권자·오래된 연락", () => {
    const g = rows.find((r) => r.company.id === U(1))!;
    expect(g).toMatchObject({ contacts: 2, leadName: "박", openQuotes: 1, won: 1, openAmount: 100_000_000 });
    expect(rows.find((r) => r.company.id === U(2))!).toMatchObject({ danchu: true, openQuotes: 0, quiet: false });
    expect(rows.find((r) => r.company.id === U(3))!.lastAt).toBe("2026-11-09T00:00:00Z");
  });
  it("거르기: 이번 주 일정, 열린 견적, 단추, 이름 찾기", () => {
    expect(filterRows(rows, "week", "", NOW).map((r) => r.company.name)).toEqual(["가람"]);
    expect(filterRows(rows, "open", "", NOW).map((r) => r.company.name)).toEqual(["가람"]);
    expect(filterRows(rows, "danchu", "", NOW).map((r) => r.company.name)).toEqual(["나래"]);
    expect(filterRows(rows, "all", "(주) 다온", NOW).map((r) => r.company.name)).toEqual(["다온"]);
    expect(filterRows(rows, "all", "", NOW)[0].company.name).toBe("가람"); // 다음 일정이 가까운 곳이 위
  });
});

describe("기록 묶음과 캘린더", () => {
  it("보낸 견적·추적·끝낸 할 일·단추 선정이 날짜순으로 합쳐지고 단추 선정은 담당자에 붙는다", () => {
    const contacts = [ct(1, 1, { danchu_key: "u5", name: "박" })];
    const f = buildFeed({
      activities: [{ id: "a", org_id: "o", company_id: U(1), contact_id: U(101), quote_doc_id: null, event_id: null, kind: "call", occurred_at: "2026-11-09T07:00:00Z", duration_min: 12, title: "", body: "통화", attendee_contacts: [], attendee_members: [], created_by: "m", created_at: "", updated_at: "" }],
      quotes: [qd(1, 1, { contact_id: U(101) })], tracks: [{ id: "t", doc_id: U(301), stage: "negotiating", note: "회복군", created_by: "m", created_at: "2026-11-05T07:00:00Z" }],
      tasks: [tk(1, 1, { done_at: "2026-11-06T00:00:00Z", done_by: "m" })],
      awards: [{ id: "w", awarded_at: "2026-10-01T00:00:00Z", contract_reported_at: null, contract_amount: null, quoteAmount: 120_000_000, rfqNo: "DC-1", substance: "", danchuKey: "u5" }],
      contacts, members: [{ id: "m", name: "김" }],
    });
    expect(f.map((x) => x.kind)).toEqual(["call", "task", "track", "quote", "award"]);
    expect(f[0]).toMatchObject({ title: "박 통화", by: "김", sub: "박 · 12분" });
    expect(f.at(-1)?.contactId).toBe(U(101));
  });
  it("일정·할 일 기한·열린 견적 유효기간·단추 기한을 범위 안에서 모으고, 끝난 단추 요청은 뺀다", () => {
    const from = mondayOf("2026-11-10");
    const to = "2026-11-15";
    const items = buildAgenda({
      events: [ev(1, 1, kstToIso("2026-11-10", "14:00"), { ends_at: kstToIso("2026-11-10", "15:00"), attendee_members: ["me2"], created_by: "other" }), ev(2, 1, kstToIso("2026-11-30", "14:00"))],
      tasks: [tk(1, 1, { due_on: "2026-11-11", assignee: "me" })],
      quotes: [qd(1, 1), qd(2, 1, { deal_stage: "lost" })],
      pipeline: [{ id: "p1", no: "DC-9", title: "요청", next: "참여할지 정하기", due: "2026-11-13", group: "todo" }, { id: "p2", no: "DC-8", title: "요청", next: "", due: "2026-11-13", group: "done" }],
      companies: [co(1, "가람")], contacts: [], from, to, me: "me",
    });
    expect(items.map((x) => x.kind)).toEqual(["meeting", "task", "quote", "danchu"]);
    expect(items[0]).toMatchObject({ date: "2026-11-10", start: "14:00", end: "15:00", mine: false });
    expect(items[1].mine).toBe(true);
    expect(items[3].title).toBe("DC-9 참여할지 정하기");
  });
  it("남은 날 표시", () => {
    expect(dLabel("2026-11-12", NOW)).toMatchObject({ n: 2 });
    expect(wonKo(122_000_000)).toBe("1억 2,200만 원");
  });
});

describe("캘린더 파일", () => {
  it("RFC 5545: 이스케이프, 75바이트 접기, 하루 종일은 날짜만", () => {
    const e = ev(1, 1, kstToIso("2026-11-10", "14:00"), { ends_at: kstToIso("2026-11-10", "15:00"), title: "견적 설명, 회복군; 결정", location: "본사 3층", requests: "회복군 4주 포함안과 미포함안 금액 비교, 시험 시작 가능 시점을 같이 정리해서 미리 보내 주세요" });
    const s = icsForEvent(e, { company: "가람" });
    expect(s).toContain("DTSTART:20261110T050000Z");
    expect(s).toContain("SUMMARY:견적 설명\\, 회복군\\; 결정");
    for (const line of s.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const all = icsForEvent({ ...e, all_day: true, starts_at: kstToIso("2026-11-12", "00:00") });
    expect(all).toContain("DTSTART;VALUE=DATE:20261112");
    expect(all).toContain("DTEND;VALUE=DATE:20261113");
  });
});

describe("저장소 규칙 (0038)", () => {
  const sql = readFileSync("supabase/migrations/0038_cro_crm.sql", "utf8");
  it("표마다 RLS, 단추 담당자 키는 기관 안에서 하나", () => {
    for (const t of ["cro_crm_companies", "cro_crm_contacts", "cro_crm_events", "cro_crm_activities", "cro_crm_tasks", "cro_crm_task_actions", "cro_quote_tracking"]) expect(sql).toMatch(new RegExp(`${t}[\\s\\S]*enable row level security|enable row level security[\\s\\S]*${t}`));
    expect(sql).toMatch(/unique index[\s\S]*danchu_key/);
  });
  it("API 는 다른 기관 id 를 막고, 단추 선정 담당자는 지우지 않는다", () => {
    const api = readFileSync("app/api/cro/crm/[kind]/route.ts", "utf8");
    expect(api).toContain("checkRefs");
    expect(api).toContain("danchu_key");
    expect(api).toMatch(/\.eq\("org_id", orgId\)/);
  });
});
