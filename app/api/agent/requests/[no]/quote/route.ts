import { agentError, agentGate, agentJson, quoteBriefView } from "@/lib/agent-api";
import { inviteForOrg } from "@/lib/agent-act";
import { dbReady } from "@/lib/data";
import { loadQuote } from "@/lib/quote-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — 기관 담당자: 우리 기관이 받은 요청 한 건의 요청서 전체와 회신 초안 (말로 맡기는 견적 1단계).
 * 웹 회신 화면과 같은 데이터·공개 규칙(lib/quote-load.ts). 참여 전에는 요약만, 초안 없음.
 * 의뢰자는 쓰지 않는다. 볼 수 없는 요청은 있는지 없는지 알리지 않도록 not_found.
 * 읽기만 한다: 첫 열람 시각을 남기지 않는다(에이전트가 대신 읽은 것은 담당자의 열람이 아니다).
 */
export async function GET(req: Request, { params }: { params: Promise<{ no: string }> }) {
  const s = await agentGate(req);
  if (s instanceof Response) return s;
  if (s.role !== "cro") return agentError("forbidden");
  if (!dbReady()) return agentError("unavailable");
  const { no } = await params;
  if (!/^DC-\d{4}-\d{4,6}$/.test(no)) return agentError("not_found");
  const inv = await inviteForOrg(no, s.org!.id);
  if (!inv) return agentError("not_found");
  const loaded = await loadQuote(inv.token, { markOpened: false });
  if (!loaded) return agentError("not_found");
  return agentJson({ quote: quoteBriefView(loaded) });
}
