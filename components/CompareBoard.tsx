"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { INCL_KEYS } from "@/lib/cro-data";
import { comma, dday, md, won } from "@/lib/format";
import { quoteKindLabel } from "@/lib/concierge";

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
};
export type CompareRowDef = { seq: number; name: string; category: string };

type SortKey = "default" | "total" | "final" | "start";
const SORTS: [SortKey, string][] = [
  ["final", "최종보고서 빠른 순"],
  ["total", "금액 낮은 순"],
  ["start", "착수 빠른 순"],
  ["default", "기본 순서"],
];
/** 최종보고서 순 정렬 값: 일정이 있으면 최종 주, 예전 견적은 가장 긴 항목 기간, 둘 다 없으면 맨 뒤 */
const finalOf = (c: CompareCol) => c.final ?? (c.weeks || Infinity);

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
  // 차이 표시(노랑)는 일정이 있는 견적끼리만 비교한다
  const finals = cols.map((c) => c.final).filter((x): x is number => typeof x === "number");
  const best = finals.length > 1 ? Math.min(...finals) : null;
  const axis = finals.length ? Math.max(...finals) : 0;
  const [shown, setShown] = useState(cols.map((c) => c.id));
  const sorted = useMemo(
    () =>
      [...cols]
        .filter((c) => shown.includes(c.id))
        .sort((a, b) =>
          sortBy === "default"
            ? 0
            : sortBy === "total"
              ? (a.total || Infinity) - (b.total || Infinity)
              : sortBy === "final"
                ? finalOf(a) - finalOf(b) || (a.total || Infinity) - (b.total || Infinity)
                : (a.start || "9999").localeCompare(b.start || "9999"),
        ),
    [cols, shown, sortBy],
  );
  const summary: { label: string; cell: (c: CompareCol) => React.ReactNode }[] =
    [
      {
        label: "수행 범위",
        cell: (c) => (
          <span>
            {c.unavailable.length
              ? `일부 불가: ${c.unavailable.join(", ")}`
              : "전체 수행 가능"}
            {c.conditional ? ` · 조건부 ${c.conditional}건` : ""}
          </span>
        ),
      },
      {
        label: "견적 구분",
        cell: (c) => (
          <>
            {quoteKindLabel({ auto: c.auto, entry_source: c.operator ? "operator" : "cro" })}
            {c.operator && !c.auto && (
              <p className="fld__help">기관이 보낸 견적서 PDF를 단추가 같은 양식으로 옮겨 정리했습니다. 금액·조건이 다르면 PDF 원본이 우선하며, 옮겨 적은 내용의 오류는 비교표가 열리기 전에는 단추가 바로잡고, 열린 뒤에는 비교표를 고치지 않고 알려 드립니다.</p>
            )}
          </>
        ),
      },
      {
        label: "회신 금액 합계",
        cell: (c) => (
          <>
            <b className="tnum">{c.total ? won(c.total) : "미입력"}</b>
            <p className="fld__help">
              {c.unavailable.length ? "수행 가능 항목만 합산" : "VAT 별도"}
            </p>
          </>
        ),
      },
      {
        label: "최종보고서",
        cell: (c) =>
          c.final != null ? (
            <>
              <b className="tnum">국문 {c.finalReport ?? c.final}주차</b>
              {c.finalReport != null && c.final > c.finalReport && <span className="tnum"> · 번역 포함 {c.final}주차</span>}
              {best != null && c.final > best && <> <mark className="cmp-gap">+{c.final - best}주</mark></>}
              <span className="cmp-mini" aria-hidden="true">
                <i style={{ width: `${((Math.min(c.final, best ?? c.final) / axis) * 100).toFixed(2)}%` }} />
                {best != null && c.final > best && <b style={{ left: `${((best / axis) * 100).toFixed(2)}%`, width: `${(((c.final - best) / axis) * 100).toFixed(2)}%` }} />}
              </span>
              <p className="fld__help">착수 주부터 센 주차 · 기관이 적은 기간과 순서 기준</p>
              <Link href={`/app/r/${no}/q/${c.id}#schedule`} style={{ display: "inline-block", marginTop: 6, fontSize: 13, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 4 }}>전체 일정 보기</Link>
            </>
          ) : c.weeks ? (
            <>
              {c.weeks}주
              <p className="fld__help">항목 기간 중 가장 긴 값. 순서와 보고서 기간은 기관에 확인하세요.</p>
            </>
          ) : (
            "미입력"
          ),
      },
      {
        label: "제외·별도 비용",
        cell: (c) => (
          <span style={{ whiteSpace: "pre-wrap" }}>
            {c.note || "기관 기재 없음"}
          </span>
        ),
      },
      {
        label: "기본 포함",
        cell: (c) => (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {INCL_KEYS.map((k) => (
              <li key={k}>
                {k}:{" "}
                {c.includes.includes(k) ? (
                  "포함"
                ) : cols.some((o) => o.includes.includes(k)) ? (
                  // 다른 기관은 포함한 항목만 형광펜으로 (기관 사이 차이)
                  <mark className="cmp-gap">미포함·확인 필요</mark>
                ) : (
                  "미포함·확인 필요"
                )}
              </li>
            ))}
          </ul>
        ),
      },
      {
        label: "착수 가능일",
        cell: (c) => (c.start ? md(c.start) : "기관 확인 필요"),
      },
      {
        label: "등록된 GLP 정보",
        cell: (c) => (
          <>
            {c.glp.join(" · ") || "등록 정보 없음"}
            <p className="fld__help">
              {c.glpOk
                ? "선택한 제출처에 해당하는 등록 정보가 있습니다. 적용 범위는 기관에 확인하세요."
                : c.glpMissing.length
                  ? `등록 정보 확인 필요: ${c.glpMissing.join(", ")}`
                  : "제출처를 지정한 뒤 기관에 적용 범위를 확인하세요."}
            </p>
          </>
        ),
      },
      { label: "결제 조건", cell: (c) => c.pay || "기관 기재 없음" },
      {
        label: "견적 유효기간",
        cell: (c) =>
          c.valid
            ? `${md(c.valid)} · ${dday(c.valid).label}`
            : "기관 확인 필요",
      },
      {
        label: "견적서 원본",
        cell: (c) =>
          c.hasPdf ? (
            <>
              <a href={`/api/quotes/${c.id}/pdf`}>PDF 열기</a>
              {c.operator && <p className="fld__help">이 견적의 기준 문서</p>}
            </>
          ) : (
            "미첨부"
          ),
      },
    ];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <p className="note note--tint">
        수행 범위와 포함 비용이 다르면 합계만으로 비교하기 어렵습니다. 조건을
        먼저 확인하세요. 예비 견적은 기관 확인 후 정식 견적서를 받아야 선택할 수
        있습니다.
      </p>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ marginBottom: 10 }}>비교할 기관</legend>
        <div className="chips">
          {cols.map((c) => (
            <button
              type="button"
              key={c.id}
              className="chip"
              aria-pressed={shown.includes(c.id)}
              disabled={shown.length === 1 && shown.includes(c.id)}
              onClick={() =>
                setShown(
                  shown.includes(c.id)
                    ? shown.filter((id) => id !== c.id)
                    : [...shown, c.id],
                )
              }
            >
              {c.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            className="btxt"
            onClick={() => setShown(cols.slice(0, 2).map((c) => c.id))}
          >
            두 기관만 보기
          </button>
          <button
            className="btxt"
            onClick={() => setShown(cols.map((c) => c.id))}
          >
            전체 보기
          </button>
        </div>
      </fieldset>
      <label className="fld" style={{ maxWidth: 250 }}>
        <span className="fld__lab">표시 순서</span>
        <select
          className="sel"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
        >
          {SORTS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="fld__help">
        표를 좌우로 움직여 기관별 조건을 비교하세요. 위 요약과 아래 시험별
        금액은 같은 열에 표시됩니다.
      </p>
      <div
        className="card tbl-wrap"
        tabIndex={0}
        role="region"
        aria-label="기관별 견적 비교표"
      >
        <table
          className="tbl tbl--sticky"
          style={{ minWidth: 150 + sorted.length * 240 }}
        >
          <caption style={{ textAlign: "left", padding: 12 }}>
            기관이 회신한 조건과 금액 · VAT 별도
          </caption>
          <thead>
            <tr>
              <th scope="col">비교 항목</th>
              {sorted.map((c) => (
                <th scope="col" key={c.id}>
                  <div>{c.name}</div>
                  {c.selected && <span>선택한 기관</span>}
                  <div className="cmp-head__link">
                    <Link href={`/app/r/${no}/q/${c.id}`} className="btxt">
                      견적 상세 보기
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {sorted.map((c) => (
                  <td key={c.id}>{r.cell(c)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">시험별 금액</th>
              <td colSpan={sorted.length}>
                시험 설계와 조건부 사유를 함께 확인하세요.
              </td>
            </tr>
            {rows.map((r) => (
              <tr key={r.seq}>
                <th scope="row">
                  {r.name}
                  <div className="fld__help">{r.category}</div>
                </th>
                {sorted.map((c) => {
                  const it = c.items.find((i) => i.seq === r.seq);
                  return (
                    <td key={c.id}>
                      {!it ? (
                        "회신 없음"
                      ) : it.avail === "불가" ? (
                        <span>수행 불가{it.note ? ` · ${it.note}` : ""}</span>
                      ) : (
                        <>
                          <b className="tnum">
                            {it.amount == null
                              ? "미입력"
                              : comma(it.amount)}
                          </b>
                          <p>
                            {it.weeks ? `${it.weeks}주` : "기간 미입력"}
                            {it.avail === "조건부 가능" ? " · 조건부 가능" : ""}
                          </p>
                          {it.design && <p>{it.design}</p>}
                          {it.explain?.map(([k, v]) => (
                            <p key={k}>
                              <b>{k}</b>
                              <br />
                              {v}
                            </p>
                          ))}
                          {it.note && (
                            <p style={{ whiteSpace: "pre-wrap" }}>{it.note}</p>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fld__help">
        견적서 원본과 표의 내용이 다르면 기관에 확인해 주세요.
        {canSelect
          ? " 기관 선정은 견적 상세에서 진행합니다."
          : " 선정 후에도 상세 내용을 열람할 수 있습니다."}
      </p>
      <Link
        href={`/app/support?rfq=${no}`}
        className="b2"
        style={{ alignSelf: "flex-start" }}
      >
        견적 내용 문의하기
      </Link>
    </div>
  );
}
