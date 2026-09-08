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
  items: { seq: number; avail: string; amount: number | null; weeks: number | null }[];
  hasPdf: boolean;
  selected: boolean;
};
export type CompareRowDef = { seq: number; name: string; category: string };

type SortKey = "total" | "weeks" | "start";
const SORTS: [SortKey, string][] = [
  ["total", "총액"],
  ["weeks", "기간"],
  ["start", "착수일"],
];

/**
 * 비교표 — 열 = CRO. 1) 요약 행 2) 항목별 금액.
 * 넓은 화면은 표, 좁은 화면은 가로 스크롤 카드.
 */
export function CompareBoard({ no, cols, rows, canSelect }: { no: string; cols: CompareCol[]; rows: CompareRowDef[]; canSelect: boolean }) {
  const [sortBy, setSortBy] = useState<SortKey>("total");
  const sorted = useMemo(
    () =>
      [...cols].sort((a, b) =>
        sortBy === "total" ? a.total - b.total : sortBy === "weeks" ? a.weeks - b.weeks : (a.start ?? "9999").localeCompare(b.start ?? "9999"),
      ),
    [cols, sortBy],
  );
  const min = Math.min(...cols.map((c) => c.total).filter((t) => t > 0));
  const minByRow = new Map<number, number>();
  for (const r of rows) {
    const vals = cols.map((c) => c.items.find((i) => i.seq === r.seq)?.amount ?? null).filter((v): v is number => v != null && v > 0);
    if (vals.length) minByRow.set(r.seq, Math.min(...vals));
  }

  const summaryRows: { label: string; render: (c: CompareCol) => React.ReactNode }[] = [
    {
      label: "총액",
      render: (c) => (
        <div>
          <div className="tnum" style={{ fontSize: 18, fontWeight: 700 }}>{won(c.total)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.total === min ? "var(--ok)" : "var(--muted)" }}>{c.total === min ? "최저가" : `최저가 대비 +${won(c.total - min)}`}</div>
        </div>
      ),
    },
    {
      label: "수행 범위",
      render: (c) =>
        c.unavailable.length ? (
          <span style={{ color: "var(--err)" }}>일부 불가 · {c.unavailable.join(", ")}</span>
        ) : c.conditional ? (
          <span style={{ color: "var(--warn)" }}>전체 가능 · 조건부 {c.conditional}건</span>
        ) : (
          <span style={{ color: "var(--ok)", fontWeight: 600 }}>전체 가능</span>
        ),
    },
    { label: "착수 가능일", render: (c) => <span className="tnum">{md(c.start)}</span> },
    { label: "총 소요기간", render: (c) => <span className="tnum">{c.weeks ? `${c.weeks}주` : "—"}</span> },
    {
      label: "기본 포함",
      render: (c) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
          {INCL_KEYS.map((k) => {
            const yes = c.includes.includes(k);
            return (
              <span key={k} style={{ fontSize: 12, color: yes ? "var(--body)" : "var(--ph)", textDecoration: yes ? "none" : "line-through", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: yes ? "var(--brand)" : "var(--dash)", display: "inline-block" }} />
                {k}
              </span>
            );
          })}
        </div>
      ),
    },
    { label: "제외·별도", render: (c) => <span style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.note || "—"}</span> },
    {
      label: "GLP 대응",
      render: (c) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.glpOk ? "var(--ok)" : "var(--err)" }}>{c.glpOk ? "제출처 대응 ✓" : `대응 불가 · ${c.glpMissing.join(", ")} 미보유`}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.glp.join(" · ") || "인증 정보 없음"}</div>
        </div>
      ),
    },
    { label: "결제 조건", render: (c) => <span className="tnum">{c.pay ? `${c.pay} (%)` : "—"}</span> },
    {
      label: "유효기간",
      render: (c) => (
        <span className="tnum" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          {md(c.valid)}
          {c.valid && <span className="pill pill--tint" style={{ fontSize: 11 }}>{dday(c.valid).label}</span>}
        </span>
      ),
    },
    {
      label: "정본 PDF",
      render: (c) => (c.hasPdf ? <a href={`/api/quotes/${c.id}/pdf`}>열기</a> : <span style={{ color: "var(--muted)" }}>—</span>),
    },
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>정렬</span>
        <div className="seg">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => setSortBy(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl tbl--sticky" style={{ minWidth: 140 + sorted.length * 240 }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>요약</th>
              {sorted.map((c, i) => (
                <th key={c.id} style={{ minWidth: 220, background: c.selected ? "var(--tint)" : undefined }}>
                  <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>
                    {i + 1}위 · {SORTS.find(([k]) => k === sortBy)![1]} 기준{c.selected ? " · 선택함" : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((r) => (
              <tr key={r.label}>
                <td style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{r.label}</td>
                {sorted.map((c) => (
                  <td key={c.id} style={{ background: c.selected ? "var(--tint)" : undefined }}>{r.render(c)}</td>
                ))}
              </tr>
            ))}
            {canSelect && (
              <tr>
                <td />
                {sorted.map((c) => (
                  <td key={c.id}>
                    <Link href={`/app/r/${no}/q/${c.id}`} className="b2 bsm">상세 보기</Link>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sec-title" style={{ margin: "8px 0 0" }}>
        <h2>항목별 금액</h2>
        <span>각 행 최저가 강조 · 불가 항목은 회색</span>
      </div>
      <div className="card tbl-wrap">
        <table className="tbl tbl--sticky" style={{ minWidth: 200 + sorted.length * 180 }}>
          <thead>
            <tr>
              <th style={{ width: 200 }}>시험 항목</th>
              {sorted.map((c) => (
                <th key={c.id}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.category}</div>
                </td>
                {sorted.map((c) => {
                  const it = c.items.find((i) => i.seq === r.seq);
                  const no_ = !it || it.avail === "불가";
                  const best = it?.amount != null && it.amount === minByRow.get(r.seq);
                  return (
                    <td key={c.id} className="tnum" style={{ color: no_ ? "var(--ph)" : undefined }}>
                      {no_ ? (
                        "불가"
                      ) : (
                        <>
                          <div style={{ fontWeight: best ? 700 : 500, color: best ? "var(--brand)" : undefined }}>{it!.amount != null ? comma(it!.amount) : "—"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {it!.weeks ? `${it!.weeks}주` : ""}
                            {it!.avail === "조건부 가능" ? " · 조건부" : ""}
                          </div>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>합계</td>
              {sorted.map((c) => (
                <td key={c.id} className="tnum" style={{ fontWeight: 700 }}>{comma(c.total)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="cta__note">정본은 CRO가 첨부한 PDF 견적서입니다. 비교표와 PDF가 다르면 PDF가 우선합니다.</p>
    </div>
  );
}
