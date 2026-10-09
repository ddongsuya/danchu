import { describe, expect, it } from "vitest";
import { reminderStage, daysSince } from "@/lib/contract-reminder";

const day = 864e5;
const now = Date.parse("2026-10-09T00:00:00Z");
const at = (daysAgo: number) => new Date(now - daysAgo * day).toISOString();

describe("계약 보고 리마인더 단계", () => {
  it("14일 전에는 보내지 않는다", () => {
    expect(reminderStage(at(0), now)).toBeNull();
    expect(reminderStage(at(13), now)).toBeNull();
  });
  it("14·30일은 기관 리마인더, 45일부터는 진행 여부 확인", () => {
    expect(reminderStage(at(14), now)).toBe("contract_remind_14");
    expect(reminderStage(at(29), now)).toBe("contract_remind_14");
    expect(reminderStage(at(30), now)).toBe("contract_remind_30");
    expect(reminderStage(at(44), now)).toBe("contract_remind_30");
    expect(reminderStage(at(45), now)).toBe("contract_asked");
    expect(reminderStage(at(400), now)).toBe("contract_asked");
  });
  it("경과일은 내림", () => {
    expect(daysSince(new Date(now - 1.9 * day).toISOString(), now)).toBe(1);
  });
});
