import { describe, expect, it } from "vitest";
import { parseSelectReasons, SELECT_NOTE_MAX } from "@/lib/select-reasons";

/* 기관 선정 사유(lib/select-reasons.ts): 고르지 않아도 되고, 목록 밖 값은 버린다 */
describe("선정 사유", () => {
  it("없으면 빈 목록, 상세 없음", () => {
    expect(parseSelectReasons({})).toEqual({ reasons: [], note: null });
    expect(parseSelectReasons({ reasons: "일정", reasonNote: "   " })).toEqual({ reasons: [], note: null });
  });

  it("목록에 있는 값만, 한 번씩, 목록 순서대로", () => {
    expect(parseSelectReasons({ reasons: ["일정", "가장 쌈", "시험 범위 적합", "일정", 3] }).reasons).toEqual(["시험 범위 적합", "일정"]);
  });

  it("상세 설명은 다듬고 길이를 자른다", () => {
    expect(parseSelectReasons({ reasonNote: "  담당 연구원 경험  " }).note).toBe("담당 연구원 경험");
    expect(parseSelectReasons({ reasonNote: "가".repeat(500) }).note).toHaveLength(SELECT_NOTE_MAX);
  });
});
