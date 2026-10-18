import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { claimPending, isPendingToken, MAX_VERIFY_ATTEMPTS } from "@/lib/rfq-pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 접수와 기관 전달까지 기다린다 (완료 화면이 실제 전달 수를 보여 주도록)
export const maxDuration = 60;

/**
 * POST { token, code } — 인증번호를 확인하고, 로그인 세션을 만들고, 맡긴 요청서를 접수한다.
 * 번호는 5번까지 틀릴 수 있다. 그 뒤에는 새 번호를 받아야 한다.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { token?: unknown; code?: unknown };
  const token = isPendingToken(b.token) ? b.token : "";
  const code = typeof b.code === "string" ? b.code.replace(/\D/g, "") : "";
  if (!token || code.length < 6 || code.length > 10) return NextResponse.json({ error: "메일로 받은 번호를 확인해 주세요." }, { status: 400 });
  if (await rateLimited("pending-verify:ip", clientIp(req), 30, 15 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const admin = getSupabaseAdmin();
  const sb = await createSessionClient();
  if (!admin || !sb) return NextResponse.json({ error: "지금은 인증할 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  const { data: row } = await admin.from("rfq_pending").select("email, verify_attempts, verify_type, claimed_rfq_no, expires_at").eq("token", token).maybeSingle();
  if (!row) return NextResponse.json({ error: "맡겨 둔 요청서를 찾지 못했습니다. 다시 보내 주세요." }, { status: 404 });
  if (row.verify_attempts >= MAX_VERIFY_ATTEMPTS) return NextResponse.json({ error: `번호를 ${MAX_VERIFY_ATTEMPTS}번 잘못 입력했습니다. 새 번호를 받아 주세요.`, resend: true }, { status: 429 });

  // 미확인 계정이면 signup, 이미 확인된 계정이면 magiclink. email 은 둘 다 받는다
  const types: EmailOtpType[] = ["email"];
  if (row.verify_type === "signup" || row.verify_type === "magiclink") types.push(row.verify_type);
  let user: { id: string; email?: string } | null = null;
  let lastErr = "";
  for (const type of types) {
    const { data, error } = await sb.auth.verifyOtp({ email: row.email, token: code, type });
    if (!error && data.user) {
      user = data.user;
      break;
    }
    lastErr = error?.code || error?.message || "";
    // 만료는 다른 종류로 다시 해도 같다
    if (/expired/i.test(lastErr)) break;
  }
  if (!user) {
    await admin.from("rfq_pending").update({ verify_attempts: row.verify_attempts + 1 }).eq("token", token);
    const left = MAX_VERIFY_ATTEMPTS - row.verify_attempts - 1;
    const expired = /expired/i.test(lastErr);
    return NextResponse.json({ error: expired ? "번호의 유효 시간이 지났습니다. 새 번호를 받아 주세요." : left > 0 ? `번호가 맞지 않습니다. ${left}번 더 입력할 수 있습니다.` : "번호가 맞지 않습니다. 새 번호를 받아 주세요.", resend: expired || left <= 0 }, { status: 400 });
  }

  // 로그인 전에 접수한 요청을 이 계정에 연결 (확인 링크와 같은 처리)
  await admin.rpc("claim_rfqs_by_email", { p_user: user.id, p_email: row.email }).then(({ error }) => {
    if (error) console.error("claim_rfqs_by_email", error);
  });
  const r = await claimPending(token, { id: user.id, email: row.email });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, rfqNo: r.rfqNo, started: r.started });
}
