import { describe, expect, it } from "vitest";
import { searchThreads } from "@/lib/req-search";

const T = [
  { no: "DC-2027-0021", substance: "EB-2071", title: "hERG(in vitro)", done: false },
  { no: "DC-2027-0012", substance: "EB-2071", title: "반복투여 4주 (랫드)", done: false },
  { no: "DC-2027-0003", substance: "KR-11", title: "", done: true },
];

describe("요청 검색 창 (시안 r-search)", () => {
  it("빈 검색어는 모두를 진행 중 · 끝남으로 나눈다", () => {
    const r = searchThreads(T, "");
    expect(r.open.map((t) => t.no)).toEqual(["DC-2027-0021", "DC-2027-0012"]);
    expect(r.done.map((t) => t.no)).toEqual(["DC-2027-0003"]);
  });
  it("번호 · 시험물질 · 시험 이름에서 대소문자와 띄어쓰기를 무시하고 찾는다", () => {
    expect(searchThreads(T, "eb-2071").open).toHaveLength(2);
    expect(searchThreads(T, "반복투여4주").open.map((t) => t.no)).toEqual(["DC-2027-0012"]);
    expect(searchThreads(T, "0003").done.map((t) => t.no)).toEqual(["DC-2027-0003"]);
  });
  it("맞는 것이 없으면 둘 다 비어 있다", () => {
    expect(searchThreads(T, "KR-0932")).toEqual({ open: [], done: [] });
  });
});
