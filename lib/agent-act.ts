/**
 * 견적 에이전트의 쓰기 (연동 4·5단계). 사람이 에이전트 앱에서 승인한 동작만 에이전트 서버가 부른다.
 *
 * - 단추 웹의 라우트 처리를 그대로 부른다(runAsAgent). 검증·권한·알림·청구가 웹과 같다.
 * - 응답 상태와 본문은 웹 처리의 것을 그대로 돌려준다(오류 문장 포함).
 * - 기록의 출처는 via='agent'로 남는다. rfq_events 는 logEvent 가, 나머지는 여기서 처리 뒤에 표시한다.
 */
import { agentError, agentGate, type AgentSession } from "./agent-api";
import { runAsAgent } from "./agent-context";
import { rateLimited } from "./rate-limit";
import { getSupabaseAdmin } from "./supabase";

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/** 쓰기 입구: 읽기 입구 검사 + 쓰기 횟수 제한(10분에 30번) */
export async function agentWriteGate(req: Request): Promise<AgentSession | Response> {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  const limited = await agentWriteLimited(s);
  return limited ?? s;
}

/** 이미 세션을 확인한 뒤 쓰기 횟수만 본다(10분에 30번). 넘으면 돌려줄 응답 */
export async function agentWriteLimited(s: AgentSession): Promise<Response | null> {
  return (await rateLimited("agent-write", s.userId, 30, 600)) ? agentError("rate_limited") : null;
}

/** 단추 웹 라우트 처리를 이 사용자로 부른다. 본문은 JSON (GET 은 본문 없음) */
export async function callAs<P>(
  s: AgentSession,
  from: Request,
  handler: Handler<P>,
  params: P,
  body: unknown,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers({ "content-type": "application/json" });
  for (const h of ["user-agent", "x-forwarded-for", "x-real-ip"]) {
    const v = from.headers.get(h);
    if (v) headers.set(h, v);
  }
  const req = new Request(from.url, { method, headers, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
  const res = await runAsAgent(s, () => handler(req, { params: Promise.resolve(params) }));
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

/** 처리 뒤 출처 표시. 실패해도 동작은 이미 끝났으므로 오류로 돌리지 않는다 */
export async function markVia(table: "rfq_requests" | "cro_quotes" | "rfq_questions" | "rfq_awards" | "rfq_details" | "cro_crm_activities", column: string, value: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from(table).update({ via: "agent" }).eq(column, value);
  if (error) console.error("agent via", table, error.code);
}

/** 기관 담당자: 이 요청에 우리 기관이 받은 초대(거둔 것 제외, 최근 것) */
export async function inviteForOrg(no: string, orgId: string): Promise<{ id: string; token: string } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_invites").select("id, token").eq("rfq_no", no).eq("cro_org_id", orgId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { id: data.id as string, token: data.token as string } : null;
}
