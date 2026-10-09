import { describe, expect, it } from "vitest";
import { newVariant, prefillRow, type CatalogItem } from "@/lib/catalog";
import { autoReplyEnabled } from "@/lib/env";

const item: CatalogItem = { key: "일반독성::단회투여독성", category: "일반독성", item: "단회투여독성" };
const row = { seq: 1, category: "일반독성", name: "단회투여독성", cond: "" };

describe("카탈로그 초안 금액", () => {
  it("참고 단가가 한 값이면 그대로 채운다", () => {
    const v = newVariant(item, { price_min: 5_000_000, price_max: 5_000_000, weeks: 4, source: "manual" });
    const p = prefillRow(row, { row: v, mismatch: [] }, {});
    expect(p.amount).toBe("5000000");
    expect(p.checks).toEqual([]);
  });
  it("범위(최저~최고)면 하한을 쓰지 않고 확인 필요를 붙인다", () => {
    const v = newVariant(item, { price_min: 5_000_000, price_max: 8_000_000, weeks: 4, source: "manual" });
    const p = prefillRow(row, { row: v, mismatch: [] }, {});
    expect(p.amount).toBe("");
    expect(p.checks).toContain("단가 범위 확인");
  });
});

describe("자동 회신 플래그", () => {
  it("기본은 꺼짐", () => {
    expect(autoReplyEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(autoReplyEnabled({ NODE_ENV: "production", DANCHU_AUTO_REPLY: "1" })).toBe(true);
  });
});
