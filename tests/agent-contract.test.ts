import { describe, expect, it } from "vitest";
import { contractView } from "@/lib/agent-contract";

type A = Parameters<typeof contractView>[1];

/*
 * 에이전트 앱 계약 진행 (2026-11-21): 앱에서 견적 제출부터 계약 보고까지 끝낸다(성사 수수료 경로).
 * 웹과 같은 조건: 보고 전 → 기관 보고·의뢰자 결과 알림, 보고 뒤 → 의뢰자 확인·이의(기관은 정정), 이의·확정 뒤 → 동작 없음
 */
const base: A = {
  cro_name: "가 기관", awarded_at: "2026-11-01T00:00:00Z", contract_status: "pending" as A["contract_status"],
  contract_date: null, contract_amount: null, contract_gap_reason: null, contract_note: null, contract_reported_at: null,
  contract_confirm_due_at: null, contract_confirmed_at: null, contract_confirmed_via: null, requester_confirmed_at: null, confirmed_auto: false,
  requester_disputed_at: null, dispute_resolved_at: null,
  sponsor_contract_status: null, sponsor_contract_amount: null, sponsor_contract_date: null, sponsor_reported_at: null,
};
const reported: A = { ...base, contract_status: "signed" as A["contract_status"], contract_date: "2026-11-10", contract_amount: 44_000_000, contract_gap_reason: "scope", contract_note: "회복군 제외", contract_reported_at: "2026-11-10T01:00:00Z", contract_confirm_due_at: "2026-11-17T01:00:00Z" };

describe("계약 진행 보기", () => {
  it("보고 전: 기관은 보고, 의뢰자는 결과 알리기", () => {
    const cro = contractView("cro", base, "selected", 50_000_000);
    expect(cro.state).toBe("awaiting_report");
    expect(cro.can).toEqual({ report: true, correct: false, confirm: false, tellResult: false });
    expect(cro.gapRule.ratio).toBe(0.1);
    expect(cro.gapRule.reasons.map((r) => r.id)).toEqual(["scope", "price", "schedule", "other"]);
    expect(contractView("requester", base, "selected", 50_000_000).can).toEqual({ report: false, correct: false, confirm: false, tellResult: true });
  });
  it("보고 뒤: 의뢰자 확인 대기, 차이와 사유, 기한", () => {
    const v = contractView("requester", reported, "contracting", 50_000_000);
    expect(v.state).toBe("to_confirm");
    expect(v.report).toMatchObject({ amount: 44_000_000, gapReasonLabel: "시험 범위 변경", note: "회복군 제외" });
    expect(v.gap).toEqual({ diff: -6_000_000, ratio: -0.12 });
    expect(v.confirmDueAt).toBe("2026-11-17T01:00:00Z");
    expect(v.can.confirm).toBe(true);
    expect(contractView("cro", reported, "contracting", 50_000_000).can).toMatchObject({ report: false, correct: true });
  });
  it("이의 중이면 아무도 동작하지 않는다", () => {
    const v = contractView("requester", { ...reported, requester_disputed_at: "2026-11-11T00:00:00Z" }, "contracting", 50_000_000);
    expect(v.state).toBe("disputed");
    expect(Object.values(v.can).some(Boolean)).toBe(false);
  });
  it("확정: 자동 확정 표시", () => {
    const v = contractView("cro", { ...reported, contract_confirmed_at: "2026-11-17T02:00:00Z", contract_confirmed_via: "auto" }, "closed", 50_000_000);
    expect(v.state).toBe("confirmed");
    expect(v.confirmedVia).toBe("auto");
    expect(v.confirmDueAt).toBeNull();
  });
  it("의뢰자 결과는 의뢰자에게만, 기관에게는 보고 요청 신호만", () => {
    const told: A = { ...base, sponsor_contract_status: "signed", sponsor_contract_amount: 48_000_000, sponsor_contract_date: "2026-11-09", sponsor_reported_at: "2026-11-09T05:00:00Z" };
    expect(contractView("requester", told, "selected", 50_000_000).sponsor).toMatchObject({ status: "signed", label: "계약했어요", amount: 48_000_000 });
    const cro = contractView("cro", told, "selected", 50_000_000);
    expect(cro.sponsor).toBeNull();
    expect(cro.sponsorSaysSigned).toBe(true);
  });
  it("요청이 끝났으면 동작 없음", () => {
    expect(Object.values(contractView("cro", base, "closed", null).can).some(Boolean)).toBe(false);
  });
});
