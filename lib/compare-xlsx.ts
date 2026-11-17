/**
 * 비교표 → 엑셀 시트 (비교견적표 · 시험별 상세). 의뢰자가 비교 보고서에서 내려받는다.
 * 화면과 같은 값만 넣는다 (lib/compare-data.ts). 단추의 평가나 순위는 넣지 않는다.
 */
import type { CompareCol } from "@/components/CompareBoard";
import type { Cell, Sheet } from "./xlsx";

const b = (v: string | number): Cell => ({ v, bold: true });
type Row = { seq: number; name: string; category: string };

export function compareSheets(a: { no: string; substance: string; comparedAt: string | null; authorities: string[]; cols: CompareCol[]; rows: Row[] }): Sheet[] {
  const { cols, rows } = a;
  const per = (f: (c: CompareCol) => Cell): Cell[] => cols.map(f);
  const weeksOf = (c: CompareCol) => c.final ?? c.weeks;

  const s1: Cell[][] = [
    [{ v: "비교 견적표", big: true }],
    ["요청 번호", a.no],
    ["시험물질", a.substance],
    ...(a.comparedAt ? [["공개일", a.comparedAt.slice(0, 10)] as Cell[]] : []),
    ...(a.authorities.length ? [["제출처", a.authorities.join(", ")] as Cell[]] : []),
    ["금액 단위 원, 부가세 별도. 최종 조건은 각 기관의 정식 견적서로 확인하세요."],
    [],
    [b("항목"), ...per((c) => b(c.name))],
    [b("견적 총액"), ...per((c) => ({ v: c.total, bold: true }))],
    ["소요 기간(주)", ...per((c) => weeksOf(c) || "")],
    ["착수 가능일", ...per((c) => c.start ?? "")],
    ["견적 유효기간", ...per((c) => c.valid ?? "")],
    ["결제 조건", ...per((c) => c.pay ?? "")],
    ["포함 사항", ...per((c) => c.includes.join(", "))],
    ["GLP 인증", ...per((c) => c.glp.join(", "))],
    ["선정", ...per((c) => (c.selected ? "선정" : ""))],
    [],
    [b("시험별 금액")],
    ...rows.map((r): Cell[] => [r.name, ...per((c) => { const it = c.items.find((i) => i.seq === r.seq); return it ? (it.avail === "불가" ? "불가" : it.amount ?? "") : ""; })]),
    [],
    [b("시험별 기간(주)")],
    ...rows.map((r): Cell[] => [r.name, ...per((c) => { const it = c.items.find((i) => i.seq === r.seq); return it && it.avail !== "불가" ? it.weeks ?? "" : ""; })]),
  ];

  const s2: Cell[][] = [[b("시험"), b("분야"), b("기관"), b("수행 가능"), b("금액"), b("기간(주)"), b("시험 설계"), b("기관 설명")]];
  for (const r of rows) for (const c of cols) {
    const it = c.items.find((i) => i.seq === r.seq);
    if (!it) { s2.push([r.name, r.category, c.name, "회신 없음", "", "", "", ""]); continue; }
    s2.push([r.name, r.category, c.name, it.avail, it.amount ?? "", it.weeks ?? "", it.design ?? "", [it.note, ...(it.explain ?? []).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(" / ")]);
  }

  return [
    { name: "비교견적표", rows: s1, widths: [22, ...cols.map(() => 24)] },
    { name: "시험별 상세", rows: s2, widths: [28, 16, 20, 12, 14, 10, 40, 50] },
  ];
}
