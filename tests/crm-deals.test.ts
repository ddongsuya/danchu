import { describe, expect, it } from "vitest";
import {
  board, buildReport, buildTimeline, danchuNext, danchuPatch, danchuSrcOf, danchuTarget, dealRows, filterDeals, guessField, guessStage, monthClosed, parseDeal, parseWon, parseYmd,
  planImport, stageSpans, todayList, type DanchuSrc,
} from "@/lib/crm-deals";
import type { CrmDeal, CrmTask, DealHistory } from "@/lib/crm-shape";

const NOW = new Date("2026-11-09T10:00:00+09:00").getTime(); // 월요일
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const iso = (s: string) => new Date(`${s}+09:00`).toISOString();

const inv = (o: Record<string, unknown> = {}) => ({
  id: U(1), rfq_no: "R-2611-0142", sent_at: iso("2026-11-01T09:00:00"), joined_at: iso("2026-11-02T09:00:00"), status: "sent", withdrawn_at: null, revoked_at: null, reply_by: "2026-11-10",
  quote: null as null | Record<string, unknown>,
  rfq: { substance: "DC-101", categories: ["반복투여독성"], status: "distributed", compared_at: null, selected_quote_id: null, join_by: null, user_id: "req-1", company: "가람바이오" },
  ...o,
});
const quote = (o: Record<string, unknown> = {}) => ({ id: U(9), status: "submitted", total_amount: 238_000_000, first_submitted_at: iso("2026-11-05T11:02:00"), submitted_at: iso("2026-11-05T11:02:00"), valid_until: "2026-12-05", revision: 1, ...o });
const award = (o: Record<string, unknown> = {}) => ({
  id: U(20), invite_id: U(1), awarded_at: iso("2026-11-07T15:27:00"), quoteAmount: 214_500_000, contract_reported_at: null, contract_status: "pending", contract_amount: null, substance_updated_at: null,
  rfq: { company: "가람바이오", contact_name: "박 팀장", email: "park@garam.example", phone: "010", user_id: "req-1", org_type: "바이오텍" }, ...o,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const src = (i: any, a: any = null): DanchuSrc => danchuSrcOf(i, a);
const deal = (o: Partial<CrmDeal> = {}): CrmDeal => ({
  id: U(100), org_id: "o", company_id: null, contact_ids: [], title: "안건", kind: "", substance: "", submit_to: "", report_lang: "", amount: null, expected_on: null,
  stage: "inquiry", status: "open", stage_at: iso("2026-11-02T09:00:00"), lost_reason: "", lost_note: "", won_amount: null, closed_at: null, owner: null, source: "manual",
  invite_id: null, rfq_no: "", memo: "", import_id: null, created_by: null, created_at: iso("2026-11-02T09:00:00"), updated_at: iso("2026-11-02T09:00:00"), ...o,
});

describe("단추 요청 → 안건", () => {
  it("참여 전이면 안건이 아니다 (오늘 화면의 참여 결정)", () => {
    expect(danchuTarget(src(inv({ joined_at: null })), NOW)).toBeNull();
  });
  it("참여 → 문의, 선정 전에는 의뢰자 회사를 담지 않는다", () => {
    const s = src(inv());
    expect(s.client).toBeNull();
    const t = danchuTarget(s, NOW)!;
    expect([t.stage, t.status, t.amount]).toEqual(["inquiry", "open", null]);
    expect(t.title).toBe("반복투여독성 · DC-101");
  });
  it("견적 제출 → 견적 + 제출 총액, 선정 → 협의 + 선정 금액 + 회사·담당자", () => {
    const t1 = danchuTarget(src(inv({ status: "submitted", quote: quote() })), NOW)!;
    expect([t1.stage, t1.amount]).toEqual(["quote", 238_000_000]);
    const s2 = src(inv({ status: "submitted", quote: quote() }), award());
    expect(s2.client?.company).toBe("가람바이오");
    const t2 = danchuTarget(s2, NOW)!;
    expect([t2.stage, t2.amount, t2.steps.map((x) => x.stage)]).toEqual(["negotiation", 214_500_000, ["inquiry", "quote", "negotiation"]]);
  });
  it("계약 보고(체결) → 수주 + 계약 금액, 미체결 → 실패", () => {
    const w = danchuTarget(src(inv({ status: "submitted", quote: quote() }), award({ contract_reported_at: iso("2026-11-20T10:00:00"), contract_status: "signed", contract_amount: 210_000_000 })), NOW)!;
    expect([w.stage, w.status, w.wonAmount]).toEqual(["contract", "won", 210_000_000]);
    const l = danchuTarget(src(inv({ status: "submitted", quote: quote() }), award({ contract_status: "not_signed" })), NOW)!;
    expect([l.status, l.lostReason]).toEqual(["lost", "의뢰자 계획 변경"]);
  });
  it("다른 기관이 선정되면 실패 '다른 기관 선정'. 다른 기관 이름·금액은 없다", () => {
    const s = src(inv({ status: "submitted", quote: quote(), rfq: { ...inv().rfq, status: "selected", selected_quote_id: U(77) } }));
    expect(s.otherSelected).toBe(true);
    const t = danchuTarget(s, NOW)!;
    expect([t.status, t.lostReason, t.stage]).toEqual(["lost", "다른 기관 선정", "quote"]);
    expect(JSON.stringify(t)).not.toContain(U(77));
  });
  it("철회·취소·기한 지남도 실패로 끝난다", () => {
    expect(danchuTarget(src(inv({ withdrawn_at: iso("2026-11-03T10:00:00") })), NOW)!.status).toBe("lost");
    expect(danchuTarget(src(inv({ rfq: { ...inv().rfq, status: "cancelled" } })), NOW)!.lostReason).toBe("의뢰자 계획 변경");
    expect(danchuTarget(src(inv({ status: "expired" })), NOW)!.lostNote).toContain("회신 기한");
  });
});

describe("안건을 단추 이벤트에 맞추기", () => {
  it("새 안건: 단계별 이력이 단추 시각으로 남는다", () => {
    const t = danchuTarget(src(inv({ status: "submitted", quote: quote() }), award()), NOW)!;
    const p = danchuPatch(null, t);
    expect(p.patch.stage).toBe("negotiation");
    expect(p.patch.stage_at).toBe(iso("2026-11-07T15:27:00"));
    expect(p.history.map((h) => [h.from_stage, h.to_stage, h.actor])).toEqual([[null, "inquiry", "danchu"], ["inquiry", "quote", "danchu"], ["quote", "negotiation", "danchu"]]);
  });
  it("앞으로만 옮긴다: 기관이 접수로 옮긴 안건은 선정이 와도 그대로", () => {
    const t = danchuTarget(src(inv({ status: "submitted", quote: quote() }), award()), NOW)!;
    const p = danchuPatch(deal({ stage: "intake", amount: 200_000_000 }), t);
    expect(p.patch).toEqual({});
    expect(p.history).toEqual([]);
  });
  it("견적 단계에서 다시 낸 견적은 금액을 따른다", () => {
    const t = danchuTarget(src(inv({ status: "submitted", quote: quote({ total_amount: 214_500_000, revision: 2 }) })), NOW)!;
    expect(danchuPatch(deal({ stage: "quote", amount: 238_000_000 }), t).patch).toEqual({ amount: 214_500_000 });
  });
  it("끝난 안건은 손대지 않는다 (기관이 실패로 바꾼 뒤 단추 선정이 와도)", () => {
    const t = danchuTarget(src(inv({ status: "submitted", quote: quote() }), award()), NOW)!;
    expect(danchuPatch(deal({ status: "lost", lost_reason: "가격", closed_at: iso("2026-11-06T10:00:00") }), t)).toEqual({ patch: {}, history: [] });
  });
  it("진행 중 안건이 다른 기관 선정으로 실패하면 사유와 끝난 시각이 함께", () => {
    const t = danchuTarget(src(inv({ status: "submitted", quote: quote(), rfq: { ...inv().rfq, status: "selected", selected_quote_id: U(77) } })), NOW)!;
    const p = danchuPatch(deal({ stage: "quote", amount: 238_000_000 }), t);
    expect(p.patch).toMatchObject({ status: "lost", lost_reason: "다른 기관 선정" });
    expect(p.patch.closed_at).toBeTruthy();
    expect(p.history.at(-1)).toMatchObject({ from_status: "open", to_status: "lost", reason: "다른 기관 선정", actor: "danchu" });
  });
});

describe("다음 할 일 · 손이 필요한 안건", () => {
  const rowsOf = (deals: CrmDeal[], tasks: CrmTask[] = [], danchu = new Map<string, DanchuSrc>()) =>
    dealRows({ deals, companies: [], contacts: [], tasks, events: [], quotes: [], danchu, now: NOW, me: "me" });
  it("할 일·일정이 없으면 '다음 할 일 없음'", () => {
    const [r] = rowsOf([deal()]);
    expect(r.flag?.label).toBe("다음 할 일 없음");
    expect(r.days).toBe(7);
  });
  it("할 일이 있으면 그게 다음 할 일", () => {
    const t = { id: U(5), deal_id: U(100), title: "자료 보내기", due_on: "2026-11-11", done_at: null } as CrmTask;
    const [r] = rowsOf([deal()], [t]);
    expect(r.flag).toBeNull();
    expect(r.next?.label).toBe("자료 보내기");
  });
  it("단추 회신 기한이 3일 안이면 견적서 쓰기", () => {
    const s = src(inv());
    const [r] = rowsOf([deal({ source: "danchu", invite_id: U(1), rfq_no: "R-2611-0142" })], [], new Map([[U(1), s]]));
    expect(r.flag).toMatchObject({ label: "회신 기한 내일", action: "견적서 쓰기", href: `/cro/r/${U(1)}/reply` });
    expect(r.danchuNo).toBe("R-2611-0142");
  });
  it("제출하고 비교를 기다리는 단추 안건은 손이 필요하지 않다", () => {
    const s = src(inv({ status: "submitted", quote: quote() }));
    expect(danchuNext(s, NOW)).toBeNull();
    const [r] = rowsOf([deal({ source: "danchu", invite_id: U(1), stage: "quote" })], [], new Map([[U(1), s]]));
    expect(r.flag).toBeNull();
  });
  it("보드: 진행 중인 안건만 단계별로, 합계 금액", () => {
    const rs = rowsOf([deal({ id: U(1), stage: "quote", amount: 100 }), deal({ id: U(2), stage: "quote", amount: 50 }), deal({ id: U(3), status: "won", closed_at: iso("2026-11-05T10:00:00"), stage: "contract" })]);
    const b = board(rs);
    expect(b.find((c) => c.stage === "quote")).toMatchObject({ count: 2, sum: 150 });
    expect(b.find((c) => c.stage === "contract")?.count).toBe(0);
    expect(filterDeals(rs, { noNext: true }).length).toBe(2);
  });
  it("이번 달 수주·실패", () => {
    const m = monthClosed([deal({ status: "won", won_amount: 86_000_000, closed_at: iso("2026-11-03T10:00:00") }), deal({ status: "lost", closed_at: iso("2026-10-30T10:00:00"), lost_reason: "가격" })], NOW);
    expect(m).toEqual({ won: 1, wonSum: 86_000_000, lost: 0 });
  });
  it("오늘: 지난 할 일은 위로, 단추 기한 내일은 D-1, 참여 결정 전 요청도", () => {
    const t = { id: U(6), deal_id: null, title: "지난 할 일", due_on: "2026-11-06", done_at: null, assignee: "me", created_by: "me" } as CrmTask;
    const s = src(inv());
    const rows = rowsOf([deal({ source: "danchu", invite_id: U(1), rfq_no: "R-1" })], [], new Map([[U(1), s]]));
    const undecided = src(inv({ id: U(2), rfq_no: "R-2", joined_at: null, rfq: { ...inv().rfq, join_by: "2026-11-09" } }));
    const list = todayList({ tasks: [t], events: [], rows, invites: [undecided], me: "me", now: NOW });
    expect(list.map((x) => [x.title, x.badge])).toEqual([["지난 할 일", "3일 지남"], ["R-1 견적 쓰기", "D-1"], ["R-2 참여 결정", "D-day"]]);
  });
});

describe("단계 진행 막대 · 보고서", () => {
  const h = (to: string, at: string, o: Partial<DealHistory> = {}): DealHistory => ({ id: at, deal_id: U(100), from_stage: null, to_stage: to, from_status: null, to_status: "open", reason: "", actor: "member", created_by: null, at: iso(at), ...o });
  it("단계마다 머문 날, 지금 단계는 오늘까지", () => {
    const sp = stageSpans(deal({ stage: "negotiation", stage_at: iso("2026-10-24T15:00:00") }), [h("inquiry", "2026-10-20T10:00:00"), h("quote", "2026-10-22T10:00:00"), h("negotiation", "2026-10-24T15:00:00")], NOW);
    expect(sp.map((x) => [x.stage, x.days, x.state])).toEqual([["inquiry", 2, "done"], ["quote", 2, "done"], ["negotiation", 15, "now"], ["intake", null, "next"], ["contract", null, "next"]]);
  });
  it("전환율·머문 날·수주율·실패 사유·출처별", () => {
    const d1 = deal({ id: U(1), created_at: iso("2026-11-01T10:00:00"), stage: "contract", status: "won", won_amount: 100, closed_at: iso("2026-11-05T10:00:00"), source: "danchu" });
    const d2 = deal({ id: U(2), created_at: iso("2026-11-01T10:00:00"), stage: "quote", status: "lost", lost_reason: "가격", closed_at: iso("2026-11-04T10:00:00") });
    const d3 = deal({ id: U(3), created_at: iso("2026-11-02T10:00:00"), stage: "inquiry" });
    const hist = [
      h("inquiry", "2026-11-01T10:00:00", { deal_id: U(1) }), h("quote", "2026-11-03T10:00:00", { deal_id: U(1) }), h("contract", "2026-11-05T10:00:00", { deal_id: U(1), to_status: "won" }),
      h("inquiry", "2026-11-01T10:00:00", { deal_id: U(2) }), h("quote", "2026-11-02T10:00:00", { deal_id: U(2) }), h("quote", "2026-11-04T10:00:00", { deal_id: U(2), to_status: "lost", reason: "가격" }),
    ];
    const r = buildReport({ deals: [d1, d2, d3], history: hist, activities: [], tasks: [], members: [], from: "2026-11-01", to: "2026-11-30", now: NOW });
    expect(r.funnel.map((f) => f.count)).toEqual([3, 2, 1, 1, 1]);
    expect(r.funnel[1].fromPrev).toBe(67);
    expect(r.dwell[0].days).toBe(2); // 문의: 2일, 1일 → 평균 1.5 → 2
    expect([r.winRate, r.won, r.lost, r.wonSum]).toEqual([50, 1, 1, 100]);
    expect(r.reasons).toEqual([{ reason: "가격", count: 1 }]);
    expect(r.bySource.map((x) => [x.key, x.won, x.closed])).toEqual([["danchu", 1, 1], ["direct", 0, 1]]);
  });
  it("타임라인: 단추 이벤트에 단추가 옮긴 단계가 붙고, 기관이 옮긴 단계는 따로 한 줄", () => {
    const s = src(inv({ status: "submitted", quote: quote() }), award());
    const t = danchuTarget(s, NOW)!;
    const hist = danchuPatch(null, t).history.map((x, i) => ({ ...x, id: `h${i}`, deal_id: U(100), created_by: null }));
    const items = buildTimeline({ activities: [], history: [...hist, h("intake", "2026-11-08T10:00:00", { from_stage: "negotiation", from_status: "open", created_by: "m1" })], quotes: [], tasks: [], contacts: [], members: [{ id: "m1", name: "김 책임" }], danchu: [{ dealId: U(100), src: s, contacts: 2 }] });
    expect(items[0]).toMatchObject({ kind: "stage", who: "김 책임", title: "단계를 협의에서 접수로 옮겼어요" });
    const sel = items.find((x) => x.title === "단추 비교에서 선정됨");
    expect(sel?.sub).toContain("담당자 2명");
    expect(sel?.sub).toContain("단계 견적에서 협의로");
  });
});

describe("엑셀 가져오기", () => {
  it("열 이름으로 칸을 맞춘다", () => {
    expect(["거래처명", "사업자번호", "담당자", "이메일", "연락처", "건명", "견적금액", "진행상태", "비고", "영업담당"].map(guessField))
      .toEqual(["company", "biz_no", "contact", "email", "phone", "deal", "amount", "stage", "memo", "owner"]);
  });
  it("진행상태 값을 단계로", () => {
    expect(["문의중", "견적발송", "네고", "계약완료", "드랍", "시험의뢰서 접수", "???"].map((v) => { const g = guessStage(v); return g ? `${g.stage}/${g.status}` : null; }))
      .toEqual(["inquiry/open", "quote/open", "negotiation/open", "contract/won", "quote/lost", "intake/open", null]);
  });
  it("금액·날짜", () => {
    expect([parseWon("214,500,000"), parseWon("2.1억"), parseWon("6,200만"), parseWon("1억2,200만"), parseWon("₩3,300,000원"), parseWon("미정")]).toEqual([214_500_000, 210_000_000, 62_000_000, 122_000_000, 3_300_000, null]);
    expect([parseYmd("2026.11.2"), parseYmd("26/11/02"), parseYmd(46000), parseYmd("모름")]).toEqual(["2026-11-02", "2026-11-02", "2025-12-09", null]);
  });
  it("같은 회사는 사업자번호 → 이름으로 합치고, 고객사 이름이 비면 건너뛴다", () => {
    const header = ["거래처명", "사업자번호", "담당자", "건명", "견적금액", "진행상태", "비고"];
    const rows = [
      ["(주)가람바이오", "214-86-12345", "박 팀장", "13주 반복독성", "214,500,000", "견적발송", "시험물질 1월 입고"],
      ["가람 바이오", "", "윤 연구원", "유전독성 3종", "2900만", "드랍", ""],
      ["나래제약", "", "이 수석", "단회·반복", "6,200만", "네고", ""],
      ["", "", "", "", "", "", ""],
    ];
    const p = planImport({ header, rows, map: header.map(guessField), stageMap: {}, mode: "merge", companies: [{ id: U(1), name: "가람바이오", aliases: [], biz_no: "214-86-12345" }], members: [], defaultOwner: "me" });
    expect([p.newCompanies, p.mergedCompanies, p.contacts, p.deals, p.open, p.lost, p.skipped]).toEqual([1, 1, 3, 3, 2, 1, 1]);
    expect(p.rows[0].deal).toMatchObject({ amount: 214_500_000, stage: "quote", memo: "비고: 시험물질 1월 입고", owner: "me" });
    const skip = planImport({ header, rows, map: header.map(guessField), stageMap: {}, mode: "skip", companies: [{ id: U(1), name: "가람바이오", aliases: [], biz_no: "" }], members: [], defaultOwner: null });
    expect(skip.skipped).toBe(3);
  });
  it("안건 입력: 이름 필수, 금액은 숫자·억·만", () => {
    expect(parseDeal({}).ok).toBe(false);
    const v = parseDeal({ title: "생물학적 안전성 9종", amount: "4,500만", stage: "quote", kind: "tox", contact_ids: [U(1), U(1), "x"] });
    expect(v.ok && v.value).toMatchObject({ amount: 45_000_000, stage: "quote", kind: "tox", contact_ids: [U(1)] });
    expect(parseDeal({ title: "x", amount: "많이" }).ok).toBe(false);
    expect(parseDeal({ title: "x", stage: "won" }).ok).toBe(false);
  });
});
