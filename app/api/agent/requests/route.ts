import { agentError, agentJson, agentGate, croItem, requesterItem } from "@/lib/agent-api";
import { dbReady, listAwardsForOrg, listInvitesForOrg, listRequestsForUser } from "@/lib/data";
import { buildPipeline } from "@/lib/pipeline";
import { agentWriteGate, callAs, markVia } from "@/lib/agent-act";
import { POST as createRfq } from "@/app/api/rfq/route";
import { POST as startRfq } from "@/app/api/rfq/[no]/start/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 기관 안내 메일 발송까지 기다린다 (웹의 /api/rfq/[no]/start 와 같다)
export const maxDuration = 60;

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

/**
 * POST { payload } — 의뢰자: 사람이 승인한 요청서를 접수하고 바로 기관 안내를 시작한다 (연동 4단계).
 * 웹 위자드와 같은 검증(/api/rfq)을 지난다. 첨부는 아직 받지 않는다(웹 요청 화면에서 더할 수 있다).
 * 응답: 웹 처리의 상태·본문 그대로. 성공하면 { rfqNo, started }
 */
export async function POST(req: Request) {
  const s = await agentWriteGate(req);
  if (s instanceof Response) return s;
  if (s.role !== "requester") return agentError("forbidden");
  const b = (await req.json().catch(() => null)) as { payload?: unknown } | null;
  if (!b?.payload || typeof b.payload !== "object") return agentJson({ error: "bad_request" }, 400);
  const made = await callAs(s, req, createRfq, {}, { payload: b.payload, files: [] });
  const rfqNo = typeof made.body.rfqNo === "string" ? made.body.rfqNo : null;
  if (made.status !== 200 || !rfqNo || made.body.persisted !== true) return agentJson(made.body, made.status);
  if (!made.body.duplicate) await markVia("rfq_requests", "rfq_no", rfqNo);
  const started = await callAs(s, req, startRfq, { no: rfqNo }, {});
  return agentJson({ rfqNo, duplicate: !!made.body.duplicate, started: started.status === 200 && started.body.ok === true });
}
