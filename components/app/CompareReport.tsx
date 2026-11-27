import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Cite } from "@/components/Cite";
import { availOf, differingRows, topCategoryAll, unavailableEverywhere } from "@/lib/compare-report";
import { boardDiffCount, short, totalOf, weeksOf, type CompareCol, type CompareRowDef } from "@/lib/compare-board";
import { notesFor } from "@/lib/test-notes";
import { md } from "@/lib/format";
import { ReportTabs } from "./ReportTabs";
import { ReportPdfButton, SortLabel } from "./ReportHeadBits";

/**
 * 비교 보고서 (2026-11-27 시안 검토판 r-compare): 머리 줄(공개일 · 정렬 · VAT 별도, PDF 내려받기) 아래 탭 네 개.
 * 비교견적표 · 금액·기간 · 항목 분석 · 시험 설명. 숫자는 기관이 낸 값만 쓰고, 단추는 순위나 적정가를 말하지 않는다.
 * 총액·기간의 "최저~최고 범위"는 보여 주지 않는다 (시안 결정).
 */
export function CompareReport({ comparedAt, cols, rows, board, banner, detailHref }: {
  comparedAt: string | null; cols: CompareCol[]; rows: CompareRowDef[]; board: ReactNode;
  /** 선정 결과 배너 (선정한 요청) */
  banner?: ReactNode;
  /** 2차 상세 조건을 보낼 수 있을 때 머리 줄 행동 */
  detailHref?: string | null;
}) {
  const diff = differingRows(cols, rows);
  const nowhere = unavailableEverywhere(cols, rows);
  const notes = notesFor(rows.map((r) => r.name));
  const many = cols.length > 1;
  const top = topCategoryAll(cols, rows);
  const maxTotal = Math.max(...cols.map(totalOf), 1);
  const maxSpan = Math.max(...cols.map((c) => weeksOf(c) || 0), 1);
  const bar = (label: string, v: number, max: number, text: string) => (
    <div className="rs-bar" key={label}>
      <span className="rs-bar__l">{label}</span>
      <span className="rs-bar__t" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0.02, v / max)})` }} /></span>
      <span className="rs-bar__v tnum">{text}</span>
    </div>
  );

  const secMoney = (
    <section className="rs-block" aria-label="금액·기간">
      <dl className="cmp-stats">
        <div><dt>견적</dt><dd className="tnum">{cols.length}건</dd></div>
        <div><dt>공개</dt><dd className="tnum">{comparedAt ? md(comparedAt) : "-"}</dd></div>
        <div><dt>차이 항목</dt><dd className="tnum">{boardDiffCount(cols, rows)}개</dd></div>
        <div><dt>금액이 가장 큰 분야</dt><dd>{top ?? "미입력"}</dd></div>
      </dl>
      <div className="rs-an">
        <div>
          <h3>기관별 총액</h3>
          {cols.map((c) => bar(c.name, totalOf(c), maxTotal, totalOf(c) ? short(totalOf(c)) : "미입력"))}
        </div>
        <div>
          <h3>전체 일정</h3>
          {cols.map((c) => bar(c.name, weeksOf(c) || 0, maxSpan, weeksOf(c) ? `${weeksOf(c)}주` : "미입력"))}
        </div>
      </div>
    </section>
  );

  const allAvail = diff.length > 0 && diff.every((d) => d.avail);
  const secItems = (
    <section className="rs-block" aria-label="항목 분석">
      {many && (
        <p className="cmp-msg">
          {diff.length ? `차이 항목 ${diff.length}개 · ${diff.map((d) => d.row.name).join(", ")}${allAvail ? "에서 가능 여부가 달라요" : ""}` : "모든 항목에 같은 답을 했어요"}
        </p>
      )}
      {nowhere.length > 0 && <p className="cmp-msg">모든 기관이 불가로 답한 항목: {nowhere.map((r) => r.name).join(", ")}</p>}
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
  );

  const secNotes = notes.length > 0 ? (
    <section className="rs-block" aria-label="시험 설명">
      <p className="cmp-msg">참고용 설명이에요. 실제 설계는 기관의 견적서와 시험계획서로 확인하세요.</p>
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
  ) : null;

  return (
    <div className="rs-report rs-report--table">
      <header className="rp-head cmp-head">
        <div>
          <h1 className="rp-h1">비교 견적 보고서</h1>
          <p className="rp-meta tnum">
            {comparedAt ? `${md(comparedAt)} 공개 · ` : ""}<Suspense fallback="회신 도착 순"><SortLabel /></Suspense> · VAT 별도
          </p>
        </div>
        <div className="cmp-head__a noprint">
          {detailHref && <Link href={detailHref} className="b2 bsm">상세 조건 보내기</Link>}
          <ReportPdfButton />
        </div>
      </header>
      {banner}
      <ReportTabs
        tabs={[
          { id: "r1", label: "비교견적표", node: board },
          { id: "r2", label: "금액·기간", node: secMoney },
          { id: "r3", label: many && diff.length ? `항목 분석 ${diff.length}` : "항목 분석", node: secItems },
          ...(secNotes ? [{ id: "r4", label: "시험 설명", node: secNotes }] : []),
        ]}
      />
    </div>
  );
}
