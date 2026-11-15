import { NextRequest, NextResponse } from "next/server";
import { crossSiteWrite } from "@/lib/origin";
import { labEnabled } from "@/lib/agent-lab/domain";
import { hasLabAccess, LAB_ACCESS_COOKIE } from "@/lib/agent-lab/access";

export async function POST(req: NextRequest) {
  const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!labEnabled()) return reply("사용할 수 없는 테스트 링크입니다.", 404);
  if (crossSiteWrite(req.method, req.headers.get("origin"), [req.headers.get("host"), req.nextUrl.host])) return reply("허용되지 않은 요청입니다.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return reply("JSON 요청이 필요합니다.", 415);
  const body = await req.text();
  if (Buffer.byteLength(body) > 512) return reply("초대 코드를 확인해 주세요.", 400);
  let accessCode: unknown;
  try { accessCode = (JSON.parse(body) as { accessCode?: unknown }).accessCode; } catch { return reply("초대 코드를 확인해 주세요.", 400); }
  if (typeof accessCode !== "string" || !hasLabAccess(accessCode)) return reply("초대 코드가 만료됐거나 올바르지 않습니다. 새 초대 링크로 열어 주세요.", 403);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(LAB_ACCESS_COOKIE, accessCode, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "strict", path: "/", maxAge: 86400 });
  return response;
}
