import { agentGate, agentJson } from "@/lib/agent-api";
import { agentWriteLimited } from "@/lib/agent-act";
import { actResponse, findAction, runAgentAction } from "@/lib/agent-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 선정·2차 요청·요청 접수는 기관 알림 메일까지 기다린다
export const maxDuration = 60;

/**
 * POST { action, rfqNo?, body } — 액션 등록부(lib/agent-actions.ts)의 액션 하나를 이 사용자로 실행한다.
 *   read    바로 읽는다.
 *   auto    기관 안의 기록. 바로 하고 실행 기록을 남긴다. 응답의 agentLog.id 로 되돌릴 수 있다(/api/agent/undo).
 *   confirm 에이전트 서버가 사람 승인(보내기 장부)을 거친 뒤에만 부른다. 실행 기록을 남긴다.
 *   human   403 human_only.
 * 응답 상태·본문은 웹 처리의 것 그대로다(쓰기면 agentLog 가 붙는다).
 */
export async function POST(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  const b = (await req.json().catch(() => null)) as { action?: unknown; rfqNo?: unknown; body?: unknown } | null;
  const action = typeof b?.action === "string" ? b.action : "";
  const body = b?.body === undefined ? {} : b.body;
  if (!action || !body || typeof body !== "object" || Array.isArray(body) || (b?.rfqNo !== undefined && typeof b.rfqNo !== "string")) return agentJson({ error: "bad_request" }, 400);
  const def = findAction(s.role, action);
  if (def && def.level !== "read") {
    const limited = await agentWriteLimited(s);
    if (limited) return limited;
  }
  const r = await runAgentAction(s, req, action, typeof b?.rfqNo === "string" ? b.rfqNo : null, body as Record<string, unknown>);
  return actResponse(r);
}
