import { describe, expect, it } from "vitest";
import { CONFIDENTIALITY_OPTIONS, CRO_COUNT_OPTIONS, countsTowardLimit, invitationLimit } from "@/lib/request-policy";
import { WIZ } from "@/lib/rfq-schema";
import { REPORT_CONTRACT_ERRORS } from "@/lib/rpc";

function fieldOptions(id: string): string[] {
  for (const st of WIZ as Array<{ fields?: Array<{ id: string; options?: string[] }> }>) {
    const f = (st.fields ?? []).find((x) => x.id === id);
    if (f?.options) return f.options;
  }
  throw new Error(`field ${id} not found`);
}

describe("운영자 요청 조건 변경", () => {
  it("선택지가 의뢰자 입력 폼과 같다", () => {
    expect([...CRO_COUNT_OPTIONS]).toEqual(fieldOptions("croCount"));
    expect([...CONFIDENTIALITY_OPTIONS]).toEqual(fieldOptions("confid"));
  });
  it("기관 수를 이미 전달한 수보다 줄일 수 없다 (회신하지 않음·만료는 자리를 비운다)", () => {
    const used = ["sent", "submitted", "declined", "expired", "draft"].filter(countsTowardLimit).length;
    expect(used).toBe(3);
    expect(used > invitationLimit("3곳")).toBe(false);
    expect(4 > invitationLimit("3곳")).toBe(true);
    expect(100 > invitationLimit("전체")).toBe(false);
  });
});

describe("계약 보고 오류 매핑", () => {
  it("DB 함수의 코드마다 안내 문구와 상태가 있다", () => {
    for (const code of ["not_found", "already", "amount", "date", "future"]) {
      expect(REPORT_CONTRACT_ERRORS[code].message.length).toBeGreaterThan(0);
      expect([400, 404, 409]).toContain(REPORT_CONTRACT_ERRORS[code].status);
    }
  });
});
