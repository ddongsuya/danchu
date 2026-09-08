import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AwardRow } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";

export const runtime = "nodejs";

/** POST { date, amount, note? } — 선정된 CRO가 계약 체결을 보고한다 → 상태 contracting → 운영자가 종료 처리 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin()!;
  const { data: a } = await sb.from("rfq_awards").select("*").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ error: "수주 기록이 없습니다." }, { status: 404 });
  const award = a as AwardRow;
  if (s.profile.role !== "admin" && (!s.profile.cro_org_id || award.cro_org_id !== s.profile.cro_org_id)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : "";
  const amount = typeof b.amount === "string" && /^\d{1,13}$/.test(b.amount) ? Number(b.amount) : NaN;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  if (!date || !Number.isFinite(amount)) return NextResponse.json({ error: "체결일과 계약금액을 입력해 주세요." }, { status: 400 });

  const { error } = await sb.from("rfq_awards").update({ contract_date: date, contract_amount: amount, contract_note: note || null, contract_reported_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  await sb.from("rfq_requests").update({ status: "contracting" }).eq("id", award.rfq_id).in("status", ["selected"]);

  const { data: r } = await sb.from("rfq_requests").select("rfq_no, user_id, substance").eq("id", award.rfq_id).maybeSingle();
  await logEvent(award.rfq_id, "contract", `${award.cro_name} 계약 체결 보고`, `체결일 ${date} · ${won(amount)}`, s.userId);
  if (r?.user_id) await notifyUsers([r.user_id], { kind: "계약", title: `${award.cro_name}과 계약이 체결되었습니다`, body: `${r.rfq_no} · ${won(amount)}`, href: `/app/r/${r.rfq_no}` });
  await notifyUsers(await adminUserIds(), { kind: "계약", title: `${r?.rfq_no} 계약 체결 보고 · ${award.cro_name}`, body: `체결일 ${date} · ${won(amount)}${note ? ` · ${note}` : ""}`, href: `/admin/awards` }, { to: adminEmails() });
  return NextResponse.json({ ok: true });
}
