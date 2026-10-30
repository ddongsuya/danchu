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
  /** 운영자가 취소한 안내 (rfq_invites.revoked_at) */
  cancelled?: boolean;
  rfqStatus: string;
  total: number | null;
  quoteStatus: string | null;
  sentAt: string;
  /** 이 기관의 견적이 선정됨 (rfq.selected_quote_id = 내 견적) */
  awarded?: boolean;
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

/**
 * "종료"에 모인 줄의 표시 (흐름 재설계 디자인 2d783db). 다 같은 "종료"로 두면 기관이 이유를 알 수 없다.
 * 제출한 뒤 비교표가 열리면 마감, 운영자가 취소한 안내는 취소됨, 내기 전에 요청이 마감되면 마감, 링크 기한이 지나면 만료
 */
export function endedLabel(i: Pick<InviteItem, "stage" | "cancelled" | "rfqStatus" | "expiresAt">, now = Date.now()): string {
  if (i.stage === "submitted") return "마감";
  if (i.stage === "declined" || i.stage === "withdrawn") return INVITE_STAGE_LABEL[i.stage];
  if (i.cancelled) return "취소됨";
  if (CLOSED_RFQ.includes(i.rfqStatus)) return "마감";
  if (new Date(i.expiresAt).getTime() < now) return "만료";
  return "종료";
}

export function InviteList({ items }: { items: InviteItem[] }) {
  const [filter, setFilter] = useState<F>("전체");
  const sorted = useMemo(() => {
    const rank: Record<F, number> = { "참여 결정 전": 0, 참여: 0, "작성 중": 0, 제출: 1, 종료: 2, 전체: 9 };
    return [...items].sort((a, b) => rank[bucket(a)] - rank[bucket(b)] || a.replyBy.localeCompare(b.replyBy));
  }, [items]);
  const shown = sorted.filter((i) => filter === "전체" || bucket(i) === filter);
  // "전체"에서는 끝난 요청(선정된 요청 제외)을 아래 접힌 묶음으로 보낸다. 지금 할 일이 위에 남도록
  const fold = filter === "전체";
  const main = fold ? shown.filter((i) => bucket(i) !== "종료" || i.awarded) : shown;
  const ended = fold ? shown.filter((i) => bucket(i) === "종료" && !i.awarded) : [];

  return (
    <>
      <div className="rs-tools">
        <div className="rs-chips" role="group" aria-label="요청 상태 필터">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}{f !== "전체" ? <span className="tnum"> {items.filter((i) => bucket(i) === f).length}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="rs-empty">
          <b>해당하는 요청이 없어요</b>
          {items.length === 0 ? <span>분야가 맞는 요청이 들어오면 참여 안내를 이메일과 알림으로 보내요. 기관 탭에서 수행 분야를 등록해 두면 맞는 요청을 안내받아요.</span> : <span>다른 필터를 골라 보세요.</span>}
        </div>
      ) : (
        <div className="rs-list">
          {main.map((i) => row(i))}
          {ended.length > 0 && (
            <details className="rs-fold">
              <summary>{`끝난 요청 ${ended.length}건 보기 · 만료·마감·불참`}</summary>
              <div className="rs-list">{ended.map((i) => row(i))}</div>
            </details>
          )}
        </div>
      )}
    </>
  );
}

function row(i: InviteItem) {
  const b = bucket(i);
  const dd = dday(i.replyBy);
  const acting = b === "참여 결정 전" || b === "참여" || b === "작성 중";
  const line = i.awarded
    ? `선정됐어요 · ${won(i.total ?? 0)}`
    : b === "제출"
      ? `제출했어요 · ${won(i.total ?? 0)} · 비교표 공개 기다리는 중`
      : b === "종료"
        ? endedLabel(i)
        : b === "작성 중"
          ? "회신을 쓰고 있어요"
          : b === "참여"
            ? "참여했어요 · 견적을 써 주세요"
            : `${i.client} · 요약을 보고 참여를 정해 주세요`;
  const go = i.awarded || b === "제출" ? (["selected", "contracting", "closed"].includes(i.rfqStatus) ? "결과 보기" : "회신 보기") : b === "작성 중" ? "이어 쓰기" : b === "참여" ? "견적 쓰기" : b === "참여 결정 전" ? "요약 보기" : "보기";
  // 시험물질명이 아직 안 열렸으면 분야로 제목을 만든다 (참여 전에는 물질명이 보이지 않는다, 0023)
  const title = i.substance || `${i.tags.join(" · ") || "비임상 시험"} 견적 요청`;
  return (
    <Link key={i.id} href={`/cro/r/${i.id}`} className="rs-row">
      <span className="rs-row__no tnum">{i.no}</span>
      <span className="rs-row__main">
        <b>{title}</b>
        <span className="rs-row__line">{line}</span>
      </span>
      <span className={acting && dd.n <= 2 ? "rs-row__due rs-row__due--soon tnum" : "rs-row__due tnum"}>{acting ? `${md(i.replyBy)} · ${dd.label}` : `기한 ${md(i.replyBy)}`}</span>
      <span className="rs-row__go">{go}</span>
    </Link>
  );
}
