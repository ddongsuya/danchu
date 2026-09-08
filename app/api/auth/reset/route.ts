import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";
import { authErrorKo } from "@/lib/auth-links";

export const runtime = "nodejs";

/** POST { password } — 로그인된(재설정 링크로 들어온) 사용자의 비밀번호 변경 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8) return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  const sb = await createSessionClient();
  if (!sb) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });
  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "링크가 만료되었습니다. 재설정 메일을 다시 요청해 주세요." }, { status: 401 });
  const { error } = await sb.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: authErrorKo(error.message) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
