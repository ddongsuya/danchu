import { agentGate, agentJson } from "@/lib/agent-api";
import { CATALOG_VERSION, catalogFor } from "@/lib/agent-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — 이 사용자가 에이전트로 할 수 있는 액션 목록 (액션 등록부 lib/agent-actions.ts).
 * 이름·범위(rfq·org)·실행 수준(read·auto·confirm·human)·입력 모양(JSON Schema)·비서 도구 여부. 실행 함수는 내보내지 않는다.
 * 에이전트 서버는 이 목록으로 비서 도구와 확인 카드를 만든다. version 이 바뀌면 다시 읽는다.
 */
export async function GET(req: Request) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  return agentJson({ version: CATALOG_VERSION, role: s.role, actions: catalogFor(s) });
}
