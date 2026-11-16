import { agentError, agentJson, agentGate, croItem, requesterItem } from "@/lib/agent-api";
import { dbReady, listAwardsForOrg, listInvitesForOrg, listRequestsForUser } from "@/lib/data";
import { buildPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — 의뢰자: 내 요청 목록. 기관 담당자: 우리 기관이 받은 요청 목록.
 * 기관 목록은 견적 진행판(lib/pipeline.ts)과 같은 규칙으로 만든다(선정 전 의뢰자 회사 비공개).
 */
export async function GET(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  if (!dbReady()) return agentError("unavailable");
  if (s.role === "requester") {
    const list = await listRequestsForUser(s.userId);
    return agentJson({ role: s.role, requests: list.map(requesterItem) });
  }
  const orgId = s.org!.id;
  const [invites, awards] = await Promise.all([listInvitesForOrg(orgId), listAwardsForOrg(orgId)]);
  return agentJson({ role: s.role, requests: buildPipeline(invites, awards).map(croItem) });
}
