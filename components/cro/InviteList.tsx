"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dday, won, md } from "@/lib/format";
import { INVITE_STAGE_LABEL, type InviteStage } from "@/lib/status";

export type InviteItem = {
  id: string;
  no: string;
  /** 참여 전에는 빈 문자열 (시험물질명은 참여 뒤에 열린다, 0023) */
  substance: string;
  client: string;
  purpose: string;
  tags: string[];
  replyBy: string;
  expiresAt: string;
  /** lib/status.ts inviteStage: undecided · joined · draft · submitted · declined · withdrawn · ended */
  stage: InviteStage;
  rfqStatus: string;
  total: number | null;
  quoteStatus: string | null;
  sentAt: string;
};

/** 목록 필터. 불참·철회·만료·마감은 "종료"에 모은다 (각 줄의 표시는 단계 이름 그대로) */
const FILTERS = ["전체", "참여 결정 전", "참여", "작성 중", "제출", "종료"] as const;
type F = (typeof FILTERS)[number];

const CLOSED_RFQ = ["compared", "selected", "contracting", "closed", "cancelled"];

export function bucket(i: Pick<InviteItem, "expiresAt" | "rfqStatus" | "stage">): F {
  const expired = new Date(i.expiresAt).getTime() < Date.now();
  const closed = CLOSED_RFQ.includes(i.rfqStatus);
  if (i.stage === "declined" || i.stage === "withdrawn" || i.stage === "ended") return "종료";
  if (i.stage === "submitted") return closed ? "종료" : "제출";
  if (expired || closed) return "종료";
  if (i.stage === "draft") return "작성 중";
  if (i.stage === "joined") return "참여";
  return "참여 결정 전";
}

export function InviteList({ items }: { items: InviteItem[] }) {
  const [filter, setFilter] = useState<F>("전체");
  const sorted = useMemo(() => {
    const rank: Record<F, number> = { "참여 결정 전": 0, 참여: 0, "작성 중": 0, 제출: 1, 종료: 2, 전체: 9 };
    return [...items].sort((a, b) => rank[bucket(a)] - rank[bucket(b)] || a.replyBy.localeCompare(b.replyBy));
  }, [items]);
  const shown = sorted.filter((i) => filter === "전체" || bucket(i) === filter);

  return (
    <>
      <div className="seg" style={{ marginBottom: 14, flexWrap: "wrap", height: "auto" }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} style={{ height: 36 }}>
            {f}{f !== "전체" ? <span className="tnum"> {items.filter((i) => bucket(i) === f).length}</span> : null}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="empty">
          <b>해당하는 요청이 없습니다</b>
          {items.length === 0 ? "분야가 맞는 요청이 들어오면 참여 안내를 이메일과 알림으로 보내 드립니다. 기관 탭에서 수행 분야를 등록해 두면 맞는 요청을 안내받습니다." : ""}
        </div>
      ) : (
        <div className="stack">
          {shown.map((i) => {
            const b = bucket(i);
            const dd = dday(i.replyBy);
            const ended = i.stage === "submitted" ? "마감" : i.stage === "declined" || i.stage === "withdrawn" ? INVITE_STAGE_LABEL[i.stage] : "종료";
            const pill = b === "제출" ? { cls: "pill--ok", text: "제출 완료" } : b === "종료" ? { cls: "pill--sf", text: ended } : b === "참여 결정 전" ? { cls: "pill--tint", text: "참여 결정 전" } : { cls: dd.n <= 2 ? "pill--err" : "pill--sf", text: `회신 ${dd.label}` };
            const state = b === "제출" ? `제출 · ${won(i.total ?? 0)}` : b === "작성 중" ? "작성 중" : b === "참여" ? "참여" : b === "참여 결정 전" ? "참여 결정 전" : "";
            const action = b === "제출" ? (["selected", "contracting", "closed"].includes(i.rfqStatus) ? "결과 확인" : "수정") : b === "작성 중" ? "이어서 작성" : b === "참여" ? "견적 작성" : b === "참여 결정 전" ? "요약 보고 참여 결정" : "보기";
            const title = i.substance || `${i.tags.join(" · ") || "비임상 시험"} 견적 요청`;
            return (
              <Link key={i.id} href={`/cro/r/${i.id}`} className="card card--link" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, borderColor: b === "참여 결정 전" ? "var(--bline)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{i.no}</span>
                  <span className={`pill ${pill.cls}`}>{pill.text}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{[i.client, i.purpose].filter(Boolean).join(" · ")}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {i.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--track)", paddingTop: 12, fontSize: 13 }}>
                  <span className="tnum" style={{ fontWeight: 600, color: b === "제출" ? "var(--ok)" : b === "작성 중" ? "var(--warn)" : b === "참여 결정 전" || b === "참여" ? "var(--brand)" : "var(--muted)" }}>{state ? `${state} · 기한 ${md(i.replyBy)}` : `기한 ${md(i.replyBy)}`}</span>
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
