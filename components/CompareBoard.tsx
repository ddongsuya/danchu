"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { INCL_KEYS } from "@/lib/cro-data";
import { comma, dday, md, won } from "@/lib/format";

export type CompareCol = {
  id: string;
  name: string;
  total: number;
  weeks: number;
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
};
export type CompareRowDef = { seq: number; name: string; category: string };

type SortKey = "default" | "total" | "weeks" | "start";
const SORTS: [SortKey, string][] = [
  ["default", "기본 순서"],
  ["total", "금액 낮은 순"],
  ["weeks", "기간 짧은 순"],
  ["start", "착수 빠른 순"],
];

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
  const [sortBy, setSortBy] = useState<SortKey>("default");
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
              : sortBy === "weeks"
                ? (a.weeks || Infinity) - (b.weeks || Infinity)
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
        cell: (c) => (c.auto ? "기관 확인 전 예비 견적" : "기관 제출 견적"),
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
                {k}: {c.includes.includes(k) ? "포함" : "미포함·확인 필요"}
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
        label: "예상 소요기간",
        cell: (c) => (c.weeks ? `${c.weeks}주 (병렬 수행 기준)` : "미입력"),
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
            <a href={`/api/quotes/${c.id}/pdf`}>PDF 열기</a>
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
                  <div>
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
                              : `${comma(it.amount)}원`}
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
