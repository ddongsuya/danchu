import { agentError, agentJson, agentGate, compareView, croItem, requesterItem } from "@/lib/agent-api";
import { dbReady, getRfqByNo, getRfqDetail, listAwardsForOrg, listInvitesForOrg, listRequestsForUser, ownsRfq } from "@/lib/data";
import { buildPipeline } from "@/lib/pipeline";
import { CRO_TERMS_VERSION, JOIN_CONSENT } from "@/lib/request-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — 요청 하나.
 * 의뢰자: 자기 요청만, 요약 + 비교표(열리기 전에는 숫자만).
 * 기관 담당자: 우리 기관이 받은 요청만, 진행판 한 줄. 참여 결정 전이면 참여 조건 판과 문구(join)도 준다.
 *   에이전트 앱은 이 문구를 그대로 보여 주고, 사람이 누른 참여 승인에 terms 를 그대로 넘긴다(바뀌면 act 가 409).
 * 볼 수 없는 요청은 있는지 없는지 알리지 않도록 모두 not_found.
 */
export async function GET(req: Request, { params }: { params: Promise<{ no: string }> }) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  if (!dbReady()) return agentError("unavailable");
  const { no } = await params;

  if (s.role === "requester") {
    const rfq = await getRfqByNo(no);
    if (!rfq || !ownsRfq(rfq, s.userId)) return agentError("not_found");
    const [d, mine] = await Promise.all([getRfqDetail(rfq), listRequestsForUser(s.userId)]);
    const summary = mine.find((r) => r.id === rfq.id);
    if (!summary) return agentError("not_found");
    return agentJson({ role: s.role, request: requesterItem(summary), compare: compareView(rfq, d.invites, d.quotes) });
  }

  const orgId = s.org!.id;
  const [invites, awards] = await Promise.all([listInvitesForOrg(orgId), listAwardsForOrg(orgId)]);
  const item = buildPipeline(invites, awards).find((p) => p.no === no);
  if (!item) return agentError("not_found");
  const join = item.stageLabel === "참여 결정 전" ? { terms: CRO_TERMS_VERSION, consent: JOIN_CONSENT } : null;
  return agentJson({ role: s.role, request: croItem(item), join });
}
