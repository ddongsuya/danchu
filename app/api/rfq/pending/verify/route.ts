import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { BLOCKED_VERIFY_TYPE, claimPending, isPendingToken, MAX_VERIFY_ATTEMPTS } from "@/lib/rfq-pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 접수와 참여 안내까지 기다린다 (완료 화면이 안내 결과를 보여 주도록. 안내한 기관 수는 의뢰자에게 보이지 않는다)
export const maxDuration = 60;

/**
 * POST { token, code } — 인증번호를 확인하고, 로그인 세션을 만들고, 맡긴 요청서를 접수한다.
 * 번호는 5번까지 틀릴 수 있다. 그 뒤에는 새 번호를 받아야 한다. 시도는 확인 전에 조건부 갱신으로 먼저 잡고(동시 요청으로 횟수 검사를 건너뛰지 못하게),
 * IP·토큰·이메일(시간·하루)별 공유 카운터로도 막는다 (토큰을 새로 만들어 횟수를 초기화하지 못하게). 틀린 번호와 만료는 같은 응답이다.
 * 번호가 맞으면 이메일이 확인된 계정이 되고(세션 쿠키), 그 계정의 user_id 로 요청을 만든다.
 * 의뢰자로 쓸 수 없는 이메일(blocked)은 번호가 맞지 않는 경우와 같은 응답을 받는다 (계정이 있는지 드러내지 않는다).
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { token?: unknown; code?: unknown };
  const token = isPendingToken(b.token) ? b.token : "";
  const code = typeof b.code === "string" ? b.code.replace(/\D/g, "") : "";
  if (!token || code.length < 6 || code.length > 10) return NextResponse.json({ error: "메일로 받은 번호를 확인해 주세요." }, { status: 400 });
  if ((await rateLimited("pending-verify:ip", clientIp(req), 30, 15 * 60)) || (await rateLimited("pending-verify:token", token, 12, 15 * 60))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const admin = getSupabaseAdmin();
  const sb = await createSessionClient();
  if (!admin || !sb) return NextResponse.json({ error: "지금은 인증할 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  const { data: row } = await admin.from("rfq_pending").select("email, verify_attempts, verify_type, claimed_rfq_no, expires_at").eq("token", token).maybeSingle();
  if (!row) return NextResponse.json({ error: "맡겨 둔 요청서를 찾지 못했습니다. 다시 보내 주세요." }, { status: 404 });
  if (row.claimed_rfq_no) return NextResponse.json({ ok: true, rfqNo: row.claimed_rfq_no, started: true });
  if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "요청서를 맡긴 지 7일이 지나 보관 기간이 끝났습니다. 같은 브라우저에서 열면 임시 저장된 내용으로 다시 보낼 수 있습니다." }, { status: 410 });
  // 이메일마다도 센다: 같은 이메일로 임시 요청서(토큰)를 새로 만들어 횟수를 초기화하지 못하게
  if ((await rateLimited("pending-verify:email", row.email, 10, 60 * 60)) || (await rateLimited("pending-verify:email-day", row.email, 30, 24 * 60 * 60))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  if (row.verify_attempts >= MAX_VERIFY_ATTEMPTS) return NextResponse.json({ error: `번호를 ${MAX_VERIFY_ATTEMPTS}번 잘못 입력했습니다. 새 번호를 받아 주세요.`, resend: true }, { status: 429 });
  // 확인하기 전에 시도 1회를 먼저 잡는다 (읽은 값과 같을 때만 늘린다). 동시에 여러 번 보내도 횟수 검사를 건너뛰지 못한다
  const { data: reserved } = await admin.from("rfq_pending").update({ verify_attempts: row.verify_attempts + 1 }).eq("token", token).eq("verify_attempts", row.verify_attempts).select("token").maybeSingle();
  if (!reserved) return NextResponse.json({ error: "번호를 확인하는 중입니다. 잠시 후 다시 입력해 주세요." }, { status: 409 });

  // 미확인 계정이면 signup, 이미 확인된 계정이면 magiclink. email 은 둘 다 받는다
  // blocked 는 번호를 보내지 않았다. 확인을 시도하지 않고 틀린 번호로 처리한다
  const types: EmailOtpType[] = row.verify_type === BLOCKED_VERIFY_TYPE ? [] : ["email"];
  if (row.verify_type === "signup" || row.verify_type === "magiclink") types.push(row.verify_type);
  let user: { id: string; email?: string } | null = null;
  for (const type of types) {
    const { data, error } = await sb.auth.verifyOtp({ email: row.email, token: code, type });
    if (!error && data.user) {
      user = data.user;
      break;
    }
  }
  if (!user) {
    // 틀린 번호와 만료된 번호를 구분하지 않는다. Supabase 는 틀린 번호에도 otp_expired 를 돌려주므로, 그 문구로 나누면
    // 번호를 보내지 않은 이메일(blocked: 기관·운영자 계정)과 응답이 달라져 계정이 있는지 드러난다
    const left = MAX_VERIFY_ATTEMPTS - row.verify_attempts - 1;
    return NextResponse.json({ error: left > 0 ? `번호가 맞지 않거나 유효 시간이 지났습니다. ${left}번 더 입력할 수 있고, 새 번호를 받을 수도 있습니다.` : "번호가 맞지 않거나 유효 시간이 지났습니다. 새 번호를 받아 주세요.", resend: left <= 0 }, { status: 400 });
  }

  // 로그인 전에 접수한 요청을 이 계정에 연결 (확인 링크와 같은 처리)
  await admin.rpc("claim_rfqs_by_email", { p_user: user.id, p_email: row.email }).then(({ error }) => {
    if (error) console.error("claim_rfqs_by_email", error);
  });
  const r = await claimPending(token, { id: user.id, email: row.email });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, rfqNo: r.rfqNo, started: r.started });
}
