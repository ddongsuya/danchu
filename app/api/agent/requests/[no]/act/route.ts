import { agentError, agentJson } from "@/lib/agent-api";
import { agentWriteGate, callAs, inviteForOrg, markVia } from "@/lib/agent-act";
import { POST as sponsorQna } from "@/app/api/rfq/[no]/qna/route";
import { POST as join } from "@/app/api/quote/[token]/join/route";
import { POST as decline } from "@/app/api/quote/[token]/decline/route";
import { POST as croQna } from "@/app/api/quote/[token]/qna/route";
import { POST as submitQuote, PUT as saveQuote } from "@/app/api/quote/[token]/route";
import { POST as uploadUrl } from "@/app/api/quote/[token]/upload-url/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 사람이 에이전트 앱에서 승인한 동작 하나 (연동 4단계). POST { action, ...본문 }
 * 본문 모양은 같은 일을 하는 단추 웹 라우트와 같다. 응답 상태·본문도 웹 처리의 것을 그대로 돌려준다.
 *
 * 의뢰자: ask(견적을 낸 기관에 질의) · answer(기관 질의에 답변)  ← /api/rfq/[no]/qna
 * 기관:   join · decline · ask · answer · quote_draft(PUT 초안 저장) · quote_upload(PDF 올릴 주소) · quote_submit(제출)
 *         ← /api/quote/[token]/* . 토큰은 단추가 우리 기관 초대에서 찾는다. 에이전트는 토큰을 모른다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await agentWriteGate(req);
  if (s instanceof Response) return s;
  const { no } = await ctx.params;
  if (!/^DC-\d{4}-\d{4,6}$/.test(no)) return agentError("not_found");
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof b?.action === "string" ? b.action : "";
  if (!b || !action) return agentJson({ error: "bad_request" }, 400);
  const { action: _a, ...body } = b;

  if (s.role === "requester") {
    if (action !== "ask" && action !== "answer") return agentJson({ error: "bad_request" }, 400);
    const r = await callAs(s, req, sponsorQna, { no }, { ...body, action });
    if (r.status === 200 && action === "ask" && typeof r.body.id === "string") await markVia("rfq_questions", "id", r.body.id);
    return agentJson(r.body, r.status);
  }

  const inv = await inviteForOrg(no, s.org!.id);
  if (!inv) return agentError("not_found");
  const p = { token: inv.token };
  let r: { status: number; body: Record<string, unknown> };
  switch (action) {
    case "join":
      r = await callAs(s, req, join, p, body);
      break;
    case "decline":
      r = await callAs(s, req, decline, p, body);
      break;
    case "ask":
    case "answer":
      r = await callAs(s, req, croQna, p, { ...body, action });
      if (r.status === 200 && action === "ask" && typeof r.body.id === "string") await markVia("rfq_questions", "id", r.body.id);
      break;
    case "quote_draft":
      r = await callAs(s, req, saveQuote, p, body, "PUT");
      break;
    case "quote_upload":
      r = await callAs(s, req, uploadUrl, p, body);
      break;
    case "quote_submit":
      r = await callAs(s, req, submitQuote, p, body);
      if (r.status === 200) await markVia("cro_quotes", "invite_id", inv.id);
      break;
    default:
      return agentJson({ error: "bad_request" }, 400);
  }
  return agentJson(r.body, r.status);
}
