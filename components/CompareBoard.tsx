"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { INCL_KEYS } from "@/lib/cro-data";
import { comma, md, payTerms, won } from "@/lib/format";
import { quoteKindLabel } from "@/lib/concierge";
import { DETAIL_STATUS_LABEL, type DetailReplyItem, type DetailStatus } from "@/lib/detail-quote";

export type CompareCol = {
  id: string;
  name: string;
  total: number;
  /** 0029 이전 견적: 항목 기간 중 가장 긴 값 */
  weeks: number;
  /** 0029: 모든 보고서(번역 포함)가 끝나는 주. 기관이 적은 기간·순서로 계산. 없으면 null */
  final?: number | null;
  /** 0029: 국문 최종보고서 주 */
  finalReport?: number | null;
  start: string | null;
  valid: string | null;
  pay: string | null;
  includes: string[];
  note: string | null;
  glpOk: boolean;
  glpMissing: string[];
  glp: string[];
  unavailable: string[];
  conditional: number;
  items: {
    seq: number;
    avail: string;
    amount: number | null;
    weeks: number | null;
    design?: string;
    note?: string;
    explain?: [string, string][];
  }[];
  hasPdf: boolean;
  selected: boolean;
  /** 카탈로그 기준 자동 제출된 예비 견적 */
  auto: boolean;
  /** 운영자가 기관 PDF 를 보고 옮겨 적은 견적 (기준 문서는 PDF 원본) */
  operator?: boolean;
  /** 2차 상세 견적 (0042). 상세 견적을 요청한 기관만 */
  detail?: { status: DetailStatus; total: number | null; weeks: number | null; note: string | null; items: DetailReplyItem[] } | null;
};
export type CompareRowDef = { seq: number; name: string; category: string };

type SortKey = "default" | "total" | "final" | "start";
const SORTS: [SortKey, string][] = [
  ["final", "최종보고서 빠른 순"],
  ["total", "금액 낮은 순"],
  ["start", "착수 빠른 순"],
  ["default", "기본 순서"],
];
type Tab = "sum" | "diff" | "test";

/** 표 칸에 쓰는 짧은 금액. 만 원 단위로 떨어지면 "2억 700만", 아니면 원 단위 그대로 */
const short = (n: number | null | undefined) => (n == null ? "미입력" : n % 10000 === 0 && n > 0 ? won(n).replace(/만 원$/, "만").trim() : comma(n));
/** 최종보고서 순 정렬 값: 일정이 있으면 최종 주, 예전 견적은 가장 긴 항목 기간, 둘 다 없으면 맨 뒤 */
const finalOf = (c: CompareCol) => c.final ?? (c.weeks || Infinity);
const second = (c: CompareCol) => (c.detail?.status === "submitted" ? c.detail : null);
/** 지금 기준 총액과 기간: 2차 견적이 왔으면 그 값 */
const totalOf = (c: CompareCol) => second(c)?.total ?? c.total;
const weeksOf = (c: CompareCol) => second(c)?.weeks ?? c.final ?? c.weeks;

type Cond = { label: string; val: (c: CompareCol) => string; sub?: (c: CompareCol) => string | null };
const CONDS: Cond[] = [
  { label: "수행 범위", val: (c) => (c.unavailable.length ? `일부 불가 ${c.unavailable.length}건` : "전체 수행"), sub: (c) => [c.unavailable.join(", "), c.conditional ? `조건부 ${c.conditional}건` : ""].filter(Boolean).join(", ") || null },
  { label: "견적 구분", val: (c) => quoteKindLabel({ auto: c.auto, entry_source: c.operator ? "operator" : "cro" }) },
  { label: "최종보고서 제출", val: (c) => (c.final != null ? `${c.finalReport ?? c.final}주차` : c.weeks ? `${c.weeks}주` : "미입력"), sub: (c) => (c.final != null && c.finalReport != null && c.final > c.finalReport ? `번역 포함 ${c.final}주차` : null) },
  { label: "별도 비용", val: (c) => c.note?.trim() || "기재 없음" },
  ...INCL_KEYS.map((k): Cond => ({ label: k, val: (c) => (c.includes.includes(k) ? "포함" : "미포함") })),
  { label: "GLP", val: (c) => c.glp.join(", ") || "등록 정보 없음", sub: (c) => (c.glpMissing.length ? `확인 필요 ${c.glpMissing.join(", ")}` : null) },
  { label: "결제 조건", val: (c) => payTerms(c.pay) || "기재 없음" },
  { label: "견적 유효기간", val: (c) => (c.valid ? md(c.valid) : "기관 확인") },
];

/** 시험별 금액 칸 */
function itemOf(c: CompareCol, seq: number): { main: string; sub: string } {
  const it = c.items.find((i) => i.seq === seq);
  if (!it) return { main: "회신 없음", sub: "" };
  const s2 = second(c)?.items.find((i) => i.seq === seq);
  if (it.avail === "불가" && !s2) return { main: "수행 불가", sub: "" };
  const amount = s2 ? s2.amount : it.amount;
  const weeks = s2?.weeks ?? it.weeks;
  const sub = [
    weeks ? `${weeks}주` : "",
    it.avail === "조건부 가능" ? "조건부" : "",
    s2 && s2.amount !== it.amount ? `1차 ${short(it.amount)}` : "",
    s2?.mode === "assumed" ? "기관 가정 조건" : "",
  ].filter(Boolean).join(", ");
  return { main: short(amount), sub };
}

/** 다른 곳과 값이 갈리는 칸. 두 곳 이상이 같은 값을 낸 줄에서만 표시한다 */
function oddOnes(vals: string[]): boolean[] {
  const count = new Map<string, number>();
  for (const v of vals) count.set(v, (count.get(v) ?? 0) + 1);
  const max = Math.max(...count.values());
  return vals.map((v) => max >= 2 && (count.get(v) ?? 0) < max);
}

export function CompareBoard({
  no,
  cols,
  rows,
  canSelect,
}: {
  no: string;
  cols: CompareCol[];
  rows: CompareRowDef[];
  canSelect: boolean;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("final");
  const [shown, setShown] = useState(cols.map((c) => c.id));
  const [tab, setTab] = useState<Tab>("sum");
  const [openSame, setOpenSame] = useState(false);
  const sorted = useMemo(
    () =>
      [...cols]
        .filter((c) => shown.includes(c.id))
        .sort((a, b) =>
          sortBy === "default"
            ? 0
            : sortBy === "total"
              ? (totalOf(a) || Infinity) - (totalOf(b) || Infinity)
              : sortBy === "final"
                ? finalOf(a) - finalOf(b) || (totalOf(a) || Infinity) - (totalOf(b) || Infinity)
                : (a.start || "9999").localeCompare(b.start || "9999"),
        ),
    [cols, shown, sortBy],
  );
  const conds = CONDS.map((r) => {
    const vals = sorted.map(r.val);
    return { label: r.label, vals, subs: sorted.map((c) => r.sub?.(c) ?? null), odd: oddOnes(vals), same: new Set(vals).size <= 1 };
  });
  const diff = conds.filter((r) => !r.same);
  const same = conds.filter((r) => r.same);
  const n = sorted.length;
  const quoteHref = (c: CompareCol) => `/app/r/${no}/q/${c.id}`;
  const tag = (c: CompareCol) => (second(c) ? <span className="cb-tag">2차</span> : null);
  const wasLine = (c: CompareCol) => {
    const s2 = second(c);
    if (s2?.total != null && s2.total !== c.total) return `1차 ${short(c.total)} ${s2.total > c.total ? "+" : "-"}${short(Math.abs(s2.total - c.total))}`;
    return c.detail && !s2 ? DETAIL_STATUS_LABEL[c.detail.status] : "";
  };
  const amount = (c: CompareCol) => (totalOf(c) ? short(totalOf(c)) : "미입력");
  const weeks = (c: CompareCol) => (weeksOf(c) ? `${weeksOf(c)}주` : "미입력");
  const start = (c: CompareCol) => (c.start ? md(c.start) : "기관 확인");
  const val = (v: string, odd: boolean) => (odd ? <mark className="cmp-gap cb-odd">{v}</mark> : v);
  const TABS: [Tab, string][] = [["sum", "요약"], ["diff", `차이 항목 ${diff.length}`], ["test", "시험별 금액"]];
  const mcols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  // 네 곳부터는 한 화면에 다 들어가지 않아 옆으로 민다
  const mwide = n > 3 ? { minWidth: n * 112 } : undefined;
  const mrow = (key: string, cap: string, cells: React.ReactNode[], cls = "") => (
    <div key={key} className={`cb-mr ${cls}`} style={mwide}>
      <p>{cap}</p>
      <div className="cb-mcols tnum" style={mcols}>{cells.map((x, i) => <div key={sorted[i].id}>{x}</div>)}</div>
    </div>
  );

  return (
    <div className="cb">
      {cols.length > 1 && (
        <div className="cb-ctl">
          {cols.length > 3 && (
            <div className="chips" role="group" aria-label="비교할 기관">
              {cols.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="chip"
                  aria-pressed={shown.includes(c.id)}
                  disabled={shown.length === 1 && shown.includes(c.id)}
                  onClick={() => setShown(shown.includes(c.id) ? shown.filter((id) => id !== c.id) : [...shown, c.id])}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <select className="sel cb-sort" aria-label="정렬" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            {SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      )}

      {/* 넓은 화면: 기관이 열인 표 한 장. 줄은 가로선 없이 번갈아 깔리는 바탕으로 나눈다 */}
      <div className="cb-wide tbl-wrap" tabIndex={0} role="region" aria-label="기관별 견적 비교표">
        <table className="cb-t" style={{ minWidth: 180 + n * 200 }}>
          <caption className="sr-only">기관별 견적 비교, VAT 별도</caption>
          <thead>
            <tr>
              <td />
              {sorted.map((c) => (
                <th scope="col" key={c.id}>
                  <span className="cb-name">{c.name}{tag(c)}{c.selected && <span className="pill pill--ok">선정</span>}</span>
                  <b className="cb-amt tnum">{amount(c)}</b>
                  <span className="cb-sub tnum">{wasLine(c)}</span>
                  <span className="cb-kv">기간 <b className="tnum">{weeks(c)}</b>착수 <b className="tnum">{start(c)}</b></span>
                  <Link href={quoteHref(c)} className="cb-pick">{canSelect ? "견적서 확인, 선정" : "견적서 보기"}</Link>
                  {c.hasPdf && <a href={`/api/quotes/${c.id}/pdf`} className="cb-pdf">PDF 원본</a>}
                </th>
              ))}
            </tr>
          </thead>
          {diff.length > 0 && (
            <tbody>
              <tr className="cb-g"><th colSpan={n + 1} scope="colgroup">차이 항목<span className="tnum">{diff.length}</span></th></tr>
              {diff.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.vals.map((v, i) => <td key={sorted[i].id}>{val(v, r.odd[i])}{r.subs[i] && <span className="cb-sub">{r.subs[i]}</span>}</td>)}
                </tr>
              ))}
            </tbody>
          )}
          {same.length > 0 && (
            <tbody>
              <tr className="cb-g">
                <th colSpan={n + 1} scope="colgroup">
                  <button type="button" aria-expanded={openSame} onClick={() => setOpenSame((o) => !o)}>
                    공통 항목<span className="tnum">{same.length}</span><i>{openSame ? "접기" : "펼치기"}</i>
                  </button>
                </th>
              </tr>
              {openSame && same.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td colSpan={n}>{r.vals[0]}</td>
                </tr>
              ))}
            </tbody>
          )}
          <tbody>
            <tr className="cb-g"><th colSpan={n + 1} scope="colgroup">시험별 금액<span className="tnum">{rows.length}</span></th></tr>
            {rows.map((r) => (
              <tr key={r.seq}>
                <th scope="row">{r.name}</th>
                {sorted.map((c) => { const x = itemOf(c, r.seq); return <td key={c.id} className="tnum">{x.main}{x.sub && <span className="cb-sub">{x.sub}</span>}</td>; })}
              </tr>
            ))}
            <tr className="cb-total">
              <th scope="row">합계</th>
              {sorted.map((c) => <td key={c.id} className="tnum">{amount(c)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 좁은 화면: 같은 표를 요약, 차이 항목, 시험별 금액 세 화면으로 나눈다 */}
      <div className="cb-m">
        <div className="crm-seg" role="tablist" aria-label="비교표 보기">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" id={`cb-tab-${k}`} aria-selected={tab === k} aria-controls="cb-panel" onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="cb-mscroll" role="tabpanel" id="cb-panel" aria-labelledby={`cb-tab-${tab}`}>
          <div className="cb-mcols cb-mhead" style={{ ...mcols, ...mwide }}>
            {sorted.map((c) => (
              <Link key={c.id} href={quoteHref(c)}>
                <b>{c.name}{tag(c)}</b>
                <span>{canSelect ? "견적서, 선정" : "견적서"}</span>
              </Link>
            ))}
          </div>
          {tab === "sum" && (
            <>
              {mrow("total", "견적 총액", sorted.map((c) => <>{amount(c)}{wasLine(c) && <span className="cb-sub">{second(c) ? `1차 ${short(c.total)}` : wasLine(c)}</span>}</>), "cb-mr--big")}
              {mrow("weeks", "소요 기간", sorted.map(weeks))}
              {mrow("start", "착수 가능일", sorted.map(start))}
              {same.length > 0 && (
                <div className="cb-same">
                  <button type="button" aria-expanded={openSame} onClick={() => setOpenSame((o) => !o)}>
                    공통 항목<span className="tnum">{same.length}</span><i>{openSame ? "접기" : "펼치기"}</i>
                  </button>
                  {openSame && <dl>{same.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.vals[0]}</dd></div>)}</dl>}
                </div>
              )}
            </>
          )}
          {tab === "diff" && (diff.length ? diff.map((r) => mrow(r.label, r.label, r.vals.map((v, i) => <>{val(v, r.odd[i])}{r.subs[i] && <span className="cb-sub">{r.subs[i]}</span>}</>))) : <p className="cb-none">차이 항목 없음</p>)}
          {tab === "test" && (
            <>
              {rows.map((r) => mrow(String(r.seq), r.name, sorted.map((c) => { const x = itemOf(c, r.seq); return <>{x.main}{x.sub && <span className="cb-sub">{x.sub}</span>}</>; })))}
              {mrow("sum", "합계", sorted.map(amount), "cb-mr--total")}
            </>
          )}
        </div>
      </div>

      {/* 단추가 옮겨 적은 견적이 있을 때만: 약관 제8조와 같은 말 (tests/compare-rules.test.ts) */}
      {sorted.some((c) => c.operator && !c.auto) && (
        <p className="fld__help">기관이 보낸 견적서 PDF를 단추가 같은 양식으로 옮겨 정리했어요. 금액·조건이 다르면 PDF 원본이 우선하며, 옮겨 적은 내용의 오류는 비교표가 열리기 전에는 단추가 바로잡고, 열린 뒤에는 비교표를 고치지 않고 알려요.</p>
      )}
      <Link href={`/app/support?rfq=${no}`} className="cb-ask">견적 내용 문의</Link>
    </div>
  );
}
