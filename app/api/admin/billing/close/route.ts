import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { month: 'YYYY-MM', closed: boolean, note? } — 청구 월 마감·해제.
 * 마감하면 그 달 명세를 저장본(billing_periods.snapshot)으로 고정하고 청구 제외 토글이 막힌다 (close_billing_month, 0020).
 * 해제하면 저장본도 지워지고, 다시 마감할 때 그때 값으로 새로 저장한다
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { month?: unknown; closed?: unknown; note?: unknown };
  const month = typeof b.month === "string" && /^\d{4}-\d{2}$/.test(b.month) ? `${b.month}-01` : "";
  if (!month || typeof b.closed !== "boolean") return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  const sb = getSupabaseAdmin()!;
  if (b.closed) {
    const { error } = await sb.rpc("close_billing_month", { p_month: month, p_actor: s.userId, p_note: note });
    if (error) return NextResponse.json({ error: "마감하지 못했습니다. 0020 마이그레이션이 적용됐는지 확인해 주세요." }, { status: 500 });
  } else {
    const { error } = await sb.from("billing_periods").delete().eq("month", month);
    if (error) return NextResponse.json({ error: "해제하지 못했습니다." }, { status: 500 });
  }
  await audit({ userId: s.userId, email: s.email }, "billing.close", { type: "billing_period", id: null, label: month.slice(0, 7) }, { after: { closed: b.closed }, note: note || undefined });
  return NextResponse.json({ ok: true, message: b.closed ? `${month.slice(0, 7)} 청구를 마감했습니다.` : `${month.slice(0, 7)} 마감을 해제했습니다.` });
}
