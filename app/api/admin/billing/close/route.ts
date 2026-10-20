import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { CLOSED_MONTH_NOTE } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * POST { month: 'YYYY-MM', closed: true, note? }: 청구 월 마감.
 * 마감하면 그 달 명세를 저장본(billing_periods.snapshot)으로 고정하고 청구 제외 토글이 막힌다 (close_billing_month).
 * 마감한 달은 다시 열 수 없다 (2026-10-20 결정, 0024). closed: false(마감 해제)는 409 로 거절하고, DB 트리거도 삭제를 막는다.
 * 돌려드릴 금액은 다음 열린 달에 조정 항목(/api/admin/billing/adjustments)으로 넣는다. 적게 받은 금액은 다시 청구하지 않는다 (0026).
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { month?: unknown; closed?: unknown; note?: unknown };
  if (b.closed === false) return NextResponse.json({ error: CLOSED_MONTH_NOTE, code: "reopen_refused" }, { status: 409 });
  const month = typeof b.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(b.month) ? `${b.month}-01` : "";
  if (!month || b.closed !== true) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const { data, error } = await sb.rpc("close_billing_month", { p_month: month, p_actor: s.userId, p_note: note });
  if (error) return NextResponse.json({ error: "마감하지 못했습니다. 0024 마이그레이션이 적용됐는지 확인해 주세요." }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; already?: boolean; code?: string };
  const label = month.slice(0, 7);
  if (res.already) return NextResponse.json({ error: `${label}은 이미 마감했습니다. 저장한 명세는 바꾸지 않습니다.`, code: "already_closed" }, { status: 409 });
  if (res.code === "not_ended") return NextResponse.json({ error: `${label}은 아직 끝나지 않아 마감할 수 없습니다. 다음 달 1일부터 마감해 주세요.`, code: "not_ended" }, { status: 409 });
  if (!res.ok) return NextResponse.json({ error: "마감하지 못했습니다." }, { status: 500 });

  await audit({ userId: s.userId, email: s.email }, "billing.close", { type: "billing_period", id: null, label }, { after: { closed: true }, note: note || undefined });
  return NextResponse.json({ ok: true, message: `${label} 청구를 마감했습니다. 마감한 달은 다시 열 수 없습니다.` });
}
