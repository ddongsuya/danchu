import type { ReactNode } from "react";
import { Cite } from "@/components/Cite";
import { availOf, differingRows, range, spanOf, topCategoryShare, unavailableEverywhere, widestItem, type ReportCol, type ReportRow } from "@/lib/compare-report";
import { notesFor } from "@/lib/test-notes";
import { md, won } from "@/lib/format";

/**
 * 비교 보고서 (2026-10-29 대표 지시: "우리의 견적서는 그런 견적서"). 표지 요약 → 비교견적표 → 금액·기간 분석 → 항목 분석 → 시험 설명과 근거.
 * 숫자는 기관이 낸 값만 쓰고, 단추는 순위나 적정가를 말하지 않는다.
 */
export function CompareReport({ no, substance, comparedAt, cols, rows, vat, board }: { no: string; substance: string; comparedAt: string | null; cols: ReportCol[]; rows: ReportRow[]; vat: string; board: ReactNode }) {
  const totals = range(cols.map((c) => c.total));
  const spans = range(cols.map(spanOf));
  const diff = differingRows(cols, rows);
  const nowhere = unavailableEverywhere(cols, rows);
  const widest = widestItem(cols, rows);
  const notes = notesFor(rows.map((r) => r.name));
  const many = cols.length > 1;
  const maxTotal = Math.max(...cols.map((c) => c.total), 1);
  const maxSpan = Math.max(...cols.map((c) => spanOf(c) ?? 0), 1);
  const bar = (label: string, v: number, max: number, text: string) => (
    <div className="rs-bar" key={label}>
      <span className="rs-bar__l">{label}</span>
      <span className="rs-bar__t" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0.02, v / max)})` }} /></span>
      <span className="rs-bar__v tnum">{text}</span>
    </div>
  );
  const sections = [
    { id: "r1", label: "비교견적표" },
    { id: "r2", label: "금액·기간 분석" },
    { id: "r3", label: "항목 분석" },
    ...(notes.length ? [{ id: "r4", label: "시험 설명과 근거" }] : []),
  ];

  return (
    <div className="rs-report">
      <section className="rs-scene rs-scene--cover" aria-labelledby="cover-title">
        <p className="rs-k"><span className="tnum">{no}</span> {substance} 비교 견적 보고서{comparedAt ? `, ${md(comparedAt)} 공개` : ""}</p>
        <h1 id="cover-title" className="rs-h1">
          {many ? <>기관 {cols.length}곳의 견적을<br /><span className="rs-mark">같은 항목</span>으로 맞춰 봤어요</> : <>기관 1곳의 견적을<br />항목별로 정리했어요</>}
        </h1>
        <p className="rs-lead">요청한 시험 {rows.length}개 기준이에요. {vat} 최종 조건은 각 기관의 정식 견적서로 확인하세요.</p>
        <dl className="rs-cover">
          <div><dt>참여 기관</dt><dd className="tnum">{cols.length}곳</dd></div>
          <div><dt>총액{many ? " 범위" : ""}</dt><dd className="tnum">{totals ? (totals.min === totals.max ? won(totals.min) : `${won(totals.min)} ~ ${won(totals.max)}`) : "미입력"}</dd></div>
          <div><dt>전체 기간{many ? " 범위" : ""}</dt><dd className="tnum">{spans ? (spans.min === spans.max ? `${spans.min}주` : `${spans.min} ~ ${spans.max}주`) : "미입력"}</dd></div>
          <div><dt>기관끼리 다르게 답한 항목</dt><dd className="tnum">{many ? `${diff.length}개` : "-"}</dd></div>
        </dl>
        <nav className="rs-toc" aria-label="보고서 차례">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>
      </section>

      <section className="rs-block" id="r1" aria-labelledby="r1-title">
        <p className="rs-bk">비교견적표</p>
        <h2 id="r1-title" className="rs-h2">항목마다 금액과 기간</h2>
        {board}
      </section>

      <section className="rs-block" id="r2" aria-labelledby="r2-title">
        <p className="rs-bk">금액·기간 분석</p>
        <h2 id="r2-title" className="rs-h2">
          {many && totals && spans ? `총액 차이 ${won(totals.max - totals.min)}, 기간 차이 ${spans.max - spans.min}주` : many && totals ? `총액 차이 ${won(totals.max - totals.min)}` : "견적 1건의 금액과 기간"}
        </h2>
        <div className="rs-an">
          <div>
            <h3>총액</h3>
            <p>{vat}</p>
            {cols.map((c) => bar(c.name, c.total, maxTotal, c.total ? won(c.total) : "미입력"))}
          </div>
          <div>
            <h3>전체 기간</h3>
            <p>기관이 낸 일정의 최종보고서까지, 없으면 가장 긴 항목 기간이에요.</p>
            {cols.map((c) => bar(c.name, spanOf(c) ?? 0, maxSpan, spanOf(c) ? `${spanOf(c)}주` : "미입력"))}
          </div>
          {widest && (
            <div>
              <h3>금액 차이가 가장 큰 항목</h3>
              <p>{widest.row.name}. 설계나 포함 범위가 다를 수 있으니 비교견적표의 설계 줄을 함께 보세요.</p>
              {widest.values.map((v) => bar(v.name, v.amount, Math.max(...widest.values.map((x) => x.amount)), `${won(v.amount)}${v.weeks ? ` · ${v.weeks}주` : ""}`))}
            </div>
          )}
          <div>
            <h3>금액이 가장 큰 분야</h3>
            <p>기관마다 항목 금액 합에서 차지하는 비중이에요.</p>
            {cols.map((c) => {
              const t = topCategoryShare(c, rows);
              return bar(c.name, t ? t.share : 0, 1, t ? `${t.category} ${Math.round(t.share * 100)}%` : "미입력");
            })}
          </div>
        </div>
      </section>

      <section className="rs-block" id="r3" aria-labelledby="r3-title">
        <p className="rs-bk">항목 분석</p>
        <h2 id="r3-title" className="rs-h2">
          {!many ? "항목마다 수행 여부" : diff.length ? `기관끼리 다르게 답한 항목 ${diff.length}개` : "모든 항목에 같은 답을 했어요"}
        </h2>
        {nowhere.length > 0 && <p className="rs-lead">모든 기관이 불가로 답한 항목: {nowhere.map((r) => r.name).join(", ")}. 따로 맡길 곳을 찾거나 기관과 범위를 다시 이야기해 보세요.</p>}
        <div className="rs-mx-wrap">
          <table className="rs-mx">
            <thead>
              <tr>
                <th scope="col">시험</th>
                {cols.map((c) => <th key={c.id} scope="col">{c.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = diff.find((x) => x.row.seq === r.seq);
                return (
                  <tr key={r.seq}>
                    <th scope="row">
                      {r.name}
                      {d && <span className="rs-mx__d">{d.avail ? "가능 여부가 달라요" : "기간이 달라요"}</span>}
                    </th>
                    {cols.map((c) => {
                      const a = availOf(c, r.seq);
                      const w = c.items.find((i) => i.seq === r.seq)?.weeks;
                      return (
                        <td key={c.id}>
                          <span className={`rs-pill rs-pill--${a === "가능" ? "ok" : a === "불가" ? "no" : "mid"}`}>{a}</span>
                          {a !== "불가" && w ? <span className="rs-mx__w tnum">{w}주</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {notes.length > 0 && (
        <section className="rs-block" id="r4" aria-labelledby="r4-title">
          <p className="rs-bk">시험 설명과 근거</p>
          <h2 id="r4-title" className="rs-h2">견적에 들어간 시험, 무엇을 보나요</h2>
          <p className="rs-lead">참고용 설명이에요. 실제 설계는 기관의 견적서와 시험계획서로 확인하세요.</p>
          <div className="rs-ex">
            {notes.map((n) => (
              <div key={n.key}>
                <h3>{n.title}</h3>
                <p>{n.what}</p>
                <span className="rs-ex__items">이 보고서의 항목: {n.items.join(", ")}</span>
                <Cite basis={n.basis} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
