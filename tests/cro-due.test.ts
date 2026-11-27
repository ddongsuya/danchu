import { describe, expect, it } from "vitest";
import { MAX_REPLY_PDF, daysLeft, doneAt, replyDueLabel, replyPdfError, saveStatus, sortByReplyDue, sortReceived, validUntilError, withObj, withRo } from "@/lib/cro-due";

const TODAY = "2027-07-14";

describe("replyDueLabel", () => {
  it("남은 날을 D-n으로 쓴다", () => {
    expect(replyDueLabel("2027-07-27", TODAY)).toEqual({ text: "07-27 · D-13", today: false });
  });
  it("당일은 오늘 마감", () => {
    expect(replyDueLabel("2027-07-14", TODAY)).toEqual({ text: "오늘 마감", today: true });
  });
  it("지난 기한은 마감", () => {
    expect(replyDueLabel("2027-07-01", TODAY).text).toBe("07-01 · 마감");
  });
  it("기한이 없으면 -", () => {
    expect(replyDueLabel("", TODAY).text).toBe("-");
    expect(replyDueLabel(null, TODAY).text).toBe("-");
  });
  it("월을 넘겨도 날 수가 맞다", () => {
    expect(daysLeft("2027-08-02", TODAY)).toBe(19);
  });
});

describe("sortByReplyDue", () => {
  it("남은 기한 가까운 순, 지난 기한은 뒤에 최근 순, 기한 없음은 맨 뒤", () => {
    const rows = [
      { no: "A", replyBy: "2027-07-27" },
      { no: "B", replyBy: "2027-07-16" },
      { no: "C", replyBy: "2027-06-25" },
      { no: "D", replyBy: "" },
      { no: "E", replyBy: "2027-07-01" },
      { no: "F", replyBy: "2027-07-14" },
    ];
    expect(sortByReplyDue(rows, TODAY).map((r) => r.no)).toEqual(["F", "B", "A", "E", "C", "D"]);
  });
  it("원래 배열을 바꾸지 않는다", () => {
    const rows = [{ no: "A", replyBy: "2027-07-27" }, { no: "B", replyBy: "2027-07-16" }];
    sortByReplyDue(rows, TODAY);
    expect(rows[0].no).toBe("A");
  });
});

describe("doneAt", () => {
  it("ISO 시각만 받는다", () => {
    expect(doneAt("2027-07-14T06:20:00.000Z")).toBe("2027-07-14T06:20:00.000Z");
    expect(doneAt("x")).toBeUndefined();
    expect(doneAt(undefined)).toBeUndefined();
  });
});

describe("회신 쓰기 도우미", () => {
  it("PDF가 아니면 막는다", () => {
    expect(replyPdfError({ name: "견적서.docx", size: 400_000, type: "application/msword" })).toBe("PDF 파일만 올릴 수 있어요.");
  });
  it("20MB를 넘으면 크기를 알려 준다", () => {
    expect(replyPdfError({ name: "스캔.pdf", size: 24 * 1024 * 1024 - 10, type: "application/pdf" })).toBe("24MB예요. 20MB 이하로 줄여 다시 올려 주세요.");
  });
  it("20MB 이하 PDF는 통과", () => {
    expect(replyPdfError({ name: "a.PDF", size: MAX_REPLY_PDF, type: "" })).toBeNull();
  });
  it("저장 상태 문구", () => {
    expect(saveStatus("saved", Date.parse("2027-07-14T05:02:00Z"))).toBe("저장됨 14:02");
    expect(saveStatus("saved", null)).toBe("저장됨");
    expect(saveStatus("failed", null)).toBe("저장 멈춤");
    expect(saveStatus("saving", null)).toBe("저장하는 중");
    expect(saveStatus("idle", null)).toBe("");
  });
  it("유효기간은 오늘 이후", () => {
    expect(validUntilError("2027-07-10", TODAY)).toBe("오늘 이후 날짜를 골라 주세요.");
    expect(validUntilError("2027-07-14", TODAY)).toBeNull();
    expect(validUntilError("", TODAY)).toBeNull();
  });
});

describe("withRo", () => {
  it("받침에 맞춰 로/으로", () => {
    expect(["문의", "견적", "협의", "접수", "계약", "서울"].map(withRo)).toEqual(["문의로", "견적으로", "협의로", "접수로", "계약으로", "서울로"]);
  });
});

describe("withObj", () => {
  it("받침에 맞춰 을/를", () => {
    expect(["영업 담당", "김 책임", "견적 담당자", "Kim"].map(withObj)).toEqual(["영업 담당을", "김 책임을", "견적 담당자를", "Kim를"]);
  });
});

describe("sortReceived", () => {
  const rows = [
    { no: "A", sentAt: "2027-07-05", replyBy: "2027-07-16" },
    { no: "B", sentAt: "2027-07-13", replyBy: "2027-07-27" },
    { no: "C", sentAt: "2027-06-21", replyBy: "2027-07-01" },
  ];
  it("기본은 받은 날 최근 순", () => {
    expect(sortReceived(rows, "", TODAY).map((r) => r.no)).toEqual(["B", "A", "C"]);
  });
  it("due 는 회신 기한 가까운 순, 지난 기한은 뒤", () => {
    expect(sortReceived(rows, "due", TODAY).map((r) => r.no)).toEqual(["A", "B", "C"]);
  });
});
