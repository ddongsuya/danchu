import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";
import { CONTRACT_CONFIRM_ERRORS, resolveContractDispute } from "@/lib/rpc";

export const runtime = "nodejs";

/**
 * POST { resolution: 'confirm' | 'reject', note } — 운영자가 의뢰자의 계약 이의를 정리한다 (2026-10-20 결정 2, 0025 resolve_contract_dispute).
 * - confirm: 기관과 의뢰자에게 확인한 결과 보고가 맞다 → 운영자 확정(via operator), 요청 종료, 확정한 달에 정산.
 *   금액이나 체결일을 바로잡아야 하면 먼저 계약 정정(/api/awards/[id]/contract, 운영자)으로 고친 뒤 확정한다.
 * - reject: 보고가 맞지 않다 → 보고를 지우고 기관이 다시 보고한다 (요청은 기관 선택 단계로).
 * 사유는 필수(500자). 이전·이후 값과 사유는 DB 함수가 admin_audit 에 남긴다. 정리 전에는 자동 확정도 정산도 하지 않는다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s || s.profile.role !== "admin") return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { resolution?: unknown; note?: unknown };
  const resolution = b.resolution === "confirm" || b.resolution === "reject" ? b.resolution : null;
  if (!resolution) return NextResponse.json({ error: CONTRACT_CONFIRM_ERRORS.bad_resolution.message }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!note || note.length > 500) return NextResponse.json({ error: "정리한 내용을 500자 안에서 적어 주세요. 감사 기록에 남습니다." }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  const r = await resolveContractDispute(id, s.userId, resolution, note);
  if (!r.ok) {
    const e = CONTRACT_CONFIRM_ERRORS[r.code];
    return NextResponse.json({ error: e?.message ?? "정리하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: r.code }, { status: e?.status ?? 500 });
  }

  const members = async () => {
    if (!r.cro_org_id) return [] as string[];
    const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", r.cro_org_id);
    return (ms ?? []).map((m) => m.id);
  };
  if (resolution === "confirm") {
    await logEvent(r.rfq_id, "closed", `계약 이의 정리 · 운영자 확정 · 종료`, `${won(r.contract_amount ?? 0)} · ${note}`, s.userId, { resolution });
    if (r.user_id) await notifyUsers([r.user_id], { kind: "계약", title: `${r.rfq_no} 계약 내용 확인을 마쳤습니다`, body: `단추가 기관과 확인해 계약을 확정했습니다. ${note}`, href: `/app/r/${r.rfq_no}` });
    await notifyUsers(await members(), { kind: "계약", title: `${r.rfq_no} 계약이 확정되었습니다`, body: "의뢰자 이의를 단추가 확인해 정리했습니다. 요청을 마쳤습니다.", href: "/cro/awards" });
    return NextResponse.json({ ok: true, message: "보고 내용대로 확정하고 요청을 마쳤습니다." });
  }
  await logEvent(r.rfq_id, "contract", `계약 이의 정리 · 보고 취소`, note, s.userId, { resolution });
  if (r.user_id) await notifyUsers([r.user_id], { kind: "계약", title: `${r.rfq_no} 계약 보고를 다시 받습니다`, body: `알려 주신 내용을 기관과 확인했습니다. 기관이 계약 내용을 다시 보고하면 그때 확인해 주세요. ${note}`, href: `/app/r/${r.rfq_no}` });
  await notifyUsers(await members(), { kind: "계약", title: `${r.rfq_no} 계약 내용을 다시 보고해 주세요`, body: `의뢰자 이의를 확인한 결과 보고 내용을 취소했습니다. 실제 체결일과 계약금액으로 다시 보고해 주세요. ${note}`, href: "/cro/awards" });
  return NextResponse.json({ ok: true, message: "보고를 취소했습니다. 기관이 다시 보고합니다." });
}
