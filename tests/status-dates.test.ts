import { describe, expect, it } from "vitest";
import { INVITE_LABEL, STAGES, stageIndex, statusLabel, statusTone } from "@/lib/status";
import { addBusinessDays, formatKo } from "@/lib/dates";
import { diffFields } from "@/lib/audit";
import { anonymousFileLabel, inviteExpiresAt, remainingInvites, seoulMonthRange } from "@/lib/request-policy";
import { monthRangeOf, successFee } from "@/lib/billing";

describe("요청 상태", () => {
  it("단계 진행률은 단조 증가하고 종료가 100 이다", () => {
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].pct).toBeGreaterThan(STAGES[i - 1].pct);
    expect(STAGES[STAGES.length - 1]).toMatchObject({ key: "closed", pct: 100 });
  });
  it("취소는 단계 밖의 라벨·톤을 가진다", () => {
    expect(statusLabel("cancelled")).toBe("취소");
    expect(statusTone("cancelled")).toBe("err");
    expect(stageIndex("cancelled")).toBe(0);
    expect(stageIndex(undefined)).toBe(0);
    expect(statusLabel("contracting")).toBe("계약 진행");
  });
  it("회신하지 않음 라벨은 화면 전체에서 같다", () => {
    expect(INVITE_LABEL.declined).toBe("회신하지 않음");
  });
});

describe("날짜", () => {
  it("영업일 가산은 주말을 건너뛴다 (금요일 + 1 = 월요일)", () => {
    const fri = new Date(2026, 9, 9); // 2026-10-09 금
    expect(addBusinessDays(fri, 1).getDay()).toBe(1);
    expect(addBusinessDays(fri, 5).getDate()).toBe(16);
  });
  it("한국어 날짜 표기", () => {
    expect(formatKo(new Date(2026, 9, 9))).toBe("10월 9일(금)");
  });
  it("회신 링크는 기한 날 자정(서울) 뒤 7일에 만료", () => {
    const exp = inviteExpiresAt("2026-10-09");
    expect(exp.toISOString()).toBe("2026-10-16T14:59:59.000Z");
  });
  it("서울 기준 이번 달 범위", () => {
    expect(seoulMonthRange(new Date("2026-12-15T03:00:00Z"))).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });
});

describe("감사 로그 변경 필드", () => {
  it("바뀐 필드만 남긴다", () => {
    const d = diffFields({ a: 1, b: "x", c: [1] }, { a: 1, b: "y", c: [1] });
    expect(d).toEqual({ before: { b: "x" }, after: { b: "y" } });
  });
});

describe("초대 한도·첨부 익명 라벨", () => {
  it("남은 자리", () => {
    expect(remainingInvites("3곳", 2)).toBe(1);
    expect(remainingInvites("5곳", 7)).toBe(0);
    expect(remainingInvites("전체", 100)).toBe(Number.POSITIVE_INFINITY);
  });
  it("원본 파일명(회사명 포함)은 드러나지 않는다", () => {
    const label = anonymousFileLabel(0, "㈜바이오벤처_시험계획서.pdf", 2.5 * 1024 * 1024);
    expect(label).toBe("첨부 1 (PDF, 2.5MB)");
    expect(label).not.toContain("바이오벤처");
    expect(anonymousFileLabel(2, "noext", 500)).toBe("첨부 3 (파일, 1KB)");
  });
});

describe("청구", () => {
  it("월 범위와 이전·다음 달", () => {
    const r = monthRangeOf("2026-01");
    expect(r.from).toBe("2026-01-01");
    expect(r.to).toBe("2026-02-01");
    expect(r.prev).toBe("2025-12");
    expect(r.next).toBe("2026-02");
  });
  it("성사수수료는 요율이 없으면 null, 있으면 원 단위 반올림", () => {
    expect(successFee(1_000_000, null)).toBeNull();
    expect(successFee(1_000_000, 0.05)).toBe(50_000);
    expect(successFee(333_333, 0.05)).toBe(Math.round(333_333 * 0.05));
  });
});
