"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { md } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { DETAIL_STATUS_LABEL } from "@/lib/detail-quote";
import {
  SORTS, condRows, itemOf, readBoardUrl, second, short, sortCols, testDiffers, testIncludes, totalOf, weeksOf, writeBoardUrl,
  type BoardUrl, type CompareCol, type CompareRowDef, type SortKey,
} from "@/lib/compare-board";
import { QuotePanel, QuotePdf } from "@/components/app/QuotePanel";
import "@/components/app/compare.css";

export type { CompareCol, CompareRowDef } from "@/lib/compare-board";

const START: BoardUrl = { sort: "default", view: "all", quote: null, doc: false };

/** 열 머리 둘째 줄: "6월 28일 회신 · 2차 7월 8일" */
function arrivedLine(c: CompareCol): string {
  const first = c.arrivedAt ? `${md(c.arrivedAt)} 회신` : "회신";
  if (!c.detail) return first;
  if (c.detail.status === "submitted") return `${first} · 2차${c.detail.at ? ` ${md(c.detail.at)}` : ""}`;
  return `${first} · ${DETAIL_STATUS_LABEL[c.detail.status]}`;
}

/**
 * 비교견적표 (2026-11-27 시안 검토판 r-compare). 도구 줄(전체·차이 항목, 정렬, 링크 복사) → 기관이 열인 표.
 * 열 머리 "상세"는 표 옆 분할 패널(휴대폰은 바닥 시트)로 열고, 정렬·보기·열린 기관은 주소(?sort=&view=#q-)에 둔다.
 * 다수와 다른 값은 형광펜 대신 밑줄, 줄 이름 옆에 ≠. 휴대폰은 항목 이름 열을 고정하고 기관 열을 가로로 넘긴다.
 */
export function CompareBoard({ no, cols, rows, canSelect }: { no: string; cols: CompareCol[]; rows: CompareRowDef[]; canSelect: boolean }) {
  const toast = useToast();
  const [u, setU] = useState<BoardUrl>(START);
  const [openSame, setOpenSame] = useState(false);
  const opener = useRef<string | null>(null);

  useEffect(() => {
    const read = () => setU(readBoardUrl(window.location.search, window.location.hash));
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => { window.removeEventListener("popstate", read); window.removeEventListener("hashchange", read); };
  }, []);

  const go = useCallback((next: BoardUrl, push = false) => {
    setU(next);
    const url = window.location.pathname + writeBoardUrl(window.location.search, next);
    if (push) window.history.pushState(null, "", url); else window.history.replaceState(null, "", url);
  }, []);

  const sorted = useMemo(() => sortCols(cols, u.sort), [cols, u.sort]);
  const conds = useMemo(() => condRows(sorted), [sorted]);
  const diff = conds.filter((r) => !r.same);
  const same = conds.filter((r) => r.same);
  const many = sorted.length > 1;
  const diffTests = rows.filter((r) => testDiffers(sorted, r.seq));
  const diffCount = many ? diff.length + diffTests.length : 0;
  const shownTests = u.view === "diff" ? diffTests : rows;
  const cur = u.quote ? sorted.find((c) => c.id === u.quote) ?? null : null;
  const n = sorted.length;

  const open = (id: string) => { opener.current = id; go({ ...u, quote: id, doc: false }, !u.quote); };
  const close = () => {
    go({ ...u, quote: null, doc: false });
    // 패널을 연 "상세" 단추로 포커스를 돌려준다
    const id = opener.current ?? u.quote;
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-open-quote="${id}"]`)?.focus());
  };
  const step = (d: number) => {
    if (!cur) return;
    const i = sorted.findIndex((c) => c.id === cur.id);
    go({ ...u, quote: sorted[(i + d + n) % n].id, doc: false });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("링크를 복사했어요");
    } catch {
      toast("링크를 복사하지 못했어요. 주소창에서 복사해 주세요", { tone: "error" });
    }
  };

  const mark = (v: string, odd: boolean) => (odd ? <span className="cmp-dif">{v}</span> : v);
  const neq = <span className="cmp-neq" aria-label="차이">≠</span>;
  const cell = (c: CompareCol, node: React.ReactNode, cls = "") => <td key={c.id} className={`${c.id === cur?.id ? "is-cur" : ""} ${cls}`.trim() || undefined}>{node}</td>;

  const table = (
    <div className="cmp-wrap" tabIndex={0} role="region" aria-label="기관별 견적 비교표">
      <table className="cmp-t" style={{ minWidth: 140 + n * 180 }}>
        <caption className="sr-only">기관별 견적 비교, 단위 원, VAT 별도</caption>
        <thead>
          <tr>
            <th scope="col" className="cmp-t__lab">항목</th>
            {sorted.map((c) => (
              <th scope="col" key={c.id} className={c.id === cur?.id ? "is-cur" : undefined}>
                <span className="cmp-name">{c.name}{second(c) && <span className="cb-tag">2차</span>}{c.selected && <span className="pill pill--ok">선정</span>}</span>
                <b className="cmp-amt tnum">{totalOf(c) ? short(totalOf(c)) : "미입력"}</b>
                <small className="tnum">{arrivedLine(c)}</small>
                <small>{c.hasPdf ? "견적서 PDF" : "견적서 PDF 없음"}</small>
                <button type="button" className="cmp-open" data-open-quote={c.id} aria-expanded={c.id === cur?.id} onClick={() => (c.id === cur?.id ? close() : open(c.id))}>상세</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diff.length > 0 && (
            <tr className="cmp-g"><th scope="colgroup" colSpan={n + 1}>조건<em className="tnum">{u.view === "diff" ? `차이 ${diff.length}` : `${diff.length}개`}</em></th></tr>
          )}
          {diff.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}{r.odd.some(Boolean) && neq}</th>
              {r.vals.map((v, i) => cell(sorted[i], <>{mark(v, r.odd[i])}{r.subs[i] && <span className="cb-sub">{r.subs[i]}</span>}</>))}
            </tr>
          ))}
          <tr className="cmp-g"><th scope="colgroup" colSpan={n + 1}>시험별 금액 (원)<em className="tnum">{u.view === "diff" ? `차이 ${diffTests.length}` : `${rows.length}개`}</em></th></tr>
          {shownTests.map((r) => {
            const inc = testIncludes(sorted, r.seq);
            const cells = sorted.map((c) => itemOf(c, r.seq));
            const odd = testDiffers(sorted, r.seq);
            return (
              <Fragment key={r.seq}>
                <tr>
                  <th scope="row">{r.name}{odd && neq}</th>
                  {cells.map((x, i) => cell(sorted[i], <>{mark(x.main, odd && !x.num)}{x.sub && <span className="cb-sub">{x.sub}</span>}</>, "tnum"))}
                </tr>
                {(inc?.diff ?? []).map((d) => (
                  <tr key={`${r.seq}-${d.key}`} className="cmp-inc">
                    <th scope="row">{d.key}{d.odd.some(Boolean) && neq}</th>
                    {d.vals.map((v, i) => cell(sorted[i], mark(v, d.odd[i])))}
                  </tr>
                ))}
                {u.view === "all" && inc && inc.common.length > 0 && (
                  <tr className="cmp-inc"><th scope="row">공통 포함 {inc.common.length}</th><td colSpan={n}>{inc.common.join(", ")}</td></tr>
                )}
              </Fragment>
            );
          })}
          <tr className="cmp-tot">
            <th scope="row">견적 총액 (VAT 별도)</th>
            {sorted.map((c) => cell(c, totalOf(c) ? short(totalOf(c)) : "미입력", "tnum"))}
          </tr>
          <tr>
            <th scope="row">소요 기간</th>
            {sorted.map((c) => cell(c, weeksOf(c) ? `${weeksOf(c)}주` : "미입력", "tnum"))}
          </tr>
          {u.view === "all" && same.length > 0 && (
            <>
              <tr className="cmp-more">
                <th scope="row" colSpan={n + 1}>
                  <button type="button" aria-expanded={openSame} onClick={() => setOpenSame((o) => !o)}>공통 항목 {same.length} · {openSame ? "접기" : "펼치기"}</button>
                </th>
              </tr>
              {openSame && same.map((r) => (
                <tr key={r.label}><th scope="row">{r.label}</th><td colSpan={n}>{r.vals[0]}</td></tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="cmp">
      <div className="cmp-tools">
        {many && (
          <div className="cmp-seg" role="group" aria-label="보기">
            <button type="button" aria-pressed={u.view === "all"} onClick={() => go({ ...u, view: "all" })}>전체</button>
            <button type="button" aria-pressed={u.view === "diff"} onClick={() => go({ ...u, view: "diff" })}>차이 항목 <span className="tnum">{diffCount}</span></button>
          </div>
        )}
        {many && (
          <select className="sel cmp-sort" aria-label="정렬" value={u.sort} onChange={(e) => go({ ...u, sort: e.target.value as SortKey })}>
            {SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        )}
        <span className="cmp-tools__sp" />
        <button type="button" className="b2 bsm" onClick={copy}>링크 복사</button>
      </div>

      <div className={cur ? "cmp-split" : undefined}>
        <div className="cmp-split__main">
          {cur && u.doc ? <QuotePdf col={cur} onBack={() => go({ ...u, doc: false })} /> : table}
        </div>
        {cur && (
          <QuotePanel
            key={cur.id}
            no={no}
            col={cur}
            rows={rows}
            canSelect={canSelect}
            onClose={close}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onDoc={() => go({ ...u, doc: true })}
          />
        )}
      </div>

      {/* 단추가 옮겨 적은 견적이 있을 때만: 약관 제8조와 같은 말 (tests/compare-rules.test.ts) */}
      {sorted.some((c) => c.operator && !c.auto) && (
        <p className="fld__help">기관이 보낸 견적서 PDF를 단추가 같은 양식으로 옮겨 정리했어요. 금액·조건이 다르면 PDF 원본이 우선하며, 옮겨 적은 내용의 오류는 비교표가 열리기 전에는 단추가 바로잡고, 열린 뒤에는 비교표를 고치지 않고 알려요.</p>
      )}
      <Link href={`/app/r/${no}/qna`} className="cb-ask">질의응답</Link>
    </div>
  );
}
