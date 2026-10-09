import { describe, expect, it } from "vitest";
import { findExistingClient, normalizeCompanyName } from "@/lib/request-policy";

describe("기존 고객 판정", () => {
  it("법인 표기·공백·기호를 떼고 같은 회사로 본다", () => {
    expect(normalizeCompanyName("㈜바이오벤처")).toBe("바이오벤처");
    expect(normalizeCompanyName("바이오벤처 주식회사")).toBe("바이오벤처");
    expect(normalizeCompanyName("(주) 바이오-벤처")).toBe("바이오벤처");
    expect(normalizeCompanyName("BioVenture Co., Ltd.")).toBe("bioventure");
    expect(normalizeCompanyName("")).toBe("");
  });
  it("목록에서 찾고, 없으면 null", () => {
    const list = [{ name: "㈜바이오벤처", business_no: null }, { name: "켐온", business_no: "1234567890" }];
    expect(findExistingClient("바이오벤처 주식회사", list)?.name).toBe("㈜바이오벤처");
    expect(findExistingClient("켐 온", list)?.name).toBe("켐온");
    expect(findExistingClient("다른회사", list)).toBeNull();
    expect(findExistingClient(null, list)).toBeNull();
  });
});
