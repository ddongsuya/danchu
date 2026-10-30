/**
 * 의뢰자 화면의 "요청 이야기" 숫자와 문장 (2026-10-29 대표 지시: 홈은 한 장면 요약, 요청은 지나온 길, 비교표는 보고서).
 * 화면은 숫자를 직접 세지 않고 여기의 함수만 쓴다. 참여·제출은 participation() 과 같은 규칙(request-policy.ts)이다.
 *
 * 공개 범위 (2026-10-20 결정 1을 지키는 선): 비교표가 열리기 전에도 의뢰자에게 합계 숫자(보낸 곳·확인한 곳·참여·제출)는 보인다.
 * 기관 이름, 기관별 불참 여부는 보이지 않는다. 그래서 "참여하지 않음"과 "아직 정하지 않음"은 한 숫자(rest)로 묶는다.
 */
import { occupiesSeat, participationLabel, type JoinFields } from "./request-policy";

export type StoryInvite = JoinFields & { opened_at?: string | null };

export type Funnel = {
  /** 요청이 전달된 기관 (운영자가 취소한 안내는 빼고) */
  sent: number;
  /** 그중 요약을 열어 본 기관 */
  opened: number;
  /** 참여한 기관 (참여·작성 중·제출) */
  joined: number;
  /** 견적을 낸 기관 */
  submitted: number;
  /** 참여하지 않았거나 아직 정하지 않은 기관 (둘을 나누지 않는다) */
  rest: number;
};

export function funnel(invites: StoryInvite[]): Funnel {
  const live = invites.filter((i) => !i.revoked_at);
  const joined = live.filter(occupiesSeat);
  // 참여·불참·철회를 했다면 요약을 본 것이다 (예전 기록에는 opened_at 이 비어 있을 수 있다)
  const opened = live.filter((i) => !!i.opened_at || !!i.joined_at || ["draft", "submitted", "declined"].includes(i.status)).length;
  const submitted = joined.filter((i) => i.status === "submitted").length;
  return { sent: live.length, opened: Math.max(opened, joined.length), joined: joined.length, submitted, rest: Math.max(0, live.length - joined.length) };
}

/** 목록·홈이 받는 합계 (요약 행에는 rest 가 없다) */
export type Counts = Pick<Funnel, "sent" | "joined" | "submitted">;

/** 홈 궤도 그림의 점 하나 = 기관 하나. f 견적 제출, h 참여(작성 중), w 그 밖(참여 안 함·아직 정하지 않음을 나누지 않음) */
export type Dot = "f" | "h" | "w";
export function dotsOf(f: Counts, max = 24): Dot[] {
  const out: Dot[] = [];
  for (let i = 0; i < f.submitted; i++) out.push("f");
  for (let i = 0; i < f.joined - f.submitted; i++) out.push("h");
  while (out.length < f.sent) out.push("w");
  return out.slice(0, max);
}

type StoryReq = { status: string; compared_at?: string | null; reply_by: string | null; selected_quote_id?: string | null; outcome?: string | null; started_at?: string | null };

const DONE = ["closed", "cancelled"];
const WAITING = ["received", "distributed", "quoted"];

/** 비교 보고서를 지금 볼 수 있는 요청 (열렸고 견적이 있다) */
export function reportReady(r: StoryReq & { submitted: number }): boolean {
  return !!r.compared_at && r.submitted > 0;
}

/** 회신 기한이 지났는데 참여한 기관이 없는 요청 (서울 날짜 today) */
export function noJoinPastDue(r: StoryReq & { joined: number }, today: string): boolean {
  return ["distributed", "quoted"].includes(r.status) && !r.compared_at && !!r.reply_by && r.reply_by < today && r.joined === 0;
}

/** 요청 목록 한 줄 설명. late 이면 빨강으로 보인다 */
export function rowLine(r: StoryReq & Counts & { cap?: number | null }, today: string, md: (d: string) => string): { text: string; late: boolean } {
  if (r.status === "cancelled") return { text: "취소한 요청이에요", late: false };
  if (r.status === "closed") return { text: r.outcome ? `선택 없이 마무리 · ${r.outcome}` : "마무리한 요청이에요", late: false };
  if (r.status === "selected" || r.status === "contracting") return { text: r.status === "contracting" ? "기관 선택 · 계약 진행 중" : "기관을 선택했어요 · 계약 소식을 기다리는 중", late: false };
  if (reportReady(r)) return { text: `비교 보고서가 열렸어요 · 견적 ${r.submitted}건`, late: false };
  if (r.status === "received" && !r.sent) return { text: "기관에 보내기 전이에요", late: false };
  if (noJoinPastDue(r, today)) return { text: "참여한 기관 없이 회신 기한이 지났어요", late: true };
  if (r.compared_at && r.submitted === 0) return { text: "도착한 견적 없이 회신이 마감됐어요", late: true };
  const pastDue = !!r.reply_by && r.reply_by < today;
  const when = r.reply_by ? (pastDue ? "곧 비교 보고서가 열려요" : `${md(r.reply_by)}까지 회신`) : "회신 기한 미정";
  if (!r.joined) return { text: `${r.sent}곳에 보냈어요 · 참여 결정 기다리는 중 · ${when}`, late: false };
  return { text: `${participationLabel({ joined: r.joined, cap: r.cap ?? null })} · 견적 ${r.submitted}건 도착 · ${when}`, late: false };
}

/** 홈 첫 장면 숫자: 진행 중인 요청이 있으면 그것만, 없으면 전체 */
export function homeTotals<T extends StoryReq & Counts>(list: T[]): { scope: "active" | "all"; reqs: T[]; sent: number; joined: number; submitted: number; ready: T[] } {
  const active = list.filter((r) => !DONE.includes(r.status));
  const reqs = active.length ? active : list;
  const sum = (k: "sent" | "joined" | "submitted") => reqs.reduce((a, r) => a + r[k], 0);
  return {
    scope: active.length ? "active" : "all",
    reqs,
    sent: sum("sent"),
    joined: sum("joined"),
    submitted: sum("submitted"),
    ready: list.filter((r) => !DONE.includes(r.status) && !r.selected_quote_id && reportReady(r)),
  };
}

/** 회신을 기다리는 단계인지 (비교표가 열리기 전) */
export const waitingReplies = (r: StoryReq) => WAITING.includes(r.status) && !r.compared_at;
