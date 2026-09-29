import { describe, expect, it } from "vitest";
import { won, comma, md, dday } from "@/lib/format";
import { safeName } from "@/lib/upload";
import { addBusinessDays } from "@/lib/dates";

describe("won — 금액 한글 표기", () => {
  it("억·만 단위", () => {
    expect(won(187_000_000)).toBe("1억 8,700만 원");
    expect(won(100_000_000)).toBe("1억 ");
    expect(won(35_000_000)).toBe("3,500만 원");
  });
  it("만 원 미만과 0", () => {
    expect(won(0)).toBe("0원");
    expect(won(9_500)).toBe("9,500원");
  });
  it("comma", () => {
    expect(comma(1234567)).toBe("1,234,567원");
  });
});

describe("md / dday", () => {
  it("YYYY-MM-DD → M월 D일", () => {
    expect(md("2026-10-05")).toBe("10월 5일");
    expect(md(null)).toBe("—");
  });
  it("지난 날짜는 '기한 지남'", () => {
    expect(dday("2000-01-01").label).toBe("기한 지남");
    expect(dday(null).label).toBe("");
  });
});

describe("safeName — 저장 경로용 파일명", () => {
  it("한글·공백은 밑줄로, 확장자는 소문자", () => {
    expect(safeName("시험물질 자료.PDF")).toBe("file.pdf");
    expect(safeName("report v2 (final).docx")).toBe("report_v2_final.docx");
  });
  it("확장자 없음·빈 이름", () => {
    expect(safeName("README")).toBe("README");
    expect(safeName("...")).toBe("file");
  });
  it("길이 제한", () => {
    expect(safeName(`${"a".repeat(200)}.xlsx`).length).toBeLessThanOrEqual(80 + 1 + 8);
  });
});

describe("addBusinessDays — 토·일 제외", () => {
  it("금요일 + 1영업일 = 월요일", () => {
    const fri = new Date("2026-10-02T09:00:00"); // 2026-10-02 은 금요일
    expect(addBusinessDays(fri, 1).getDay()).toBe(1);
  });
  it("5영업일은 달력으로 7일", () => {
    const mon = new Date("2026-10-05T09:00:00");
    const d = addBusinessDays(mon, 5);
    expect((d.getTime() - mon.getTime()) / 864e5).toBe(7);
  });
});
