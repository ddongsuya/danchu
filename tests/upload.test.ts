import { describe, expect, it } from "vitest";
import { storageHas } from "@/lib/upload";

/** Supabase Storage list() 흉내: 폴더별 객체 이름 목록 */
function fakeStorage(objects: Record<string, string[]>) {
  const calls: { dir: string; search: string }[] = [];
  const sb = {
    storage: {
      from: () => ({
        list: async (dir: string, o: { search: string; limit: number }) => {
          calls.push({ dir, search: o.search });
          return { data: (objects[dir] ?? []).filter((n) => n.includes(o.search)).map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  return { sb, calls };
}

describe("storageHas — 서명 업로드가 실제로 끝났는지", () => {
  it("폴더와 파일명으로 나눠 조회하고 정확히 같은 이름만 인정한다", async () => {
    const { sb, calls } = fakeStorage({ "DC-2026-0001": ["1700000000-report.pdf", "1700000000-report.pdf.tmp"] });
    expect(await storageHas(sb, "rfq-files", "DC-2026-0001/1700000000-report.pdf")).toBe(true);
    expect(calls[0]).toEqual({ dir: "DC-2026-0001", search: "1700000000-report.pdf" });
    expect(await storageHas(sb, "rfq-files", "DC-2026-0001/missing.pdf")).toBe(false);
  });
  it("오류나 빈 목록은 false", async () => {
    const sb = { storage: { from: () => ({ list: async () => ({ data: null, error: new Error("boom") }) }) } };
    expect(await storageHas(sb, "rfq-files", "a/b.pdf")).toBe(false);
  });
});
