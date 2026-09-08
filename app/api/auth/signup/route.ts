import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EMAIL_RE, authErrorKo, safeNext, sendLoginLink } from "@/lib/auth-links";

export const runtime = "nodejs";

/**
 * POST — 의뢰자 가입.
 * 계정을 만들고(이메일 미확인 상태) 확인 링크를 보낸다. 링크를 누르면 확인과 로그인이 함께 끝난다.
 * body: { email, password, name, company, dept?, phone?, orgType?, next? }
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string, max = 120) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const email = s("email", 200).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const name = s("name");
  const company = s("company");

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  if (!name || !company) return NextResponse.json({ error: "담당자 성명과 회사·기관명을 입력해 주세요." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { role: "requester", name, company, dept: s("dept"), phone: s("phone", 40), org_type: s("orgType") },
  });
  if (error) {
    const msg = authErrorKo(error.message);
    const dup = msg.startsWith("이미 가입");
    if (!dup) console.error("signup createUser", error);
    return NextResponse.json({ error: msg }, { status: dup ? 409 : 400 });
  }

  const sent = await sendLoginLink("signup", email, safeNext(b.next));
  return NextResponse.json({ ok: true, mailed: sent.ok });
}
