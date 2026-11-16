import { agentJson, agentGate, meView } from "@/lib/agent-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 에이전트 앱 사용자 요약 (역할·기관). 토큰은 Authorization: Bearer */
export async function GET(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  return agentJson({ me: meView(s) });
}
