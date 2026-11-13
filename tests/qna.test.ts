import { describe, expect, it } from "vitest";
import { cleanText, croItems, partyLabels, qnaWindow, sponsorItems, type QnaRow } from "@/lib/qna";
import { CONTACT_MASK } from "@/lib/contact-guard";

const row = (o: Partial<QnaRow> & Pick<QnaRow, "id" | "invite_id" | "direction">): QnaRow => ({
  rfq_id: "r", cro_org_id: null, topic: "terms", test_seq: null, body: "질의", body_has_contact: false, asked_by: null, created_at: "2026-11-13T00:00:00Z",
  answer: null, answer_has_contact: false, answered_by: null, answered_at: null, scope: null, ...o,
});
const tests = new Map([[1, "반복투여 4주"]]);

describe("질의응답 열람·가림 (0045)", () => {
  const rows = [
    row({ id: "1", invite_id: "a", direction: "cro", body: "자료는 a@example.com 으로", answer: "포함해 주세요 010-1234-5678", answered_at: "2026-11-13T01:00:00Z", scope: "all", test_seq: 1 }),
    row({ id: "2", invite_id: "b", direction: "cro", body: "착수일 문의", answer: "가능", answered_at: "2026-11-13T01:00:00Z", scope: "private" }),
    row({ id: "3", invite_id: "b", direction: "cro", body: "아직 답 없음" }),
    row({ id: "4", invite_id: "a", direction: "sponsor", topic: "quote", body: "조제물분석 포함 시 금액?" }),
  ];

  it("기관은 자기 질의와 전체 공개 답변만 본다", () => {
    const b = croItems(rows, { inviteId: "b", selectedInviteId: null, tests });
    expect(b.mine.map((i) => i.id)).toEqual(["2", "3"]);
    expect(b.shared.map((i) => i.id)).toEqual(["1"]);
    // 공개 답변에는 질의 기관을 드러내지 않고, 연락처는 언제나 가린다
    expect(b.shared[0].inviteId).toBe("");
    expect(b.shared[0].body).toContain(CONTACT_MASK);
    expect(b.shared[0].answer).toContain(CONTACT_MASK);
    expect(b.shared[0].test).toBe("반복투여 4주");
  });

  it("기관 a: 의뢰자 질의는 답할 차례, 의뢰자 답의 연락처는 선정 전 가림", () => {
    const a = croItems(rows, { inviteId: "a", selectedInviteId: null, tests });
    expect(a.mine.find((i) => i.id === "4")?.toAnswer).toBe(true);
    expect(a.mine.find((i) => i.id === "1")?.answer).toContain(CONTACT_MASK);
    // 자기가 쓴 글은 그대로
    expect(a.mine.find((i) => i.id === "1")?.body).toContain("a@example.com");
    const sel = croItems(rows, { inviteId: "a", selectedInviteId: "a", tests });
    expect(sel.mine.find((i) => i.id === "1")?.answer).toContain("010-1234-5678");
  });

  it("의뢰자: 기관 글의 연락처는 선정한 기관 것만 원문, 비교표 전 기관 A·B", () => {
    const labels = partyLabels([
      { id: "b", cro_name: "나기관", joined_at: "2026-11-11T00:00:00Z", sent_at: "2026-11-10T00:00:00Z" },
      { id: "a", cro_name: "가기관", joined_at: "2026-11-10T00:00:00Z", sent_at: "2026-11-10T00:00:00Z" },
    ], false);
    expect(labels.get("a")).toBe("기관 A");
    expect(labels.get("b")).toBe("기관 B");
    const s = sponsorItems(rows, { labels, selectedInviteId: null, tests });
    expect(s.find((i) => i.id === "1")?.body).toContain(CONTACT_MASK);
    expect(s.find((i) => i.id === "1")?.answer).toContain("010-1234-5678");
    expect(s.filter((i) => i.toAnswer).map((i) => i.id)).toEqual(["3"]);
    expect(partyLabels([{ id: "a", cro_name: "가기관", joined_at: null, sent_at: "2026-11-10T00:00:00Z" }], true).get("a")).toBe("가기관");
  });

  it("질의 창: 기관은 비교표 전, 의뢰자는 비교표 뒤, 선정 뒤 모두 닫힘", () => {
    expect(qnaWindow({ compared_at: null, selected_quote_id: null, status: "distributed" })).toEqual({ croAsk: true, sponsorAsk: false, answer: true });
    expect(qnaWindow({ compared_at: "x", selected_quote_id: null, status: "compared" })).toEqual({ croAsk: false, sponsorAsk: true, answer: true });
    expect(qnaWindow({ compared_at: "x", selected_quote_id: "q", status: "selected" })).toEqual({ croAsk: false, sponsorAsk: false, answer: false });
    expect(cleanText("  ")).toBeNull();
    expect(cleanText("가".repeat(1001))).toBeNull();
    expect(cleanText(" 질의 ")).toBe("질의");
  });
});
