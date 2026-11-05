import { describe, expect, it } from "vitest";
import { contractSignals, externalWithInvited, gapLabel, gapOf, orgKey, shouldAskSponsor, SPONSOR_ASK_DAYS, type SignalAward } from "@/lib/contract-gap";
import { CONTACT_MASK, maskContacts } from "@/lib/contact-guard";
import { gapReady } from "@/components/GapReasonField";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const base: SignalAward = {
  quoteAmount: 100_000_000,
  contractAmount: null,
  contractStatus: "pending",
  contractReportedAt: null,
  contractConfirmedAt: null,
  gapReason: null,
  sponsorStatus: null,
  sponsorAmount: null,
  awardedAt: "2026-10-01T00:00:00Z",
};

describe("견적·계약 금액 차이", () => {
  it("10% 이상이면 사유가 필요하다 (DB 와 같은 정수 비교)", () => {
    expect(gapOf(100_000_000, 90_000_000)?.needsReason).toBe(true);
    expect(gapOf(100_000_000, 90_000_001)?.needsReason).toBe(false);
    expect(gapOf(100_000_000, 110_000_000)?.needsReason).toBe(true);
    expect(gapOf(null, 1)).toBeNull();
    expect(gapOf(0, 1)).toBeNull();
  });
  it("차이 문구", () => {
    expect(gapLabel(gapOf(100_000_000, 88_000_000)!, won)).toBe("선정 견적보다 12,000,000원(12%) 낮아요");
    expect(gapLabel(gapOf(100_000_000, 100_000_000)!, won)).toBe("선정 견적과 같아요");
  });
  it("폼은 사유, 기타면 비고까지 있어야 저장한다", () => {
    expect(gapReady(100_000_000, "95000000", "", "")).toBe(true);
    expect(gapReady(100_000_000, "80000000", "", "")).toBe(false);
    expect(gapReady(100_000_000, "80000000", "scope", "")).toBe(true);
    expect(gapReady(100_000_000, "80000000", "other", "")).toBe(false);
    expect(gapReady(100_000_000, "80000000", "other", "군 하나 제외")).toBe(true);
    expect(gapReady(null, "80000000", "", "")).toBe(true);
  });
});

describe("확인할 신호", () => {
  it("계약 금액이 20% 이상 낮으면", () => {
    const s = contractSignals({ ...base, contractStatus: "signed", contractReportedAt: "2026-10-10", contractAmount: 79_000_000, gapReason: "scope" }, won);
    expect(s.map((x) => x.kind)).toEqual(["low_amount"]);
    expect(s[0].label).toContain("시험 범위 변경");
  });
  it("의뢰자는 계약했다는데 기관 보고가 없으면", () => {
    expect(contractSignals({ ...base, sponsorStatus: "signed", sponsorAmount: 90_000_000 }, won).map((x) => x.kind)).toEqual(["sponsor_signed_no_report"]);
  });
  it("기관은 미체결, 의뢰자는 계약", () => {
    expect(contractSignals({ ...base, contractStatus: "not_signed", sponsorStatus: "signed" }, won).map((x) => x.kind)).toEqual(["cro_not_signed_sponsor_signed"]);
  });
  it("금액이 다르면", () => {
    const s = contractSignals({ ...base, contractStatus: "signed", contractReportedAt: "2026-10-10", contractAmount: 95_000_000, sponsorStatus: "signed", sponsorAmount: 120_000_000 }, won);
    expect(s.map((x) => x.kind)).toEqual(["amount_mismatch"]);
  });
  it("기관은 체결, 의뢰자는 계약 안 함", () => {
    expect(contractSignals({ ...base, contractStatus: "signed", contractReportedAt: "2026-10-10", contractAmount: 100_000_000, sponsorStatus: "not_signed" }, won).map((x) => x.kind)).toEqual(["sponsor_says_not_signed"]);
  });
  it("양쪽이 같으면 신호 없음", () => {
    expect(contractSignals({ ...base, contractStatus: "signed", contractReportedAt: "2026-10-10", contractAmount: 100_000_000, sponsorStatus: "signed", sponsorAmount: 100_000_000 }, won)).toEqual([]);
  });
});

describe("의뢰자에게 계약 결과 묻기", () => {
  const at = "2026-10-01T00:00:00Z";
  const day = (n: number) => new Date(at).getTime() + n * 864e5;
  it(`${SPONSOR_ASK_DAYS}일부터, 보고·알림이 없을 때만`, () => {
    expect(shouldAskSponsor({ awardedAt: at, contractReportedAt: null, contractStatus: "pending", sponsorReportedAt: null }, day(SPONSOR_ASK_DAYS - 1))).toBe(false);
    expect(shouldAskSponsor({ awardedAt: at, contractReportedAt: null, contractStatus: "pending", sponsorReportedAt: null }, day(SPONSOR_ASK_DAYS))).toBe(true);
    expect(shouldAskSponsor({ awardedAt: at, contractReportedAt: "x", contractStatus: "signed", sponsorReportedAt: null }, day(30))).toBe(false);
    expect(shouldAskSponsor({ awardedAt: at, contractReportedAt: null, contractStatus: "pending", sponsorReportedAt: "x" }, day(30))).toBe(false);
    expect(shouldAskSponsor({ awardedAt: at, contractReportedAt: null, contractStatus: "not_signed", sponsorReportedAt: null }, day(30))).toBe(false);
  });
});

describe("외부 진행 메모의 참여 기관 이름", () => {
  it("법인 표기·공백을 빼고 찾는다", () => {
    expect(orgKey("(주) 한빛 바이오")).toBe("한빛바이오");
    expect(externalWithInvited("한빛바이오랑 직접 계약했어요", ["(주)한빛 바이오", "다른기관"])).toEqual(["(주)한빛 바이오"]);
    expect(externalWithInvited("해외 기관과 진행", ["(주)한빛 바이오"])).toEqual([]);
    expect(externalWithInvited("", ["A"])).toEqual([]);
  });
});

describe("선정 전 연락처 가리기", () => {
  it("이메일·전화·링크·메신저", () => {
    for (const t of ["담당 kim.lab@example.co.kr 로 연락", "010-1234-5678", "02 123 4567", "+82 10 1234 5678", "www.example.com 참고", "https://example.com/a", "카톡 아이디: labkim01", "open.kakao.com/o/abcd", "1588-1234"]) {
      const r = maskContacts(t);
      expect(r.masked, t).toBe(true);
      expect(r.text).toContain(CONTACT_MASK);
    }
  });
  it("시험 내용은 건드리지 않는다", () => {
    for (const t of ["영문 보고서 별도 +8,000,000원", "OECD TG 471, ICH S2(R1)", "회복군 5마리/성, 13주", "용량 0, 10, 30, 100 mg/kg", "2026-11-04 착수"]) {
      expect(maskContacts(t)).toEqual({ text: t, masked: false });
    }
  });
});
