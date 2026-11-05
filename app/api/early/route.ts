import { NextResponse } from "next/server";
import { parseEarly } from "@/lib/early";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST 사전예약 { role, email, org?, orgType?, kinds[], timing?, glp[]?, intent?, ask?, source?, agree }
 * 같은 갈래·이메일로 다시 보내면 고른 값을 바꾼다. 이미 예약했는지는 응답으로 알려 주지 않는다 (이메일 확인 방지).
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseEarly(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  if ((await rateLimited("early:ip", clientIp(req), 10, 10 * 60)) || (await rateLimited("early:email", v.email, 5, 60 * 60))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    console.warn("[danchu] 사전예약 미저장(DB 미설정)", v.role);
    return NextResponse.json({ error: "지금은 예약을 받을 수 없어요. limjm900202@gmail.com로 알려 주세요." }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { error } = await sb.from("early_signups").upsert(
    {
      role: v.role,
      email: v.email,
      org: v.org,
      org_type: v.orgType,
      kinds: v.kinds,
      timing: v.timing,
      glp: v.glp,
      intent: v.intent,
      ask: v.ask,
      source: v.source,
      agreed_at: now,
      updated_at: now,
    },
    { onConflict: "role,email" },
  );
  if (error) {
    console.error("early signup", error.message);
    return NextResponse.json({ error: "예약을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
