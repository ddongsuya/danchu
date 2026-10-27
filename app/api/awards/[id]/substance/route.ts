import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent, notifyUsers } from "@/lib/notify";
import { parseAwardSubstance } from "@/lib/award-substance";

export const runtime = "nodejs";

/**
 * POST { qty, when?, note? } — 선정된 기관이 시험물질 필요량과 보낼 시점을 적는다 (0027).
 * 다시 보내면 고친 값으로 바꾼다. 의뢰자에게 알림을 보낸다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "지금은 저장할 수 없습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 503 });
  const { data: award } = await sb.from("rfq_awards").select("id, rfq_id, cro_name, cro_org_id, substance_qty").eq("id", id).maybeSingle();
  if (!award) return NextResponse.json({ error: "수주 기록이 없습니다." }, { status: 404 });
  if (s.profile.role !== "admin" && (!s.profile.cro_org_id || award.cro_org_id !== s.profile.cro_org_id)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const v = parseAwardSubstance(await req.json().catch(() => ({})));
  if (!v) return NextResponse.json({ error: "필요량을 입력해 주세요." }, { status: 400 });
  const { error } = await sb
    .from("rfq_awards")
    .update({ substance_qty: v.qty, substance_when: v.when || null, substance_note: v.note || null, substance_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("award substance", error);
    return NextResponse.json({ error: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }

  const changed = !!award.substance_qty;
  const detail = [`필요량 ${v.qty}`, v.when && `보낼 시점 ${v.when}`].filter(Boolean).join(" · ");
  await logEvent(award.rfq_id, "substance", `${award.cro_name} 시험물질 필요량 ${changed ? "수정" : "안내"}`, detail, s.userId);
  const { data: rq } = await sb.from("rfq_requests").select("rfq_no, user_id, email").eq("id", award.rfq_id).maybeSingle();
  if (rq?.user_id) {
    await notifyUsers(
      [rq.user_id],
      { kind: "선정", title: `${award.cro_name} 시험물질 필요량 ${changed ? "수정" : "안내"} · ${rq.rfq_no}`, body: `${detail}. 요청 화면에서 확인하세요.`, href: `/app/r/${rq.rfq_no}` },
      rq.email ? { to: [rq.email] } : undefined,
    ).catch((e) => console.error("award substance notify", e));
  }
  return NextResponse.json({ ok: true });
}
