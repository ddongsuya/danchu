"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dday, won, md } from "@/lib/format";

export type InviteItem = {
  id: string;
  no: string;
  substance: string;
  client: string;
  purpose: string;
  tags: string[];
  replyBy: string;
  expiresAt: string;
  status: string;      // sent | draft | submitted | declined
  rfqStatus: string;
  total: number | null;
  quoteStatus: string | null;
  sentAt: string;
};

const FILTERS = ["전체", "신규", "작성 중", "제출", "종료"] as const;
type F = (typeof FILTERS)[number];

function bucket(i: InviteItem): F {
  const expired = new Date(i.expiresAt).getTime() < Date.now();
  const closed = ["selected", "contracting", "closed", "cancelled"].includes(i.rfqStatus);
  if (i.status === "declined" || (expired && i.status !== "submitted")) return "종료";
  if (i.status === "submitted") return closed ? "종료" : "제출";
  if (i.status === "draft") return "작성 중";
  return closed ? "종료" : "신규";
}

export function InviteList({ items }: { items: InviteItem[] }) {
  const [filter, setFilter] = useState<F>("전체");
  const sorted = useMemo(() => {
    const rank: Record<F, number> = { 신규: 0, "작성 중": 0, 제출: 1, 종료: 2, 전체: 9 };
    return [...items].sort((a, b) => rank[bucket(a)] - rank[bucket(b)] || a.replyBy.localeCompare(b.replyBy));
  }, [items]);
  const shown = sorted.filter((i) => filter === "전체" || bucket(i) === filter);

  return (
    <>
      <div className="seg" style={{ marginBottom: 14, flexWrap: "wrap", height: "auto" }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} style={{ height: 36 }}>
            {f}{f !== "전체" ? ` ${items.filter((i) => bucket(i) === f).length}` : ""}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="empty">
          <b>해당하는 요청이 없습니다</b>
          {items.length === 0 ? "요청서가 배포되면 이메일과 알림으로 알려 드립니다. 기관 탭에서 수행 분야를 등록해 두면 맞는 요청이 배포됩니다." : ""}
        </div>
      ) : (
        <div className="stack">
          {shown.map((i) => {
            const b = bucket(i);
            const dd = dday(i.replyBy);
            const pill = b === "제출" ? { cls: "pill--ok", text: "제출 완료" } : b === "종료" ? { cls: "pill--sf", text: i.status === "declined" ? "회신 안 함" : i.status === "submitted" ? "마감" : "만료" } : { cls: dd.n <= 2 ? "pill--err" : "pill--sf", text: `회신 ${dd.label}` };
            const state = b === "제출" ? `제출 · ${won(i.total ?? 0)}` : b === "작성 중" ? "작성 중" : b === "신규" ? "신규" : "";
            const action = b === "제출" ? (["selected", "contracting", "closed"].includes(i.rfqStatus) ? "결과 확인" : "수정") : b === "작성 중" ? "이어서 작성" : b === "신규" ? "요청서 보기" : "보기";
            return (
              <Link key={i.id} href={`/cro/r/${i.id}`} className="card card--link" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, borderColor: b === "신규" ? "var(--bline)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{i.no}</span>
                  <span className={`pill ${pill.cls}`}>{pill.text}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{i.substance}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{[i.client, i.purpose].filter(Boolean).join(" · ")}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {i.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--track)", paddingTop: 12, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: b === "제출" ? "var(--ok)" : b === "작성 중" ? "var(--warn)" : b === "신규" ? "var(--brand)" : "var(--muted)" }}>{state || `기한 ${md(i.replyBy)}`}</span>
                  <span style={{ color: "var(--muted)" }}>{action} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
