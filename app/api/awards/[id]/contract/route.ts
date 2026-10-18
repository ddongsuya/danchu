import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";
import { REPORT_CONTRACT_ERRORS, reportContract } from "@/lib/rpc";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** POST { date, amount, note? } — 선정된 CRO가 계약 체결을 보고한다 → 상태 contracting → 의뢰자 확인(7일 뒤 자동 확정) → 종료 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin()!;
  const { data: a } = await sb.from("rfq_awards").select("*").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ error: "수주 기록이 없습니다." }, { status: 404 });
  const award = a;
  if (s.profile.role !== "admin" && (!s.profile.cro_org_id || award.cro_org_id !== s.profile.cro_org_id)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : "";
  const amount = typeof b.amount === "string" && /^\d{1,13}$/.test(b.amount) ? Number(b.amount) : NaN;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  if (!date || !Number.isFinite(amount)) return NextResponse.json({ error: "체결일과 계약금액을 입력해 주세요." }, { status: 400 });
  if (amount < 1) return NextResponse.json({ error: REPORT_CONTRACT_ERRORS.amount.message }, { status: 400 });
  const isAdmin = s.profile.role === "admin";

  // award 갱신과 요청 상태 contracting 을 한 트랜잭션으로. 금액·날짜·중복 보고는 DB 함수가 막는다 (0016)
  const rc = await reportContract(id, date, amount, note, isAdmin);
  if (!rc.ok) {
    const known = REPORT_CONTRACT_ERRORS[rc.code];
    return NextResponse.json({ error: known?.message ?? "저장하지 못했습니다." }, { status: known?.status ?? 500 });
  }
  const r = { rfq_no: rc.rfq_no, user_id: rc.user_id, substance: rc.substance };
  const corrected = rc.corrected === true;

  await logEvent(award.rfq_id, "contract", `${award.cro_name} 계약 체결 ${corrected ? "정정" : "보고"}`, `체결일 ${date} · ${won(amount)}`, s.userId);
  if (corrected) {
    // 정정하면 의뢰자 확인을 다시 받는다 (이의가 있었다면 그 이의에 대한 답)
    await getSupabaseAdmin()!.from("rfq_awards").update({ requester_confirmed_at: null, confirmed_auto: false, requester_disputed_at: null, requester_dispute_note: null }).eq("id", id);
    if (r.user_id) await notifyUsers([r.user_id], { kind: "계약", title: `${r.rfq_no} 계약 내용이 정정되었습니다`, body: `체결일 ${date} · ${won(amount)}. 맞는지 요청 화면에서 다시 확인해 주세요.`, href: `/app/r/${r.rfq_no}` });
    await audit({ userId: s.userId, email: s.email }, "award.contract", { type: "rfq_award", id, label: `${r.rfq_no} · ${award.cro_name}` }, { before: { contract_date: award.contract_date, contract_amount: award.contract_amount }, after: { contract_date: date, contract_amount: amount }, note: note || undefined });
    return NextResponse.json({ ok: true, corrected: true });
  }
  if (r?.user_id) {
    const { data: rq } = await getSupabaseAdmin()!.from("rfq_requests").select("email").eq("id", award.rfq_id).maybeSingle();
    await notifyUsers([r.user_id], { kind: "계약", title: `${award.cro_name} 계약 체결 보고 · ${r.rfq_no}`, body: `체결일 ${date} · ${won(amount)}. 맞는지 요청 화면에서 확인해 주세요. 7일 안에 답이 없으면 보고 내용대로 마무리합니다.`, href: `/app/r/${r.rfq_no}` }, rq?.email ? { to: [rq.email] } : undefined);
  }
  await notifyUsers(await adminUserIds(), { kind: "계약", title: `${r?.rfq_no} 계약 체결 보고 · ${award.cro_name}`, body: `체결일 ${date} · ${won(amount)}${note ? ` · ${note}` : ""}`, href: `/admin/awards` }, { to: adminEmails() });
  return NextResponse.json({ ok: true });
}
