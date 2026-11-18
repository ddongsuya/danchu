import { agentError, agentGate, agentJson } from "@/lib/agent-api";
import { agentWriteGate, callAs } from "@/lib/agent-act";
import { runAsAgent } from "@/lib/agent-context";
import { GET as bookRead } from "@/app/api/cro/price-book/route";
import { POST as bookImport } from "@/app/api/cro/price-book/import/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 기관 단가표 (0047). 에이전트가 기관이 첨부한 단가 자료를 읽어 만든 초안을 단추 단가표와 견준다.
 *   GET                                지금 단가표 (기관 담당자만)
 *   POST { mode: "preview", rows }     저장하지 않고 비교 (new · changed · same · error)
 *   POST { mode: "apply", rows }       기관 담당자가 에이전트 앱에서 미리보기를 승인한 뒤에만. 기록은 via=agent
 * 웹 /api/cro/price-book(/import) 처리를 이 사용자로 그대로 부른다 (요금제·검사 같음).
 * 단가는 기관 계정에만 저장한다. 에이전트는 이 값을 지식 자료·대화 기록·로그에 남기지 않는다.
 */
export async function GET(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  if (s.role !== "cro") return agentError("forbidden");
  const res = await runAsAgent(s, () => bookRead());
  if (!res) return agentError("unavailable");
  return agentJson(await res.json().catch(() => ({})), res.status);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return agentJson({ error: "bad_request" }, 400);
  // 미리보기는 저장하지 않으므로 읽기 입구, 저장은 쓰기 입구(횟수 제한)
  const s = body.mode === "apply" ? await agentWriteGate(req) : await agentGate(req);
  if (s instanceof Response) return s;
  if (s.role !== "cro") return agentError("forbidden");
  const r = await callAs(s, req, (q) => bookImport(q), {}, body);
  return agentJson(r.body, r.status);
}
