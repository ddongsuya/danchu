import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { CONTRACT_STATUS_LABEL, parseContractStatus } from "@/lib/concierge";

export const runtime = "nodejs";

/**
 * POST { status: 'pending'|'negotiating'|'not_signed', note? } — 운영자가 선정 뒤 계약 진행 상태를 기록한다.
 * 체결(signed)은 체결일·금액과 함께 계약 보고 경로(/api/awards/[id]/contract, report_contract)로만 기록한다.
 * 체결이 보고된 수주는 여기서 되돌리지 않는다 (DB 제약: signed ⇔ 체결 보고 있음).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  const { data: a } = await sb.from("rfq_awards").select("id, rfq_id, cro_name, contract_status, contract_reported_at, contract_note").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ error: "수주 기록이 없습니다." }, { status: 404 });

  const parsed = parseContractStatus(await req.json().catch(() => null), !!a.contract_reported_at);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: a.contract_reported_at ? 409 : 400 });

  const { error } = await sb.from("rfq_awards").update({ contract_status: parsed.status, contract_note: parsed.note || null }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  const label = CONTRACT_STATUS_LABEL[parsed.status];
  const { data: rfq } = await sb.from("rfq_requests").select("rfq_no").eq("id", a.rfq_id).maybeSingle();
  await logEvent(a.rfq_id, "contract_status", `${a.cro_name} 계약 상태 · ${label}`, parsed.note || undefined, s.userId, { status: parsed.status });
  await audit({ userId: s.userId, email: s.email }, "award.contract_status", { type: "rfq_award", id, label: `${rfq?.rfq_no ?? ""} · ${a.cro_name}` }, { before: { contract_status: a.contract_status, contract_note: a.contract_note }, after: { contract_status: parsed.status, contract_note: parsed.note || null } });
  return NextResponse.json({ ok: true, message: `계약 상태를 '${label}'(으)로 기록했습니다.` });
}
