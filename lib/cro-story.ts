/**
 * 기관 홈의 요약 숫자와 지금 할 일 (2026-10-29 대표 지시: 세 역할 모두 "요약 한 장면 → 보고서 흐름").
 * 기관 자신의 안내·견적만 센다. 다른 기관의 참여·금액은 여기서 다루지 않는다.
 */
import type { InviteStage } from "./status";

export type CroItem = {
  id: string;
  no: string;
  substance: string;
  tags: string[];
  replyBy: string;
  expiresAt: string;
  stage: InviteStage;
  cancelled?: boolean;
  rfqStatus: string;
  quoteStatus: string | null;
  awarded?: boolean;
};
export type PendingAward = { no: string; substance: string; days: number };

const CLOSED_RFQ = ["compared", "selected", "contracting", "closed", "cancelled"];

/** 지금 기관이 움직여야 하는 안내: 참여 결정 전·참여·작성 중이고, 마감·만료 전 */
export function needsAction(i: CroItem, now = Date.now()): boolean {
  if (i.cancelled || CLOSED_RFQ.includes(i.rfqStatus)) return false;
  if (new Date(i.expiresAt).getTime() < now) return false;
  return i.stage === "undecided" || i.stage === "joined" || i.stage === "draft";
}

/** 진행 중: 움직여야 하는 안내 + 제출하고 비교표 공개를 기다리는 안내 */
export function inProgress(i: CroItem, now = Date.now()): boolean {
  return needsAction(i, now) || (i.stage === "submitted" && !CLOSED_RFQ.includes(i.rfqStatus) && !i.cancelled);
}

export function croTotals(items: CroItem[], now = Date.now()) {
  const live = items.filter((i) => !i.cancelled);
  return {
    received: live.length,
    joined: live.filter((i) => ["joined", "draft", "submitted", "withdrawn"].includes(i.stage)).length,
    submitted: live.filter((i) => i.stage === "submitted" || i.quoteStatus === "submitted").length,
    awarded: live.filter((i) => i.awarded).length,
    active: live.filter((i) => inProgress(i, now)),
    undecided: live.filter((i) => i.stage === "undecided" && needsAction(i, now)).length,
  };
}

/** 그 안내에서 할 일의 이름 (버튼 문구) */
export function actionLabel(i: Pick<CroItem, "stage">): string {
  return i.stage === "draft" ? "이어 쓰기" : i.stage === "joined" ? "견적 쓰기" : "요약 보고 참여 결정";
}

/** 지금 할 일 하나: 회신 기한이 가장 가까운 안내, 없으면 계약 결과 보고가 가장 오래 밀린 선정 */
export function croTodo(items: CroItem[], awards: PendingAward[], now = Date.now()): { kind: "invite"; item: CroItem } | { kind: "award"; award: PendingAward } | null {
  const act = items.filter((i) => needsAction(i, now)).sort((a, b) => a.replyBy.localeCompare(b.replyBy));
  if (act[0]) return { kind: "invite", item: act[0] };
  const aw = [...awards].sort((a, b) => b.days - a.days)[0];
  return aw ? { kind: "award", award: aw } : null;
}

/** 회신 작성 진행: 항목마다 가능 여부를 고르고, 불가가 아니면 금액까지 적었으면 작성한 것으로 센다 */
export function replyProgress(rows: { seq: number; name: string }[], items: { seq: number; avail: string; amount: string }[] | undefined): { total: number; done: number; left: string[] } {
  const ok = (seq: number) => {
    const it = items?.find((x) => x.seq === seq);
    return !!it && !!it.avail && (it.avail === "불가" || !!String(it.amount ?? "").trim());
  };
  const left = rows.filter((r) => !ok(r.seq)).map((r) => r.name);
  return { total: rows.length, done: rows.length - left.length, left };
}
