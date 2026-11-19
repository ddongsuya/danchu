import { agentJson } from "@/lib/agent-api";
import { agentWriteGate } from "@/lib/agent-act";
import { actResponse, runAgentAction } from "@/lib/agent-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 선정·2차 요청은 기관 알림 메일까지 기다린다
export const maxDuration = 60;

/**
 * 사람이 에이전트 앱에서 승인한 동작 하나 (연동 4단계). POST { action, ...본문 }
 * 처리는 액션 등록부(lib/agent-actions.ts)가 한다. 새 입구는 /api/agent/act { action, rfqNo, body }.
 * 이 입구는 이미 배포된 에이전트 서버를 위해 남긴다. 응답 상태·본문은 웹 처리의 것 그대로(쓰기면 agentLog 가 붙는다).
 *
 * 의뢰자: ask · answer · select · detail · contract_confirm · contract_result
 * 기관:   join · decline · ask · answer · quote_draft · quote_upload · quote_submit · detail_reply · contract_report
 *         토큰·선정 id는 단추가 우리 기관 초대에서 찾는다. 에이전트는 모른다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await agentWriteGate(req);
  if (s instanceof Response) return s;
  const { no } = await ctx.params;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof b?.action === "string" ? b.action : "";
  if (!b || !action) return agentJson({ error: "bad_request" }, 400);
  const { action: _a, ...body } = b;
  return actResponse(await runAgentAction(s, req, action, no, body));
}
