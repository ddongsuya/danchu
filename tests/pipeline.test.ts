import { describe, expect, it } from "vitest";
import { buildPipeline, clientKeyOf, gapPct } from "@/lib/pipeline";

const NOW = new Date("2026-11-07T00:00:00+09:00").getTime();
const day = (d: number) => new Date(NOW + d * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inv = (o: Record<string, unknown>): any => ({
  id: "00000000-0000-0000-0000-00000000000" + (o.n ?? 1), rfq_id: "r" + (o.n ?? 1), rfq_no: "DC-2026-000" + (o.n ?? 1), status: "sent", sent_at: day(-3), reply_by: day(10), expires_at: day(30),
  joined_at: null, withdrawn_at: null, revoked_at: null, quote: null,
  rfq: { substance: "물질 가", categories: ["일반독성"], org_type: "제약사", company: "의뢰사 가", status: "distributed", selected_quote_id: null, compared_at: null, join_by: day(2), user_id: "u1" },
  ...o,
});

describe("견적 진행판", () => {
  it("참여 전에는 물질명과 회사가 보이지 않고, 참여 결정 기한이 7일 안이면 이번 주 할 일", () => {
    const [x] = buildPipeline([inv({})], [], NOW);
    expect(x.title).not.toContain("물질 가");
    expect(x.client).toBeNull();
    expect(x.group).toBe("todo");
    expect(x.next).toBe("참여할지 정하기");
  });
  it("선정되면 회사가 보이고 계약 결과 보고가 할 일", () => {
    const q = { id: "q1", status: "submitted", total_amount: 100_000_000, submitted_at: day(-2) };
    const i = inv({ status: "submitted", joined_at: day(-3), quote: q, rfq: { ...inv({}).rfq, status: "selected", selected_quote_id: "q1" } });
    const a = { id: "a1", invite_id: i.id, rfq_id: i.rfq_id, awarded_at: day(-1), contract_reported_at: null, contract_amount: null, substance_updated_at: null, quoteAmount: 100_000_000, rfq: { rfq_no: i.rfq_no, substance: "물질 가", company: "의뢰사 가", user_id: "u1", org_type: "제약사" } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [x] = buildPipeline([i], [a as any], NOW);
    expect(x.client).toBe("의뢰사 가");
    expect(x.clientKey).toBe("u1");
    expect(x.group).toBe("todo");
    expect(x.action?.label).toBe("계약 결과 보고");
  });
  it("다른 기관이 선정되면 미선정, 회사는 끝까지 가린다", () => {
    const q = { id: "q1", status: "submitted", total_amount: 50_000_000 };
    const [x] = buildPipeline([inv({ status: "submitted", joined_at: day(-3), quote: q, rfq: { ...inv({}).rfq, status: "selected", selected_quote_id: "other" } })], [], NOW);
    expect(x.stageLabel).toBe("미선정");
    expect(x.client).toBeNull();
  });
  it("고객 키와 금액 차이", () => {
    expect(clientKeyOf({ user_id: null, company: "의뢰사 나" })).toBe("co:의뢰사 나");
    expect(gapPct(315_370_000, 298_000_000)).toBe(-5.5);
  });
});
