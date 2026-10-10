import { describe, expect, it } from "vitest";
import { cleanNominees } from "@/lib/request-policy";
import { WIZ } from "@/lib/rfq-schema";

describe("지명 기관", () => {
  const approved = ["㈜바이오벤처 안전성평가연구소", "켐온", "우정바이오"];
  it("승인된 기관 이름만, 중복 없이, 기관 수 한도 안에서", () => {
    expect(cleanNominees(["켐온", " 켐온 ", "없는기관", "우정바이오", "㈜바이오벤처 안전성평가연구소", 3], "3곳", approved)).toEqual(["켐온", "우정바이오", "㈜바이오벤처 안전성평가연구소"]);
    expect(cleanNominees(["켐온", "우정바이오", "㈜바이오벤처 안전성평가연구소"], "전체", approved)).toHaveLength(3);
    expect(cleanNominees("켐온", "3곳", approved)).toEqual([]);
    expect(cleanNominees(["켐온"], "3곳", [])).toEqual([]);
  });
  it("위자드 마지막 단계는 여전히 동의 단계다 (지명 단계가 끼어들어도)", () => {
    expect(WIZ[WIZ.length - 1].fields.every((f) => f.id.startsWith("agree"))).toBe(true);
    expect(WIZ.findIndex((w) => w.fields.some((f) => f.id === "nominees"))).toBe(WIZ.findIndex((w) => w.fields.some((f) => f.id === "croCount")) + 1);
    expect(WIZ.some((w) => w.fields.some((f) => f.id === "nominees" && f.type === "orgs" && !f.required))).toBe(true);
  });
});
