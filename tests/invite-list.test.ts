import { describe, expect, it } from "vitest";
import { bucket, endedLabel } from "@/components/cro/InviteList";

/* 기관 받은 요청함의 "종료" 줄 표시 (흐름 재설계 디자인 2d783db): 이유가 보이게 취소됨·마감·만료로 나눈다 */
const NOW = Date.parse("2026-10-21T00:00:00Z");
const open = "2026-11-30T14:59:59Z";
const past = "2026-10-01T14:59:59Z";
const row = (over: Partial<Parameters<typeof endedLabel>[0]> = {}) => ({ stage: "undecided" as const, cancelled: false, rfqStatus: "distributed", expiresAt: open, ...over });

describe("받은 요청함 종료 표시", () => {
  it("운영자가 취소한 안내는 취소됨", () => {
    const r = row({ stage: "ended", cancelled: true });
    expect(bucket(r)).toBe("종료");
    expect(endedLabel(r, NOW)).toBe("취소됨");
  });
  it("내기 전에 비교표가 열리거나 요청이 끝나면 마감", () => {
    for (const s of ["compared", "selected", "contracting", "closed", "cancelled"]) {
      expect(endedLabel(row({ stage: "joined", rfqStatus: s }), NOW)).toBe("마감");
    }
    // 제출한 뒤 마감
    expect(endedLabel(row({ stage: "submitted", rfqStatus: "compared" }), NOW)).toBe("마감");
  });
  it("링크 기한이 지난 안내는 만료, 불참·철회는 그 이름 그대로", () => {
    expect(endedLabel(row({ expiresAt: past }), NOW)).toBe("만료");
    expect(endedLabel(row({ stage: "declined" }), NOW)).toBe("불참");
    expect(endedLabel(row({ stage: "withdrawn" }), NOW)).toBe("철회");
  });
  it("취소가 마감·만료보다 먼저 보인다", () => {
    expect(endedLabel(row({ stage: "ended", cancelled: true, rfqStatus: "compared", expiresAt: past }), NOW)).toBe("취소됨");
  });
});
