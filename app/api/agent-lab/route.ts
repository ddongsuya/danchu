import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crossSiteWrite } from "@/lib/origin";
import { LAB_ROLES, isLabRole, labEnabled } from "@/lib/agent-lab/domain";
import { resetLabSession, responseFor, runLabTurn } from "@/lib/agent-lab/runtime";
import { changeLabSession, cleanOldLabRecords, LabStoreError, loadLabSession, newStoredLabSession } from "@/lib/agent-lab/storage";
import { hasLabAccess, LAB_ACCESS_COOKIE } from "@/lib/agent-lab/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const COOKIE = "danchu-agent-lab";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("message"), role: z.enum(LAB_ROLES), message: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ action: z.literal("approval"), role: z.enum(LAB_ROLES), approvalId: z.string().uuid(), approve: z.boolean() }).strict(),
  z.object({ action: z.literal("reset"), role: z.enum(LAB_ROLES) }).strict(),
]);

export async function GET(req: NextRequest) {
  if (!labEnabled()) return json({ error: "테스트 화면을 사용할 수 없습니다." }, 404);
  if (!hasLabAccess(req.cookies.get(LAB_ACCESS_COOKIE)?.value)) return json({ error: "초대 링크로 테스트 화면을 열어 주세요." }, 401);
  const role = req.nextUrl.searchParams.get("role") || "requester";
  if (!isLabRole(role)) return json({ error: "역할을 확인해 주세요." }, 400);
  try {
    const existing = await loadLabSession(req.cookies.get(COOKIE)?.value);
    const loaded = existing ?? await newStoredLabSession();
    if (!existing) after(() => cleanOldLabRecords().catch(() => {}));
    const session = loaded.session;
    const response = json({ ...responseFor(session, role), inProgress: !!loaded.lease || session.busy, configured: !!process.env.OPENAI_API_KEY });
    response.cookies.set(COOKIE, session.id, { httpOnly: true, sameSite: "strict", secure: req.nextUrl.protocol === "https:", path: "/api/agent-lab", maxAge: 7200 });
    return response;
  } catch (error) { return json({ error: error instanceof LabStoreError ? error.message : "테스트 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." }, error instanceof LabStoreError ? error.status : 503); }
}

export async function POST(req: NextRequest) {
  if (!labEnabled()) return json({ error: "테스트 화면을 사용할 수 없습니다." }, 404);
  if (!hasLabAccess(req.cookies.get(LAB_ACCESS_COOKIE)?.value)) return json({ error: "초대 링크로 테스트 화면을 열어 주세요." }, 401);
  const origin = req.headers.get("origin");
  if (crossSiteWrite(req.method, origin, [req.headers.get("host"), req.nextUrl.host])) return json({ error: "다른 사이트의 요청은 처리할 수 없습니다." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON 요청이 필요합니다." }, 415);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 18000) return json({ error: "메시지가 너무 깁니다." }, 413);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  const parsed = bodySchema.safeParse(value);
  if (!parsed.success) return json({ error: "역할과 입력 내용을 확인해 주세요." }, 400);
  const body = parsed.data;
  try {
    const loaded = await loadLabSession(req.cookies.get(COOKIE)?.value);
    if (!loaded) return json({ error: "테스트 세션이 끝났습니다. 화면을 새로고침해 주세요." }, 401);
    if (body.action !== "reset" && !process.env.OPENAI_API_KEY) return json({ error: "테스트용 AI 연결 설정을 확인해 주세요." }, 503);
    const response = await changeLabSession(loaded, async session => {
      if (body.action === "reset") { resetLabSession(session); return responseFor(session, body.role); }
      if (body.action === "message") return runLabTurn(session, body.role, { message: body.message });
      return runLabTurn(session, body.role, { approvalId: body.approvalId, approve: body.approve });
    }, body.action !== "reset");
    return json(response);
  } catch (error) {
    // Never log SDK errors: they can contain prompts, request headers, and provider details.
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
    const message = error instanceof LabStoreError ? error.message : status === 429 ? "AI 사용 한도에 도달했습니다. 결제·사용 한도를 확인한 뒤 다시 시도해 주세요."
      : status === 401 || status === 403 ? "AI 연결 권한을 확인해 주세요."
      : "작업을 완료하지 못했습니다. 아래 업무 상태를 확인하고 다시 시도해 주세요.";
    return json({ error: message }, error instanceof LabStoreError ? error.status : 502);
  }
}
