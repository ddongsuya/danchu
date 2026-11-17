/**
 * 견적 에이전트(별도 앱)가 단추를 읽는 입구 (2026-11-17, 연결 설계 1단계).
 *
 * - 에이전트 서버는 사용자의 단추 Supabase 액세스 토큰을 `Authorization: Bearer` 로 넘긴다.
 *   서비스 키는 에이전트에 주지 않는다. 사용자·역할·기관은 토큰 → 단추 프로필에서만 정한다.
 * - 이 단계는 읽기만 한다. 보내기·제출·선정 같은 동작은 다음 단계에서 사람 승인 뒤에만 연다.
 * - 화면과 같은 공개 규칙을 따른다: 의뢰자는 자기 요청만, 기관 담당자는 자기 기관이 받은 요청만.
 *   선정 전에는 기관에게 의뢰자 회사·계정을 주지 않고(lib/pipeline.ts identityVisible),
 *   의뢰자에게는 비교표가 열리기 전 기관명·금액을 주지 않는다(lib/reply-window.ts comparisonOpened).
 * - 운영자 계정은 이 입구를 쓰지 않는다(운영 기능은 단추 웹에서만).
 */
import { NextResponse } from "next/server";
import { sessionForUser, type Session } from "./auth";
import { getSupabaseAdmin } from "./supabase";
import type { InviteRow, QuoteRow, RfqRow, RfqSummary } from "./data";
import type { PipeItem } from "./pipeline";
import { comparisonOpened } from "./reply-window";
import { CRO_TERMS_VERSION, JOIN_CONSENT, occupiesSeat } from "./request-policy";
import { quoteSelectable } from "./quote-policy";
import { clientIp, rateLimited } from "./rate-limit";

export type AgentError = "unauthorized" | "forbidden" | "org_not_ready" | "not_found" | "rate_limited" | "unavailable";

const STATUS: Record<AgentError, number> = { unauthorized: 401, forbidden: 403, org_not_ready: 403, not_found: 404, rate_limited: 429, unavailable: 503 };

/** 오류 응답. 본문은 코드만 (사유 문장은 에이전트 앱이 정한다) */
export function agentError(code: AgentError): NextResponse {
  return NextResponse.json({ error: code }, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

export function agentJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** `Authorization: Bearer <token>` 에서 토큰만. 형식이 틀리면 null */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(h.trim());
  return m ? m[1] : null;
}

export type AgentRole = "requester" | "cro";
export type AgentSession = Session & { role: AgentRole };

/**
 * 토큰 → 에이전트 세션. 실패하면 오류 코드.
 * 이메일 미확인·운영자·승인 전 기관은 막는다.
 */
export async function agentSession(req: Request): Promise<AgentSession | AgentError> {
  const token = bearerToken(req);
  if (!token) return "unauthorized";
  const admin = getSupabaseAdmin();
  if (!admin) return "unavailable";
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return "unauthorized";
  const s = await sessionForUser(data.user);
  if (!s) return "unauthorized";
  return gateRole(s);
}

/** 역할 판정 (순수 함수, 테스트 대상) */
export function gateRole(s: Session): AgentSession | AgentError {
  const role = s.profile.role;
  if (role === "requester") return { ...s, role };
  if (role === "cro") {
    if (!s.org || s.org.status !== "approved" || s.org.managed) return "org_not_ready";
    return { ...s, role };
  }
  return "forbidden";
}

/* ── 보여 줄 모양 (순수 함수) ── */

export type AgentMe = {
  /** 단추 계정 id. 에이전트 서버가 대화·이용량을 계정별로 묶는 열쇠 */
  id: string;
  role: AgentRole;
  name: string | null;
  email: string;
  org: { id: string; name: string; plan: string | null } | null;
};

export function meView(s: AgentSession): AgentMe {
  return {
    id: s.userId,
    role: s.role,
    name: s.profile.name,
    email: s.email,
    org: s.role === "cro" && s.org ? { id: s.org.id, name: s.org.name, plan: s.org.plan ?? null } : null,
  };
}

export type AgentRequesterItem = {
  no: string;
  title: string;
  categories: string[];
  status: string;
  createdAt: string;
  joinBy: string | null;
  replyBy: string | null;
  sent: number;
  joined: number;
  submitted: number;
  compareOpen: boolean;
  selected: boolean;
};

/** 의뢰자 자기 요청 목록 한 줄. 기관별 정보는 넣지 않는다(합계만, lib/data.ts listRequestsForUser 와 같은 규칙) */
export function requesterItem(r: RfqSummary): AgentRequesterItem {
  return {
    no: r.rfq_no,
    title: r.substance,
    categories: r.categories ?? [],
    status: r.status,
    createdAt: r.created_at,
    joinBy: r.join_by ?? null,
    replyBy: r.reply_by ?? null,
    sent: r.sent,
    joined: r.joined,
    submitted: r.submitted,
    compareOpen: comparisonOpened(r),
    selected: !!r.selected_quote_id,
  };
}

export type AgentCroItem = {
  no: string;
  title: string;
  categories: string;
  /** 선정된 요청만 회사명. 그 밖에는 null */
  client: string | null;
  clientHint: string;
  /** 진행판 묶음: todo(이번 주 할 일)·decide(참여 결정 전)·work(작성 중)·sent(제출)·won(선정)·done(끝남) */
  group: PipeItem["group"];
  stage: string;
  next: string;
  due: string | null;
  /** 진행 단계(요청 받음 → 참여 → 견적 제출 → 비교표 → 선정). 날짜는 MM.DD 표시값 */
  steps: { label: string; at: string; state: "done" | "now" | "next" }[];
  /** 우리 기관 금액만(제출 총액·선정 금액 등). 다른 기관 금액은 없다 */
  money: [string, string][];
  /**
   * 참여 결정 전에만. 에이전트 앱 참여 카드가 웹 참여 화면(components/cro/JoinPanel)과 같은 동의 문장·약관을 보여 주고,
   * 본 판(terms)을 join 동작에 그대로 넘긴다. 판이 바뀌면 join 라우트가 409로 다시 보게 한다.
   */
  join: { terms: string; consent: string; termsUrl: string } | null;
};

/** 참여 결정 전인 요청의 참여 동의 문장과 약관 판 (순수 함수) */
export function joinTerms(p: Pick<PipeItem, "stageLabel">): AgentCroItem["join"] {
  return p.stageLabel === "참여 결정 전" ? { terms: CRO_TERMS_VERSION, consent: JOIN_CONSENT, termsUrl: "/terms/cro" } : null;
}

/** 기관 받은 요청 한 줄. 의뢰자 계정 id(clientKey)·선정 id·화면 주소는 내보내지 않는다 */
export function croItem(p: PipeItem): AgentCroItem {
  return {
    no: p.no,
    title: p.title,
    categories: p.cats,
    client: p.client,
    clientHint: p.clientHint,
    group: p.group,
    stage: p.stageLabel,
    next: p.next,
    due: p.due,
    steps: p.steps.map((x) => ({ label: x.label, at: x.at, state: x.state })),
    money: p.money.map(([k, v]) => [k, v] as [string, string]),
    join: joinTerms(p),
  };
}

export type AgentCompare =
  | { open: false; joined: number; submitted: number; replyBy: string | null }
  | {
      open: true;
      /** quoteId·revision·inviteId 는 선정·2차 요청·질의 같은 승인 동작(연동 4·5단계)에 그대로 넘긴다. selectable 은 단추 선정 조건(정식 견적서·유효기간) */
      columns: { lab: string; total: number | null; weeks: number | null; submittedAt: string | null; quoteId: string | null; inviteId: string | null; revision: number | null; selectable: boolean; selected: boolean }[];
    };

/**
 * 의뢰자 비교표. 열리기 전에는 숫자만. 열린 뒤에는 제출한 견적을 회신 도착 순으로(추천·순위 없음).
 * 금액은 단추가 저장한 값 그대로다(에이전트가 다시 계산하거나 고치지 않는다).
 */
export function compareView(rfq: Pick<RfqRow, "compared_at" | "selected_quote_id" | "reply_by">, invites: Pick<InviteRow, "status" | "withdrawn_at" | "revoked_at" | "joined_at">[], quotes: (Pick<QuoteRow, "status" | "cro_name" | "total_amount" | "final_weeks" | "first_submitted_at"> & Partial<Pick<QuoteRow, "id" | "invite_id" | "revision" | "auto" | "pdf_path" | "start_date" | "valid_until">>)[]): AgentCompare {
  if (!comparisonOpened(rfq)) {
    const seats = invites.filter((i) => occupiesSeat(i));
    return { open: false, joined: seats.length, submitted: seats.filter((i) => i.status === "submitted").length, replyBy: rfq.reply_by ?? null };
  }
  const cols = quotes
    .filter((q) => q.status === "submitted")
    .sort((a, b) => (a.first_submitted_at ?? "").localeCompare(b.first_submitted_at ?? ""))
    .map((q) => ({
      lab: q.cro_name,
      total: q.total_amount ?? null,
      weeks: q.final_weeks ?? null,
      submittedAt: q.first_submitted_at ?? null,
      quoteId: q.id ?? null,
      inviteId: q.invite_id ?? null,
      revision: q.revision ?? null,
      selectable: !!q.id && quoteSelectable(q),
      selected: !!q.id && q.id === rfq.selected_quote_id,
    }));
  return { open: true, columns: cols };
}

/**
 * 라우트 공통 입구: IP 한도(토큰 확인 전, Auth 왕복을 무한정 시키지 못하게) → 토큰 → 사용자 한도.
 * 오류면 바로 돌려줄 응답, 아니면 세션.
 */
export async function agentGate(req: Request): Promise<AgentSession | NextResponse> {
  if (await rateLimited("agent-ip", clientIp(req), 300, 60)) return agentError("rate_limited");
  const s = await agentSession(req);
  if (typeof s === "string") return agentError(s);
  if (await rateLimited("agent-read", s.userId, 120, 60)) return agentError("rate_limited");
  return s;
}
