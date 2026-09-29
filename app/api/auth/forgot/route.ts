import { NextResponse } from "next/server";
import { EMAIL_RE, sendLoginLink } from "@/lib/auth-links";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST { email } — 비밀번호 재설정 링크. 가입 여부는 응답으로 드러내지 않는다. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  if ((await rateLimited("forgot:email", email, 3, 15 * 60)) || (await rateLimited("forgot:ip", clientIp(req), 10, 15 * 60))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const r = await sendLoginLink("recovery", email, "/reset-password");
  if (!r.ok && !r.notFound) return NextResponse.json({ error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
