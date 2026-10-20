import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";
import { REPORT_CONTRACT_ERRORS, reportContract } from "@/lib/rpc";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { date, amount, note? } — 선정된 CRO가 계약 체결을 보고한다 → 상태 contracting → 의뢰자 확인 또는 이의 → 확정·종료.
 * 7일 안에 이의가 없으면 예약 작업이 보고대로 확정한다 (0025 auto_confirm_contracts). 성사수수료는 확정한 달에 정산한다.
 * 운영자는 기관에 확인해 대신 기록하거나 정정할 수 있다 (감사 기록). 확인 열은 DB 함수만 쓴다 (rfq_awards_guard_confirm).
 */
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

  // 운영자가 기관에 확인해 대신 남긴 기록은 기관의 보고가 아니다. 성사수수료의 근거라 처음 기록부터 감사 로그를 남긴다
  const what = `계약 체결 ${corrected ? "정정" : isAdmin ? "확인" : "보고"}${isAdmin ? " (운영자 기록)" : ""}`;
  // 의뢰자 확인 기한 (보고 + 7일, 0025). 확인 전 정정이면 DB 가 기한을 다시 잡는다. 확정된 계약의 정정은 확정을 그대로 둔다
  const due = rc.confirm_due_at ? new Date(rc.confirm_due_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "";
  const confirmed = rc.confirmed === true;
  await logEvent(award.rfq_id, "contract", `${award.cro_name} ${what}`, `체결일 ${date} · ${won(amount)}${!confirmed && due ? ` · 의뢰자 확인 기한 ${due}` : ""}`, s.userId);
  if (isAdmin || corrected) {
    await audit({ userId: s.userId, email: s.email }, "award.contract", { type: "rfq_award", id, label: `${r.rfq_no} · ${award.cro_name}` }, { before: { contract_date: award.contract_date, contract_amount: award.contract_amount, contract_status: award.contract_status }, after: { contract_date: date, contract_amount: amount, contract_status: "signed" }, note: [corrected ? "정정" : isAdmin ? "운영자 기록" : "", confirmed ? "확정된 계약" : "", note].filter(Boolean).join(" · ") || undefined });
  }
  if (corrected) {
    // 확인 전 정정이면 의뢰자가 바뀐 내용을 다시 확인한다 (새 기한). 확정 뒤 정정은 운영자 정정이라 의뢰자 확인을 다시 받지 않는다
    if (!confirmed && r.user_id) {
      await notifyUsers([r.user_id], { kind: "계약", title: `${r.rfq_no} 계약 내용이 정정되었습니다`, body: `체결일 ${date} · ${won(amount)}. 맞는지 요청 화면에서 다시 확인해 주세요.${due ? ` ${due}까지 이의가 없으면 이 내용대로 확정합니다.` : ""}`, href: `/app/r/${r.rfq_no}` });
    }
    return NextResponse.json({ ok: true, corrected: true, confirmDueAt: rc.confirm_due_at ?? null });
  }
  if (r?.user_id) {
    const { data: rq } = await getSupabaseAdmin()!.from("rfq_requests").select("email").eq("id", award.rfq_id).maybeSingle();
    // 기관 보고(운영자 기록 포함)는 의뢰자가 확인한다. 기한 안에 이의가 없으면 보고대로 확정한다 (2026-10-20 결정 2)
    const tail = `맞는지 요청 화면에서 확인해 주세요.${due ? ` ${due}까지 이의가 없으면 보고 내용대로 확정합니다.` : ""}`;
    await notifyUsers(
      [r.user_id],
      isAdmin
        ? { kind: "계약", title: `${award.cro_name} 계약 체결 확인 · ${r.rfq_no}`, body: `체결일 ${date} · ${won(amount)}. 단추가 기관에 확인해 기록했습니다. ${tail}`, href: `/app/r/${r.rfq_no}` }
        : { kind: "계약", title: `${award.cro_name} 계약 체결 보고 · ${r.rfq_no}`, body: `체결일 ${date} · ${won(amount)}. ${tail}`, href: `/app/r/${r.rfq_no}` },
      rq?.email ? { to: [rq.email] } : undefined,
    );
  }
  // 의뢰자 계정이 없는 요청(계정 삭제 등)은 의뢰자가 확인·이의를 할 수 없다. 자동 확정 전에 운영자가 의뢰자 연락처로 확인하도록 알린다
  const orphan = !r?.user_id ? ` · 의뢰자 계정이 없어 확인 요청을 보내지 못했습니다. ${due ? `${due}에 자동 확정되기 전에 ` : ""}의뢰자 연락처로 확인하고, 다르면 수주·계약 화면에서 체결 정보를 정정해 주세요` : "";
  await notifyUsers(await adminUserIds(), { kind: "계약", title: `${r?.rfq_no} ${what} · ${award.cro_name}`, body: `체결일 ${date} · ${won(amount)}${note ? ` · ${note}` : ""}${orphan}`, href: `/admin/awards` }, { to: adminEmails() });
  return NextResponse.json({ ok: true, confirmDueAt: rc.confirm_due_at ?? null });
}
