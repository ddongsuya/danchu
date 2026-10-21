import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { BLOCKED_VERIFY_TYPE, isPendingToken, sendBlockedNotice, sendPendingCode } from "@/lib/rfq-pending";

export const runtime = "nodejs";

/** POST { token } — 인증번호를 새로 보낸다. 이전 번호는 더 쓸 수 없고, 틀린 횟수도 처음부터 센다 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { token?: unknown };
  const token = isPendingToken(b.token) ? b.token : "";
  if (!token) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  if ((await rateLimited("pending-resend:token", token, 4, 60 * 60)) || (await rateLimited("pending-resend:ip", clientIp(req), 10, 60 * 60))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "지금은 보낼 수 없습니다." }, { status: 503 });
  const { data: row } = await sb.from("rfq_pending").select("email, claimed_rfq_no, expires_at, verify_type").eq("token", token).maybeSingle();
  if (!row) return NextResponse.json({ error: "맡겨 둔 요청서를 찾지 못했습니다. 다시 보내 주세요." }, { status: 404 });
  // 이메일마다도 센다 (임시 요청서를 새로 만들어 토큰별 제한을 피하지 못하게)
  if (await rateLimited("pending-resend:email", row.email, 6, 60 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  if (row.claimed_rfq_no) return NextResponse.json({ ok: true, rfqNo: row.claimed_rfq_no });
  if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "요청서를 맡긴 지 7일이 지나 보관 기간이 끝났습니다. 같은 브라우저에서 열면 임시 저장된 내용으로 다시 보낼 수 있습니다." }, { status: 410 });
  if (row.verify_type === BLOCKED_VERIFY_TYPE) {
    // 의뢰자로 쓸 수 없는 이메일: 응답은 같게, 메일은 안내로 (계정이 있는지 드러내지 않는다)
    await sendBlockedNotice(row.email);
    await sb.from("rfq_pending").update({ verify_attempts: 0 }).eq("token", token);
    return NextResponse.json({ ok: true, codeLength: 6 });
  }
  const sent = await sendPendingCode(row.email, token);
  await sb.from("rfq_pending").update({ verify_attempts: 0, ...(sent.vtype ? { verify_type: sent.vtype } : {}) }).eq("token", token);
  if (!sent.ok) return NextResponse.json({ error: "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  return NextResponse.json({ ok: true, codeLength: sent.codeLength ?? 6 });
}
