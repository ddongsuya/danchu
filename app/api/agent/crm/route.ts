import { agentError, agentJson } from "@/lib/agent-api";
import { agentWriteGate } from "@/lib/agent-act";
import { actResponse, runAgentAction } from "@/lib/agent-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 기관 CRM 기록 한 줄 (연동 5단계). POST { ...기록 칸 }
 * 액션 등록부의 crm_activity 와 같다(바로 실행, 실행 기록·되돌리기). 새 입구는 /api/agent/act.
 * 이미 배포된 에이전트 서버를 위해 남긴다.
 */
export async function POST(req: Request) {
  const s = await agentWriteGate(req);
  if (s instanceof Response) return s;
  if (s.role !== "cro") return agentError("forbidden");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return agentJson({ error: "bad_request" }, 400);
  return actResponse(await runAgentAction(s, req, "crm_activity", null, body));
}
