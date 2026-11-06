/**
 * 견적서 → 엑셀 시트 3장 (견적서 · 시험 상세 · 일정표). PDF 와 같은 계산(lib/quote-doc)과 같은 "의뢰자에게 보이는 항목"을 따른다.
 * 내부 메모는 넣지 않는다.
 */
import { docTotals, mainAnimals, recoveryAnimals, scheduleWeeks, testLines, type DocData, type DocHead, type QuoteStyle } from "./quote-doc";
import type { Cell, Sheet } from "./xlsx";

const b = (v: string | number): Cell => ({ v, bold: true });
const PHASE: Record<string, string> = { run: "투여와 수행", recovery: "회복", report: "준비와 보고", point: "시점" };

export function docSheets(head: DocHead, data: DocData, style: QuoteStyle): Sheet[] {
  const t = docTotals(data);
  const v = data.visible;
  const weeks = scheduleWeeks(data);

  const q: Cell[][] = [
    [{ v: "견적서", big: true }],
    ["견적번호", head.docNo],
    ["작성일", head.issuedOn],
    ["의뢰자", head.client],
    ...(head.substance ? [["시험물질", head.substance] as Cell[]] : []),
    ...(head.validUntil ? [["견적 유효기간", `${head.validUntil}까지`] as Cell[]] : []),
    ["공급자", [style.supplier.name, style.supplier.address, style.supplier.contact].filter(Boolean).join(" · ")],
    [],
    ["아래와 같이 견적합니다. 금액 단위 원, 부가세 별도."],
    [b("No"), b("시험"), b("조건"), b("기간(주)"), ...(v.perTest ? [b("금액")] : [])],
  ];
  data.tests.forEach((x, i) => {
    const c = testLines(x);
    const cond = [x.cond.species, x.cond.route, x.cond.glp].filter(Boolean).join(" · ");
    const animals = x.groups.length ? `${x.groups.length}군, ${mainAnimals(x.groups) + recoveryAnimals(x.groups)}마리` : "";
    q.push([i + 1, b(x.title), [cond, animals].filter(Boolean).join(" / "), x.weeks ?? "", ...(v.perTest ? [{ v: c.total, bold: true } as Cell] : [])]);
    if (v.perTest && v.adjust && c.lines.length) {
      q.push(["", `  표준가${x.std.summary ? ` (${x.std.summary})` : ""}`, "", "", c.base]);
      for (const l of c.lines) q.push(["", `  ${l.label}`, v.formula && l.kind !== "extra" ? l.formula : "", "", l.amount]);
    }
  });
  q.push([]);
  if (t.discount > 0) { q.push(["", "", "", "시험 금액 합계", t.sum]); q.push(["", "", "", "할인", -t.discount]); }
  q.push(["", "", "", "공급가액", t.supply]);
  q.push(["", "", "", "부가세 (10%)", t.vat]);
  q.push(["", "", "", b("합계금액"), { v: t.grand, big: true }]);
  q.push([]);
  q.push([b("거래 조건")]);
  if (head.validUntil) q.push(["견적 유효기간", `${head.validUntil}까지`]);
  if (weeks) q.push(["수행 기간", `착수부터 최종 보고서까지 ${weeks}주`]);
  if (data.terms.pay) q.push(["결제 조건", data.terms.pay]);
  if (data.terms.extra) q.push(["별도 비용", data.terms.extra]);
  if (data.terms.note) q.push(["비고", data.terms.note]);

  const d: Cell[][] = [];
  data.tests.forEach((x, i) => {
    if (i) d.push([], []);
    d.push([b(`시험 ${i + 1}. ${x.title}`)]);
    if (x.subtitle) d.push([x.subtitle]);
    const conds: [string, string][] = [["실험동물", x.cond.species], ["투여경로", x.cond.route], ["투여기간", x.cond.dosing], ["회복기간", x.cond.recovery], ["시험 기준", x.cond.glp], ["참고 가이드라인", x.cond.guideline]];
    for (const [k, val] of conds) if (val) d.push([k, val]);
    if (x.groups.length) {
      d.push([], [b("군"), b("용량"), b("본시험 수컷"), b("본시험 암컷"), b("회복 수컷"), b("회복 암컷"), b("합계")]);
      for (const g of x.groups) d.push([g.label, g.dose, g.m, g.f, g.rm, g.rf, g.m + g.f + g.rm + g.rf]);
      d.push([b("합계"), "", x.groups.reduce((a, g) => a + g.m, 0), x.groups.reduce((a, g) => a + g.f, 0), x.groups.reduce((a, g) => a + g.rm, 0), x.groups.reduce((a, g) => a + g.rf, 0), { v: mainAnimals(x.groups) + recoveryAnimals(x.groups), bold: true }]);
    }
    const ev = x.evals.filter((e) => e.on).map((e) => e.name);
    if (ev.length) d.push([], ["평가항목", ev.join(", ")]);
    if (x.description) d.push([], ["시험 설명", x.description]);
  });

  const W = Math.max(1, weeks);
  const s: Cell[][] = [[b("시험"), b("단계"), b("종류"), b("시작 주"), b("기간(주)"), ...Array.from({ length: W }, (_, k) => b(k + 1))]];
  for (const x of data.tests) {
    x.phases.forEach((p, k) => {
      const from = x.startWeek + p.start;
      const len = p.kind === "point" ? 1 : p.weeks;
      s.push([k === 0 ? x.title : "", p.name, PHASE[p.kind] ?? "", from + 1, p.kind === "point" ? "" : p.weeks, ...Array.from({ length: W }, (_, w) => (w >= from && w < from + len ? (p.kind === "point" ? "◆" : "■") : ""))]);
    });
  }
  s.push([], [`착수부터 최종 보고서까지 ${weeks}주. 시험물질 입고 주를 1주로 셉니다.`]);

  return [
    { name: "견적서", rows: q, widths: [14, 44, 34, 12, 16] },
    { name: "시험 상세", rows: d, widths: [18, 30, 12, 12, 12, 12, 10] },
    { name: "일정표", rows: s, widths: [26, 22, 16, 9, 9, ...Array.from({ length: W }, () => 3.5)] },
  ];
}
