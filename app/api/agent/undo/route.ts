import { agentJson } from "@/lib/agent-api";
import { agentWriteGate } from "@/lib/agent-act";
import { undoAgentAction, type UndoError } from "@/lib/agent-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<UndoError, number> = { not_found: 404, already_undone: 409, not_undoable: 409, expired: 409, changed: 409, unavailable: 503 };

/**
 * POST { id } — 에이전트가 바로 실행한 기관 기록 하나를 되돌린다(사람이 에이전트 앱에서 "되돌리기"를 눌렀을 때).
 * 시킨 사람만, 7일 안, 그 뒤 아무도 고치지 않았을 때만. 실패 사유는 코드로만 돌려준다.
 */
export async function POST(req: Request) {
  const s = await agentWriteGate(req);
  if (s instanceof Response) return s;
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof b?.id !== "string") return agentJson({ error: "bad_request" }, 400);
  const r = await undoAgentAction(s, b.id);
  return r.ok ? agentJson({ ok: true }) : agentJson({ error: r.error }, STATUS[r.error]);
}
