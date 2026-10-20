import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";
import { clientIp, rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { CONTRACT_CONFIRM_ERRORS, confirmContract, disputeContract } from "@/lib/rpc";

export const runtime = "nodejs";

/**
 * POST { action: 'confirm' | 'dispute', note? } — 기관이 보고한 계약 내용을 의뢰자가 확인한다 (2026-10-20 결정 2, 0025).
 * - confirm: 맞음 → 계약 확정, 요청 종료. 성사수수료는 확정한 달(서울)에 확정된 계약 금액으로 정산한다
 * - dispute: 다름 → 정산을 멈추고 운영자가 기관과 확인해 정리한다 (POST /api/admin/awards/[id]/dispute). 요청은 계약 진행 상태로 둔다
 * 보고 뒤 7일 안에 둘 다 없으면 예약 작업이 보고 내용대로 확정하고 종료한다 (auto_confirm_contracts).
 * 확인 열은 DB 함수만 쓴다. 확인은 요청 주인(user_id)만 한다. 운영자는 의뢰자가 알려 온 이의를 대신 기록할 수 있지만
 * 대신 확인하지는 않는다 (의뢰자의 7일 이의 기간을 건너뛰게 되므로. 운영자 확정은 이의 정리에서만, POST /api/admin/awards/[id]/dispute).
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (await rateLimited("contract-confirm:user", s.userId, 20, 10 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
  const action = b.action === "confirm" || b.action === "dispute" ? b.action : null;
  if (!action) return NextResponse.json({ error: "확인 결과를 선택해 주세요." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (action === "dispute" && !note) return NextResponse.json({ error: "실제와 다른 부분을 적어 주세요." }, { status: 400 });
  if (note.length > 500) return NextResponse.json({ error: CONTRACT_CONFIRM_ERRORS.note.message }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  const { data: award } = await sb.from("rfq_awards").select("id, cro_org_id, cro_name, contract_date, contract_amount").eq("rfq_id", rfq.id).maybeSingle();
  if (!award) return NextResponse.json({ error: "선정한 기관이 없는 요청입니다." }, { status: 404 });

  const byOperator = s.profile.role === "admin" && !ownsRfq(rfq, s.userId);
  if (byOperator && action === "confirm") return NextResponse.json({ error: "계약 확인은 의뢰자만 할 수 있습니다. 이의가 있으면 수주·계약 화면에서 정리해 주세요.", code: "forbidden" }, { status: 403 });
  const r = action === "confirm" ? await confirmContract(award.id, s.userId) : await disputeContract(award.id, s.userId, note);
  if (!r.ok) {
    const e = CONTRACT_CONFIRM_ERRORS[r.code];
    return NextResponse.json({ error: e?.message ?? "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: r.code }, { status: e?.status ?? 500 });
  }
  if (r.already) return NextResponse.json({ ok: true, already: true });

  const summary = `체결일 ${r.contract_date ?? award.contract_date ?? "-"} · ${won(r.contract_amount ?? award.contract_amount ?? 0)}`;
  const orgMembers = async () => {
    if (!award.cro_org_id) return [] as string[];
    const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", award.cro_org_id);
    return (ms ?? []).map((m) => m.id);
  };

  if (action === "confirm") {
    await logEvent(rfq.id, "closed", "의뢰자가 계약 내용 확인 · 확정 · 종료", summary, s.userId, { via: r.via ?? "sponsor" });
    await notifyUsers(await orgMembers(), { kind: "계약", title: `${rfq.rfq_no} 의뢰자가 계약 내용을 확인했습니다`, body: `${summary} · 계약이 확정되어 요청을 마쳤습니다.`, href: "/cro/awards" });
    return NextResponse.json({ ok: true });
  }

  // 이의: 정산을 멈추고 운영자가 기관과 확인한다. 운영자에게는 바로 메일로 (정산에 걸린 일이라 하루 요약을 기다리지 않는다)
  await logEvent(rfq.id, "contract", byOperator ? "운영자가 의뢰자 대신 계약 이의 기록" : "의뢰자가 계약 내용 이의", note, s.userId);
  await notifyUsers(
    await adminUserIds(),
    { kind: "계약", title: `${rfq.rfq_no} 계약 보고에 의뢰자 이의 · ${award.cro_name}`, body: `기관 보고: ${summary}\n의뢰자: ${note}\n수주·계약 화면에서 기관과 확인한 뒤 정리해 주세요. 정리 전에는 정산하지 않습니다.`, href: "/admin/awards" },
    { to: adminEmails() },
  );
  // 기관에는 이의가 있었다는 사실만 알린다 (운영자가 연락해 확인한다)
  await notifyUsers(await orgMembers(), { kind: "계약", title: `${rfq.rfq_no} 의뢰자가 계약 보고 내용을 확인 중입니다`, body: "보고하신 계약 내용에 의뢰자가 다른 점을 알려 왔습니다. 단추 운영자가 연락드려 함께 확인합니다.", href: "/cro/awards" });
  return NextResponse.json({ ok: true });
}
