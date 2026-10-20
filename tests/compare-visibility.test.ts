import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 비교표 공개 전 의뢰자 화면 (2026-10-20 결정 1).
 * 열리기 전에는 진행 숫자만 보이고, 견적·견적서·선정은 열린 뒤에만. 기한 전 선정 길(보류 뒤 다시 열기 포함)은 없다.
 */

type Row = Record<string, unknown>;
const fx = vi.hoisted(() => ({
  rfq: null as Row | null,
  updates: [] as Row[],
  quotes: [{ cro_org_id: "org-1" }] as Row[],
}));

vi.mock("@/lib/auth", () => ({
  sessionOrNull: async () => ({ userId: "u-1", email: "a@example.test", profile: { role: "requester" } }),
}));
vi.mock("@/lib/data", () => ({
  getRfqByNo: async () => fx.rfq,
  ownsRfq: (r: Row, id: string) => r.user_id === id,
}));
vi.mock("@/lib/notify", () => ({ adminUserIds: async () => [], logEvent: async () => undefined, notifyUsers: async () => undefined }));
vi.mock("@/lib/supabase", () => {
  const chain = (table: string) => {
    let update: Row | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      in: () => q,
      update: (v: Row) => ((update = v), q),
      maybeSingle: async () => {
        if (update) fx.updates.push(update);
        return { data: { id: "r-1" }, error: null };
      },
      then: (res: (v: unknown) => unknown) => res({ data: table === "cro_quotes" ? fx.quotes : [], error: null }),
    };
    return q;
  };
  return { getSupabaseAdmin: () => ({ from: chain }) };
});

import { POST as reopen } from "@/app/api/rfq/[no]/reopen/route";

const held = (over: Row = {}): Row => ({ id: "r-1", rfq_no: "DC-2026-0100", user_id: "u-1", outcome: "보류", status: "closed", selected_quote_id: null, outcome_at: new Date().toISOString(), compared_at: null, ...over });
const call = () => reopen(new Request("https://danchu.kr/api/rfq/DC-2026-0100/reopen", { method: "POST" }), { params: Promise.resolve({ no: "DC-2026-0100" }) });

beforeEach(() => {
  fx.updates = [];
  fx.quotes = [{ cro_org_id: "org-1" }];
});

describe("보류한 요청 다시 열기", () => {
  it("비교표가 열리기 전에 보류한 요청은 다시 열지 않는다 (기한 전 선정 길이 되므로)", async () => {
    fx.rfq = held();
    const r = await call();
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toContain("비교표가 열리기 전");
    expect(fx.updates).toEqual([]);
  });
  it("비교표가 열린 뒤 보류한 요청은 같은 공개 시각으로 다시 연다", async () => {
    fx.rfq = held({ compared_at: "2026-10-11T00:00:00Z" });
    const r = await call();
    expect(r.status).toBe(200);
    expect(fx.updates[0]).toMatchObject({ status: "compared", compared_at: "2026-10-11T00:00:00Z" });
  });
});

describe("의뢰자 견적 화면은 비교표 공개 뒤에만", () => {
  const src = (p: string) => readFileSync(p, "utf8");
  it("비교표·견적 상세·선정 화면과 견적서 PDF 가 공개 여부를 확인한다", () => {
    for (const f of ["app/app/r/[no]/compare/page.tsx", "app/app/r/[no]/q/[quoteId]/page.tsx", "app/app/r/[no]/q/[quoteId]/select/page.tsx", "app/api/quotes/[id]/pdf/route.ts", "app/app/r/[no]/page.tsx"]) {
      expect(src(f), f).toContain("comparisonOpened(");
    }
  });
  it("기한 전 선정 확인 단계와 '수정될 수 있음' 표시가 남아 있지 않다", () => {
    for (const f of ["app/app/r/[no]/compare/page.tsx", "app/app/r/[no]/q/[quoteId]/page.tsx", "app/app/r/[no]/q/[quoteId]/select/page.tsx", "components/SelectCroForm.tsx", "components/CompareBoard.tsx"]) {
      const s = src(f);
      expect(s, f).not.toMatch(/selectionCaution|quoteRevisable|REVISABLE_LABEL|기한 전에도 선정/);
    }
  });
});
