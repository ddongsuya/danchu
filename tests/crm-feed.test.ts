import { describe, expect, it } from "vitest";
import { buildFeed, feedCounts, filterFeed, parseFeedQuery } from "@/lib/crm-feed";
import { quoteRows } from "@/lib/crm-analysis";
import { danchuSrcOf, type DanchuSrc } from "@/lib/crm-deals";
import type { CrmActivity, CrmDeal, CrmEvent, CrmQuote, CrmTask } from "@/lib/crm-shape";

const NOW = new Date("2026-11-26T10:00:00+09:00").getTime();
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const iso = (s: string) => new Date(`${s}+09:00`).toISOString();

const deal = (o: Partial<CrmDeal> = {}): CrmDeal => ({
  id: U(100), org_id: "o", company_id: U(1), contact_ids: [U(11)], title: "13주 반복투여", kind: "tox", substance: "", submit_to: "", report_lang: "", amount: 200_000_000, expected_on: null,
  stage: "quote", status: "open", stage_at: iso("2026-11-02T09:00:00"), lost_reason: "", lost_note: "", won_reason: "", won_note: "", won_amount: null, closed_at: null, owner: "m1", source: "manual",
  invite_id: null, rfq_no: "", memo: "", import_id: null, created_by: "m1", created_at: iso("2026-11-02T09:00:00"), updated_at: iso("2026-11-02T09:00:00"), ...o,
});
const act = (o: Partial<CrmActivity> = {}): CrmActivity => ({
  id: U(400), org_id: "o", company_id: U(1), deal_id: U(100), contact_id: U(11), quote_doc_id: null, event_id: null, kind: "meeting", occurred_at: iso("2026-11-25T15:10:00"), duration_min: 32,
  title: "", body: "회복군은 고용량군만", attendee_contacts: [U(11)], attendee_members: ["m1"], files: [], created_by: "m1", created_at: iso("2026-11-25T15:10:00"), updated_at: iso("2026-11-25T15:10:00"), ...o,
});
const task = (o: Partial<CrmTask> = {}): CrmTask => ({
  id: U(500), org_id: "o", company_id: null, deal_id: U(100), contact_id: null, quote_doc_id: null, activity_id: null, title: "견적 후속 통화", memo: "", category: "contact", due_on: "2026-12-02",
  assignee: "m2", done_at: null, done_by: null, created_by: "m1", created_at: iso("2026-11-20T09:00:00"), updated_at: iso("2026-11-20T09:00:00"), ...o,
});
const ev = (o: Partial<CrmEvent> = {}): CrmEvent => ({
  id: U(200), org_id: "o", company_id: null, deal_id: null, contact_id: null, quote_doc_id: null, kind: "call", title: "일정 확인", starts_at: iso("2026-11-27T10:00:00"), ends_at: null, all_day: false,
  mode: "phone", location: "", attendee_contacts: [], attendee_members: ["m1"], attendees_extra: "", requests: "", remind: false, reminded_at: null, done_at: null, created_by: "m1", created_at: iso("2026-11-20T09:00:00"), updated_at: iso("2026-11-20T09:00:00"), ...o,
});
const base = {
  companies: [{ id: U(1), name: "가람바이오" }, { id: U(2), name: "나래제약" }],
  contacts: [{ id: U(11), name: "박 팀장", title: "팀장", email: "" }, { id: U(12), name: "이 수석", title: "수석", email: "" }],
  members: [{ id: "m1", name: "김 책임" }, { id: "m2", name: "오 연구원" }],
  history: [],
};

describe("활동 목록 (c-activity)", () => {
  const audio = { path: "p/1", name: "녹음.m4a", size: 10, type: "audio/mp4" };
  const items = buildFeed({
    ...base, deals: [deal()], danchu: new Map(),
    activities: [act({ files: [audio, { path: "p/2", name: "회의록.docx", size: 5, type: "" }] }), act({ id: U(401), kind: "email", title: "견적서 v2", duration_min: null, body: "", deal_id: null, company_id: U(2), contact_id: U(12), attendee_contacts: [], occurred_at: iso("2026-11-24T09:00:00"), files: [] })],
    tasks: [task(), task({ id: U(501), title: "끝낸 일", due_on: null, done_at: iso("2026-11-10T11:00:00"), done_by: "m1", assignee: "m1" })],
    events: [ev({ company_id: U(2) })],
  });
  it("기록·할 일·일정을 최근 것부터 한 줄씩, 고객사는 안건에서 찾는다", () => {
    expect(items.map((x) => x.kind)).toEqual(["task", "event", "meeting", "email", "task"]);
    const m = items.find((x) => x.kind === "meeting")!;
    expect([m.company, m.people, m.files, m.audio, m.owner]).toEqual(["가람바이오", ["박 팀장"], 2, true, "m1"]);
    const t = items[0];
    expect([t.companyId, t.allDay, t.owner, t.done]).toEqual([U(1), true, "m2", false]);
    expect(items.at(-1)!.done).toBe(true);
  });
  it("거르기: 종류 · 고객사 · 담당자 · 우리 담당 · 기간 · 찾기", () => {
    const q = parseFeedQuery({});
    expect(q.d).toBe("30");
    expect(filterFeed(items, { ...q, k: "email" }, NOW).map((x) => x.title)).toEqual(["견적서 v2"]);
    expect(filterFeed(items, { ...q, co: U(2) }, NOW).map((x) => x.kind)).toEqual(["event", "email"]);
    expect(filterFeed(items, { ...q, p: U(11) }, NOW).map((x) => x.kind)).toEqual(["meeting"]);
    expect(filterFeed(items, { ...q, o: "m2" }, NOW).map((x) => x.kind)).toEqual(["task"]);
    expect(filterFeed(items, { ...q, d: "7" }, NOW).map((x) => x.kind)).toEqual(["task", "event", "meeting", "email"]);
    expect(filterFeed(items, { ...q, q: "고용량" }, NOW).map((x) => x.kind)).toEqual(["meeting"]);
    expect(filterFeed(items, { ...q, q: "나래" }, NOW)).toHaveLength(2);
    expect(feedCounts(items)).toMatchObject({ task: 2, event: 1, meeting: 1, email: 1, call: 0, danchu: 0 });
  });
  it("주소 값이 이상하면 버린다", () => {
    expect(parseFeedQuery({ k: "x", co: "1", p: "<", o: "a b", d: "5" })).toEqual({ k: "", co: "", p: "", o: "", d: "30", q: "" });
  });
  it("단추 요청에서 일어난 일도 안건의 고객사·담당자로 들어온다", () => {
    const s: DanchuSrc = danchuSrcOf({ id: U(9), rfq_no: "R-1", sent_at: iso("2026-11-20T09:00:00"), joined_at: iso("2026-11-21T09:00:00"), status: "sent", reply_by: null, quote: null, rfq: { categories: ["일반독성"] } } as never, null);
    const f = buildFeed({ ...base, deals: [deal({ invite_id: U(9), source: "danchu" })], danchu: new Map([[U(9), s]]), activities: [], tasks: [], events: [] });
    expect(f.map((x) => [x.kind, x.title, x.company])).toEqual([["danchu", "단추 요청에 참여", "가람바이오"], ["danchu", "단추 요청 참여 안내 받음", "가람바이오"]]);
  });
});

describe("견적·계약 표 (c-deal-quotes · c-client-quotes)", () => {
  const q = (n: number, o: Partial<CrmQuote>): CrmQuote => ({
    id: U(300 + n), doc_no: `Q-${n}`, title: "", client: "", supply: 100, status: "sent", sent_at: iso("2026-11-10T10:00:00"), valid_until: null, deal_id: U(100), company_id: U(1), contact_id: U(11),
    rfq_no: null, updated_at: iso("2026-11-10T10:00:00"), created_at: iso("2026-11-10T10:00:00"), issued_on: "2026-11-10", invite_id: null, ...o,
  });
  it("만든 순서로 1차·2차, 결과와 계약은 가장 최근 차수에만", () => {
    const rows = quoteRows({
      quotes: [q(2, { created_at: iso("2026-11-18T10:00:00"), supply: 240 }), q(1, { supply: 252 })],
      deals: [deal({ status: "won", stage: "contract", won_reason: "일정", won_amount: 230 })], history: [], danchu: new Map(), docs: "/cro/docs",
    });
    expect(rows.map((r) => [r.docNo, r.version, r.result.tone, r.result.reason, r.contract])).toEqual([
      ["Q-2", "2차", "won", "일정", { label: "계약", amount: 230 }],
      ["Q-1", "1차", "old", "", null],
    ]);
    expect(rows[0].href).toBe(`/cro/docs/${U(302)}`);
  });
  it("실패는 사유, 진행 중은 지금 단계, 안건 없는 견적서는 보냄/보내기 전", () => {
    const lost = quoteRows({ quotes: [q(1, {})], deals: [deal({ status: "lost", lost_reason: "가격" })], history: [], danchu: new Map(), docs: "/d" })[0];
    expect([lost.result.label, lost.result.reason, lost.contract]).toEqual(["실패", "가격", null]);
    const open = quoteRows({ quotes: [q(1, {})], deals: [deal({ stage: "negotiation" })], history: [], danchu: new Map(), docs: "/d" })[0];
    expect(open.result.label).toBe("진행 중 · 협의");
    const loose = quoteRows({ quotes: [q(1, { deal_id: null, sent_at: null })], deals: [], history: [], danchu: new Map(), docs: "/d" })[0];
    expect([loose.version, loose.result.label]).toEqual(["", "보내기 전"]);
  });
  it("단추에 낸 견적은 견적서가 없을 때 한 줄, 선정 뒤 계약 보고 전이면 계약 전", () => {
    const s = danchuSrcOf(
      { id: U(9), rfq_no: "R-9", sent_at: iso("2026-11-01T09:00:00"), joined_at: iso("2026-11-02T09:00:00"), status: "submitted", reply_by: null,
        quote: { id: U(90), status: "submitted", total_amount: 214, first_submitted_at: iso("2026-11-05T09:00:00"), submitted_at: iso("2026-11-06T09:00:00"), valid_until: null, revision: 2 }, rfq: { selected_quote_id: U(90) } } as never,
      { id: "a", invite_id: U(9), awarded_at: iso("2026-11-07T09:00:00"), quoteAmount: 214, contract_reported_at: null, contract_status: "pending", contract_amount: null, rfq: null } as never,
    );
    const rows = quoteRows({ quotes: [], deals: [deal({ invite_id: U(9), source: "danchu", stage: "negotiation" })], history: [], danchu: new Map([[U(9), s]]), docs: "/d" });
    expect(rows.map((r) => [r.docNo, r.version, r.amount, r.result.label, r.contract?.label, r.href])).toEqual([["단추 R-9", "2차", 214, "선정", "계약 전", `/cro/r/${U(9)}/reply`]]);
  });
});
