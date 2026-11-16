import { agentError, agentJson } from "@/lib/agent-api";
import { agentWriteGate, callAs, markVia } from "@/lib/agent-act";
import { POST as crmWrite } from "@/app/api/cro/crm/[kind]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 기관 CRM 기록 한 줄 (연동 5단계). 사람이 에이전트 앱에서 승인한 것만. POST { ...기록 칸 }
 * 웹 /api/cro/crm/activities 만들기와 같은 처리·검증(요금제 확인 포함). 고치기·지우기는 단추 웹에서 한다.
 */
export async function POST(req: Request) {
  const s = await agentWriteGate(req);
  if (s instanceof Response) return s;
  if (s.role !== "cro") return agentError("forbidden");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return agentJson({ error: "bad_request" }, 400);
  const r = await callAs(s, req, crmWrite, { kind: "activities" }, body);
  if (r.status === 200 && typeof r.body.id === "string") await markVia("cro_crm_activities", "id", r.body.id);
  return agentJson(r.body, r.status);
}
