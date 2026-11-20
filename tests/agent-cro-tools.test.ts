import { describe, expect, it } from "vitest";
import { catalogPatch, crmFind } from "@/lib/agent-cro-tools";
import type { CatalogRow } from "@/lib/catalog";

/*
 * 기관 비서 도구 D5 (2026-11-20)
 * - 시험 목록 고치기: 있는 행의 정해진 칸만, 바뀐 칸만 전·후로. 새 행·지우기·모르는 칸은 받지 않는다
 * - 고객관리 찾기: 이름으로, 금액·이메일·전화 없이
 */

// 계산 확인용 가상의 값 (어느 기관의 실제 단가도 아니다)
const row = (id: string, extra: Partial<CatalogRow> = {}) => ({ id, item: `시험 ${id}`, category: "일반독성", available: true, species: ["랫드"], routes: ["경구(PO)"], route: "경구(PO)", weeks: 12, std_price: 10_000_000, options: [], includes: [], ...extra }) as unknown as CatalogRow;

describe("시험 목록 고치기", () => {
  it("바뀐 칸만 전·후로 알리고, 반영할 행은 지금 행 + 고친 칸", () => {
    const r = catalogPatch([row("a"), row("b")], [{ id: "a", weeks: 14, available: true }, { id: "b", routes: ["정맥(IV)", "경구(PO)"] }]);
    expect(r.errors).toEqual([]);
    expect(r.diffs).toEqual([
      { id: "a", item: "시험 a", field: "weeks", before: 12, after: 14 },
      { id: "b", item: "시험 b", field: "routes", before: ["경구(PO)"], after: ["정맥(IV)", "경구(PO)"] },
    ]);
    expect(r.rows.map((x) => [x.id, x.weeks, x.route])).toEqual([["a", 14, "경구(PO)"], ["b", 12, "정맥(IV)"]]);
  });
  it("없는 행, 고칠 수 없는 칸, 틀린 값은 errors", () => {
    const r = catalogPatch([row("a")], [{ id: "new-1", weeks: 1 }, { id: "a", item_key: "x" }, { id: "a", per_sex: -3 }, { id: "a", std_price: 1.5 }]);
    expect(r.errors.map((e) => e.error)).toEqual(["not_found", "field_not_allowed", "bad_value", "bad_value"]);
    expect(r.rows).toEqual([]);
  });
  it("같은 값이면 바뀐 것이 없다", () => {
    expect(catalogPatch([row("a")], [{ id: "a", weeks: 12 }]).rows).toEqual([]);
  });
  it("배열이 아니면 bad_request", () => {
    expect(catalogPatch([row("a")], {}).errors).toEqual([{ id: "", error: "bad_request" }]);
  });
});

describe("고객관리 찾기", () => {
  const d = {
    companies: [{ id: "c1", name: "가람제약", aliases: ["GARAM"], industry: "제약", updated_at: "2026-11-01", memo: "비밀 메모" }],
    contacts: [{ id: "p1", company_id: "c1", name: "김담당", dept: "개발팀", title: "과장", email: "kim@garam.test", phone: "010-1111-2222", updated_at: "2026-11-02" }],
    deals: [{ id: "d1", company_id: "c1", title: "TST-101 반복투여", substance: "TST-101", rfq_no: "DC-2026-0004", stage: "견적", status: "진행", amount: 50_000_000, expected_on: "2026-12-01" }],
    tasks: [{ id: "t1", company_id: "c1", title: "견적 후속 연락", due_on: "2026-11-21", done_at: null }],
    events: [{ id: "e1", company_id: null, title: "킥오프 미팅", kind: "미팅", starts_at: "2026-11-25T01:00:00Z" }],
  } as never;
  it("회사 이름으로 찾으면 그 회사의 담당자·안건·할 일도 나온다", () => {
    expect(crmFind(d, "가람").map((h) => h.kind)).toEqual(["company", "contact", "deal", "task"]);
    expect(crmFind(d, "garam").map((h) => h.id)).toEqual(["c1"]);
  });
  it("종류로 좁히고, 금액·이메일·전화·메모는 없다", () => {
    const hits = crmFind(d, "", ["contact", "deal"]);
    expect(hits.map((h) => h.id)).toEqual(["p1", "d1"]);
    const s = JSON.stringify(crmFind(d, ""));
    for (const x of ["kim@garam.test", "010-1111-2222", "50000000", "비밀 메모"]) expect(s).not.toContain(x);
  });
});
