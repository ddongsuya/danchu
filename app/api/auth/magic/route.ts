import { NextResponse } from "next/server";
import { EMAIL_RE, safeNext, sendLoginLink } from "@/lib/auth-links";

export const runtime = "nodejs";

/** POST { email, next? } — 로그인 링크 발송. 가입 여부는 응답으로 드러내지 않는다. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  const r = await sendLoginLink("magic", email, safeNext(b.next));
  if (!r.ok && !r.notFound) return NextResponse.json({ error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
