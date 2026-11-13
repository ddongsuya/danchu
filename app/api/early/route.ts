import { NextResponse } from "next/server";
import { earlyDoneSms, parseEarly } from "@/lib/early";
import { sendEarlyDoneMail } from "@/lib/early-mail";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { smsPhone } from "@/lib/sms";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST 사전예약 { role, name, phone, email, org?, orgType?, kinds[], timing?, yearly?, quoteCount?, glp?, monthly?, adAgree?, source?, agree }
 * 같은 갈래·이메일로 다시 보내면 답을 바꾼다. 이미 예약했는지는 응답으로 알려 주지 않는다 (이메일 확인 방지).
 * 예약 완료 문자·메일은 그 행에 처음 한 번만 보낸다 (done_sms_at, done_mail_at). 둘은 따로 기록해 한쪽이 실패해도 다른 쪽을 다시 보내지 않는다.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseEarly(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  if (
    (await rateLimited("early:ip", clientIp(req), 10, 10 * 60)) ||
    (await rateLimited("early:email", v.email, 5, 60 * 60)) ||
    (await rateLimited("early:phone", v.phone, 5, 60 * 60))
  ) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    console.warn("[danchu] 사전예약 미저장(DB 미설정)", v.role);
    return NextResponse.json({ error: "지금은 예약을 받을 수 없어요. limjm900202@gmail.com로 알려 주세요." }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("early_signups")
    .upsert(
      {
        role: v.role,
        name: v.name,
        phone: v.phone,
        email: v.email,
        org: v.org,
        org_type: v.orgType,
        kinds: v.kinds,
        timing: v.timing,
        yearly: v.yearly,
        quote_count: v.quoteCount,
        glp: v.glp ? [v.glp] : [],
        monthly: v.monthly,
        ad_agreed_at: v.adAgree ? now : null,
        source: v.source,
        agreed_at: now,
        updated_at: now,
      },
      { onConflict: "role,email" },
    )
    .select("id, done_sms_at, done_mail_at")
    .single();
  if (error || !data) {
    console.error("early signup", error?.message);
    return NextResponse.json({ error: "예약을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." }, { status: 500 });
  }

  await Promise.all([
    !data.done_sms_at &&
      smsPhone(v.phone, { kind: "early", text: earlyDoneSms(v.role) }).then(async (st) => {
        if (st === "sent") await sb.from("early_signups").update({ done_sms_at: new Date().toISOString() }).eq("id", data.id);
      }),
    !data.done_mail_at &&
      sendEarlyDoneMail(v.email, v).then(async (ok) => {
        if (ok) await sb.from("early_signups").update({ done_mail_at: new Date().toISOString() }).eq("id", data.id);
      }),
  ]);
  return NextResponse.json({ ok: true });
}
