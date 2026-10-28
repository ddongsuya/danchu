import { describe, expect, it, vi } from "vitest";
import { newVariant, prefillRow, type CatalogItem } from "@/lib/catalog";
import { autoReplyEnabled } from "@/lib/env";

/* 카탈로그 초안은 참여 뒤에만 만든다 (0023). 아래 loadByInvite 테스트용 가짜 DB */
const fx = vi.hoisted(() => ({ catalogMap: vi.fn(async (_org: string) => new Map()), quotesRead: 0, steps: [] as { name: string; weeks: number | null; after_keys: string[] }[] }));
vi.mock("@/lib/supabase", () => {
  const rfq = { id: "rfq-1", rfq_no: "DC-2026-0200", categories: ["일반독성"], payload: { categories: ["일반독성"], "일반독성.items": ["단회투여독성"] }, confidentiality: "일반", org_type: null, company: "의뢰사", substance: "물질", cro_count: "3곳", join_by: null, selected_quote_id: null, compared_at: null, status: "distributed", reply_by: "2099-01-20" };
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    const res = () => {
      if (table === "cro_quotes") fx.quotesRead++;
      return { data: table === "rfq_requests" ? rfq : table === "cro_orgs" ? { status: "approved" } : table === "rfq_files" ? [] : null, error: null };
    };
    Object.assign(b, { select: () => b, update: () => b, eq: () => b, order: () => b, maybeSingle: async () => res(), then: (r: (v: unknown) => unknown) => Promise.resolve(res()).then(r) });
    return b;
  };
  return { getSupabaseAdmin: () => ({ from, rpc: async () => ({ data: { cap: 3, used: 0, reserved: 0, open: 3, join_by: null }, error: null }) }) };
});
vi.mock("@/lib/catalog-db", () => ({ catalogMap: fx.catalogMap, loadScheduleSteps: async () => fx.steps, stepKey: (n: string) => `step::${n}` }));
import { loadByInvite } from "@/lib/quote-load";
import type { InviteRow } from "@/lib/data";

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

describe("카탈로그 초안은 참여 뒤에만 (0023)", () => {
  const inv = (joined: boolean) => ({ id: "inv-1", rfq_id: "rfq-1", cro_org_id: "org-1", cro_name: "바이오랩", token: "tok_prefill_0000", reply_by: "2099-01-20", expires_at: "2099-01-27T00:00:00Z", status: "sent", opened_at: "2026-10-01", cda_signed_at: null, revoked_at: null, joined_at: joined ? "2026-10-02T00:00:00Z" : null, withdrawn_at: null }) as unknown as InviteRow;
  it("참여 전에는 카탈로그를 읽지 않고 초안이 없다", async () => {
    fx.catalogMap.mockClear();
    const got = await loadByInvite(inv(false));
    expect(got?.draft).toBeNull();
    expect(fx.catalogMap).not.toHaveBeenCalled();
  });
  it("참여 뒤에는 카탈로그 단가로 초안을 채운다", async () => {
    const v = newVariant(item, { price_min: 5_000_000, price_max: 5_000_000, weeks: 4, source: "manual" });
    fx.catalogMap.mockResolvedValueOnce(new Map([[item.key, [v]]]));
    const got = await loadByInvite(inv(true));
    expect(fx.catalogMap).toHaveBeenCalledWith("org-1");
    expect(got?.draft?.prefilled).toBe(true);
    expect(got?.draft?.items[0].amount).toBe("5000000");
  });
  it("일정(0029): 지난 견적의 보고서 주수·앞 단계·일정 단계를 이번 요청서 행 번호로 채운다", async () => {
    const v = { ...newVariant(item, { price_min: 5_000_000, price_max: 5_000_000, weeks: 4, source: "learned" }), report_weeks: 2, after_keys: ["step::단계 A"] };
    fx.catalogMap.mockResolvedValueOnce(new Map([[item.key, [v]]]));
    fx.steps = [{ name: "단계 A", weeks: 3, after_keys: [] }, { name: "관계없는 단계", weeks: 1, after_keys: ["다른::시험"] }];
    const got = await loadByInvite(inv(true));
    fx.steps = [];
    expect(got?.draft?.items[0].reportWeeks).toBe("2");
    expect(got?.draft?.items[0].afterSeqs).toEqual([101]);
    expect(got?.draft?.steps).toEqual([{ seq: 101, name: "단계 A", weeks: "3", after: [] }]);
  });
});
