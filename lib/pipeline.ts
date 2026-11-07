/**
 * 기관 견적 진행판 (2026-11-07, 스레드 "기관용 CRM 기능 검토하기").
 * 받은 요청 · 제출한 견적 · 수주를 요청 하나의 흐름으로 묶고, 요청마다 "다음 할 일"과 기한을 붙인다.
 * 기관 자신의 안내·견적·선정만 다룬다. 다른 기관의 참여·금액은 여기서 다루지 않는다.
 * 의뢰자 회사는 선정된 요청에서만 보인다 (identityVisible).
 */
import type { InviteWithQuote, listAwardsForOrg } from "./data";
import { identityVisible, maskedClientLabel } from "./request-policy";
import { inviteStage, type InviteStage } from "./status";
import { needsAction } from "./cro-story";

type Award = Awaited<ReturnType<typeof listAwardsForOrg>>[number];

export type PipeGroup = "todo" | "decide" | "work" | "sent" | "won" | "done";
export const GROUP_LABEL: Record<PipeGroup, string> = {
  todo: "이번 주 할 일",
  decide: "참여 결정 전",
  work: "작성 중",
  sent: "제출 · 비교표 열림",
  won: "선정 · 계약",
  done: "끝남",
};
export const GROUP_ORDER: PipeGroup[] = ["todo", "decide", "work", "sent", "won", "done"];

export type PipeStep = { label: string; at: string; state: "done" | "now" | "next" };
export type PipeItem = {
  id: string;
  no: string;
  title: string;
  cats: string;
  /** 선정된 요청만 회사명. 그 밖에는 null (화면에 "선정 시 공개") */
  client: string | null;
  clientKey: string | null;
  clientHint: string;
  group: PipeGroup;
  stageLabel: string;
  next: string;
  /** 다음 할 일 기한 (YYYY-MM-DD). 없으면 null */
  due: string | null;
  steps: PipeStep[];
  money: [string, string][];
  note: string;
  action: { label: string; href: string } | null;
  awardId: string | null;
};

const DAY = 864e5;
const ymdKst = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "");
const mdDot = (iso: string | null | undefined) => {
  const d = ymdKst(iso);
  return d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : "";
};
const wonFull = (n: number | null | undefined) => (n == null ? "-" : `${n.toLocaleString("ko-KR")}원`);

/** 고객 키: 의뢰자 계정 id, 계정이 지워졌으면 회사명 (0038 client_key) */
export function clientKeyOf(rfq: { user_id?: string | null; company?: string | null } | null | undefined): string | null {
  if (!rfq) return null;
  if (rfq.user_id) return rfq.user_id;
  const co = (rfq.company ?? "").trim();
  return co ? `co:${co.slice(0, 200)}` : null;
}

/** 계약 금액이 선정 금액과 몇 % 다른지 (소수 첫째 자리) */
export function gapPct(base: number | null | undefined, amount: number | null | undefined): number | null {
  if (!base || amount == null) return null;
  return Math.round(((amount - base) / base) * 1000) / 10;
}

export function buildPipeline(invites: InviteWithQuote[], awards: Award[], now = Date.now()): PipeItem[] {
  const awardByInvite = new Map(awards.filter((a) => a.invite_id).map((a) => [a.invite_id as string, a]));
  const out: PipeItem[] = [];
  for (const i of invites) {
    if (i.revoked_at) continue;
    const stage: InviteStage = inviteStage(i);
    const joined = !!i.joined_at;
    const rs = i.rfq?.status ?? "";
    const award = awardByInvite.get(i.id) ?? null;
    const awarded = !!award || (!!i.quote && !!i.rfq?.selected_quote_id && i.rfq.selected_quote_id === i.quote.id);
    const cats = (i.rfq?.categories ?? []).join(" · ");
    // 참여 전에는 시험물질명을 보이지 않는다 (요약에 없는 정보, 0023)
    const title = joined && i.rfq?.substance ? i.rfq.substance : `${cats || "시험"} 요청`;
    const client = identityVisible({ awarded }) ? i.rfq?.company ?? null : null;
    const base = {
      id: i.id,
      no: i.rfq_no,
      title,
      cats,
      client,
      clientKey: awarded ? clientKeyOf(i.rfq) : null,
      clientHint: awarded ? "" : maskedClientLabel(i.rfq?.org_type),
      awardId: award?.id ?? null,
    };
    const item = { cancelled: false, expiresAt: i.expires_at, rfqStatus: rs, stage } as const;
    const live = needsAction({ ...item, id: i.id, no: i.rfq_no, substance: "", tags: [], replyBy: i.reply_by, quoteStatus: i.quote?.status ?? null }, now);
    const submittedAt = i.quote?.submitted_at ?? i.quote?.first_submitted_at ?? null;
    const sentStep: PipeStep = { label: "요청 받음", at: mdDot(i.sent_at), state: "done" };

    if (awarded && award) {
      const reported = !!award.contract_reported_at;
      const subst = !!award.substance_updated_at;
      const pct = gapPct(award.quoteAmount, award.contract_amount);
      const days = Math.floor((now - new Date(award.awarded_at).getTime()) / DAY);
      const ended = rs === "closed" && reported && subst;
      out.push({
        ...base,
        group: ended ? "done" : reported && subst ? "done" : "won",
        stageLabel: reported ? "계약 확정" : "계약 진행",
        next: !reported ? "계약 결과 보고" : !subst ? "시험물질 필요량 적기" : "할 일 없음",
        due: null,
        steps: [
          { label: "견적 제출", at: mdDot(submittedAt), state: "done" },
          { label: "이 기관 선정 · 연락처 공개", at: mdDot(award.awarded_at), state: "done" },
          { label: "계약 결과 보고", at: reported ? mdDot(award.contract_reported_at) : `선정 ${days}일째`, state: reported ? "done" : "now" },
          { label: "시험물질 필요량", at: subst ? mdDot(award.substance_updated_at) : "", state: subst ? "done" : reported ? "now" : "next" },
        ],
        money: [
          ["선정 금액", wonFull(award.quoteAmount)],
          ...(reported ? ([["계약 금액", wonFull(award.contract_amount)]] as [string, string][]) : []),
          ...(pct != null && reported ? ([["차이", `${pct > 0 ? "+" : ""}${pct}%`]] as [string, string][]) : []),
        ],
        note: reported ? "계약 확정 뒤에는 시험물질 정보를 받아 필요량을 적어요." : "계약 금액이 선정 금액과 10% 넘게 다르면 보고할 때 사유를 골라요.",
        action: !reported ? { label: "계약 결과 보고", href: "/cro/awards" } : !subst ? { label: "필요량 적기", href: "/cro/awards" } : null,
      });
      continue;
    }

    const lostOrClosed = ["selected", "contracting", "closed", "cancelled"].includes(rs);
    if (stage === "declined" || stage === "withdrawn" || stage === "ended" || (lostOrClosed && !awarded) || (!live && stage !== "submitted")) {
      const lost = stage === "submitted" && lostOrClosed && rs !== "cancelled";
      out.push({
        ...base,
        group: "done",
        stageLabel: lost ? "미선정" : stage === "declined" ? "불참" : stage === "withdrawn" ? "철회" : rs === "cancelled" ? "요청 취소" : "끝남",
        next: lost ? "다른 기관이 선정됐어요" : stage === "declined" || stage === "withdrawn" ? "청구 대상이 아니에요" : "끝난 요청이에요",
        due: null,
        steps: [sentStep, ...(submittedAt ? [{ label: "견적 제출", at: mdDot(submittedAt), state: "done" as const }] : []), { label: lost ? "미선정" : "끝남", at: "", state: "done" }],
        money: i.quote?.total_amount ? [["제출 총액", wonFull(i.quote.total_amount)]] : [],
        note: lost ? "다른 기관의 금액은 보여 주지 않아요." : "참여하지 않았거나 철회한 요청은 청구하지 않아요.",
        action: { label: "요청서 보기", href: `/cro/r/${i.id}` },
      });
      continue;
    }

    if (stage === "submitted") {
      const opened = !!i.rfq?.compared_at;
      out.push({
        ...base,
        group: "sent",
        stageLabel: opened ? "비교표 열림" : "제출",
        next: opened ? "선정 기다리는 중" : "비교표 열리면 알려요",
        due: opened ? i.quote?.valid_until ?? null : i.reply_by,
        steps: [
          sentStep,
          { label: "견적 제출", at: mdDot(submittedAt), state: "done" },
          { label: "비교표 열림", at: opened ? mdDot(i.rfq?.compared_at) : `${mdDot(i.reply_by)} 예정`, state: opened ? "done" : "now" },
          { label: "선정 결과", at: "", state: opened ? "now" : "next" },
        ],
        money: [["제출 총액", wonFull(i.quote?.total_amount)], ...(i.quote?.valid_until ? ([["견적 유효기간", ymdKst(i.quote.valid_until)]] as [string, string][]) : [])],
        note: opened ? "의뢰자가 고르면 바로 알려요." : "비교표가 열리기 전까지 고칠 수 있어요.",
        action: opened ? null : { label: "견적 고치기", href: `/cro/r/${i.id}/reply` },
      });
      continue;
    }

    // 참여 결정 전 · 참여 · 작성 중
    const undecided = stage === "undecided";
    const due = undecided ? (i.rfq?.join_by ?? i.reply_by) : i.reply_by;
    const soon = due ? new Date(`${due.slice(0, 10)}T23:59:59+09:00`).getTime() - now <= 7 * DAY : false;
    out.push({
      ...base,
      group: soon ? "todo" : undecided ? "decide" : "work",
      stageLabel: undecided ? "참여 결정 전" : stage === "draft" ? "작성 중" : "참여",
      next: undecided ? "참여할지 정하기" : stage === "draft" ? "견적 이어 쓰기" : "견적 쓰기",
      due,
      steps: [
        sentStep,
        { label: "참여", at: joined ? mdDot(i.joined_at) : `${mdDot(due)}까지`, state: joined ? "done" : "now" },
        { label: "견적 제출", at: joined ? `${mdDot(i.reply_by)}까지` : "", state: joined ? "now" : "next" },
        { label: "비교표 열림", at: "", state: "next" },
      ],
      money: i.quote?.total_amount ? [["작성 중인 총액", wonFull(i.quote.total_amount)]] : [["회신 기한", ymdKst(i.reply_by)]],
      note: undecided ? "참여하지 않으면 청구하지 않아요. 다음 참여 안내에도 영향이 없어요." : "시험 목록에 적어 둔 조건으로 초안이 채워져요.",
      action: undecided ? { label: "요약 보고 참여 결정", href: `/cro/r/${i.id}` } : { label: stage === "draft" ? "이어 쓰기" : "견적 쓰기", href: `/cro/r/${i.id}/reply` },
    });
  }

  // 계약 결과 보고가 남은 선정은 기한이 없어도 이번 주 할 일에 올린다
  for (const it of out) if (it.group === "won" && it.next === "계약 결과 보고") it.group = "todo";
  const rank = (x: PipeItem) => (x.due ? new Date(x.due).getTime() : x.group === "todo" ? 0 : Number.MAX_SAFE_INTEGER);
  return out.sort((a, b) => rank(a) - rank(b));
}

export function groupPipeline(items: PipeItem[]): { group: PipeGroup; items: PipeItem[] }[] {
  return GROUP_ORDER.map((g) => ({ group: g, items: items.filter((x) => x.group === g) })).filter((g) => g.items.length);
}
