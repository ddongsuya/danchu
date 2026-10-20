import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { ADJUSTMENT_CREDIT_ONLY_NOTE, parseAdjustmentAmount } from "@/lib/billing";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * POST { month: 'YYYY-MM', orgId, amount, reason, correctsMonth?: 'YYYY-MM' }: 청구 조정 항목 넣기 (0024 add_billing_adjustment).
 * 열린 달에만 넣는다. 금액은 원 단위 정수로, 돌려드리는 금액(음수)만 된다 (2026-10-21 결정, 0026). 0 과 양수는 안 됨. 사유는 필수,
 * 바로잡는 달은 적용 월보다 앞선 마감한 달만. 그 달을 마감하면 바꾸거나 지울 수 없다 (DB 트리거).
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { month?: unknown; orgId?: unknown; amount?: unknown; reason?: unknown; correctsMonth?: unknown };

  const month = typeof b.month === "string" && MONTH.test(b.month) ? b.month : "";
  if (!month) return NextResponse.json({ error: "적용할 달을 확인해 주세요.", field: "month" }, { status: 400 });
  const orgId = typeof b.orgId === "string" && UUID.test(b.orgId) ? b.orgId : "";
  if (!orgId) return NextResponse.json({ error: "기관을 골라 주세요.", field: "orgId" }, { status: 400 });
  const amount = parseAdjustmentAmount(b.amount);
  if (amount == null) return NextResponse.json({ error: "돌려드릴 금액을 원 단위 숫자로 적어 주세요. 0원은 넣을 수 없습니다.", field: "amount" }, { status: 400 });
  if (amount > 0) return NextResponse.json({ error: ADJUSTMENT_CREDIT_ONLY_NOTE, code: "credit_only", field: "amount" }, { status: 400 });
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "조정 사유를 적어 주세요.", field: "reason" }, { status: 400 });
  if (reason.length > 300) return NextResponse.json({ error: "사유는 300자 안으로 적어 주세요.", field: "reason" }, { status: 400 });
  const corrects = b.correctsMonth == null || b.correctsMonth === "" ? null : typeof b.correctsMonth === "string" && MONTH.test(b.correctsMonth) ? b.correctsMonth : undefined;
  if (corrects === undefined) return NextResponse.json({ error: "바로잡는 달을 확인해 주세요.", field: "correctsMonth" }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });
  const { data, error } = await sb.rpc("add_billing_adjustment", {
    p_org: orgId,
    p_month: `${month}-01`,
    p_amount: amount,
    p_reason: reason,
    p_corrects: corrects ? `${corrects}-01` : null,
    p_actor: s.userId,
  });
  if (error) return NextResponse.json({ error: "조정 항목을 넣지 못했습니다. 0024 마이그레이션이 적용됐는지 확인해 주세요." }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; code?: string; id?: string; org_name?: string };
  if (!res.ok) {
    switch (res.code) {
      case "closed":
        return NextResponse.json({ error: `${month}은 마감한 달이라 조정 항목을 넣을 수 없습니다. 다음 열린 달에 넣어 주세요.`, code: "closed" }, { status: 409 });
      case "corrects":
        return NextResponse.json({ error: "바로잡는 달은 이 달보다 앞선 마감한 달이어야 합니다.", code: "corrects", field: "correctsMonth" }, { status: 409 });
      case "not_found":
        return NextResponse.json({ error: "기관을 찾을 수 없습니다.", code: "not_found", field: "orgId" }, { status: 404 });
      case "amount":
        return NextResponse.json({ error: "0원은 넣을 수 없습니다.", code: "amount", field: "amount" }, { status: 400 });
      case "credit_only":
        return NextResponse.json({ error: ADJUSTMENT_CREDIT_ONLY_NOTE, code: "credit_only", field: "amount" }, { status: 400 });
      case "reason":
        return NextResponse.json({ error: "조정 사유를 적어 주세요.", code: "reason", field: "reason" }, { status: 400 });
      default:
        return NextResponse.json({ error: "조정 항목을 넣지 못했습니다." }, { status: 500 });
    }
  }

  await audit(
    { userId: s.userId, email: s.email },
    "billing.adjust",
    { type: "billing_period", id: null, label: month },
    { after: { adjustment_id: res.id ?? null, org_id: orgId, org_name: res.org_name ?? null, amount, corrects_month: corrects }, note: reason },
  );
  return NextResponse.json({ ok: true, id: res.id, message: `${month} 명세에 ${res.org_name ?? "기관"} 조정 항목을 넣었습니다.` });
}
