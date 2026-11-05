import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { deliverInvoice } from "@/lib/invoices";
import type { BillingInvoiceRow } from "@/lib/db-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * POST { month: 'YYYY-MM', send?: boolean }: 마감한 달의 청구서 발행 (0032 issue_billing_invoices).
 * 기관마다 1장, 합계가 0원보다 큰 기관만. 이미 있으면 건너뛴다. send 가 true 면 아직 보내지 않은 그 달 청구서를 모두 보낸다.
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { month?: unknown; send?: unknown };
  const month = typeof b.month === "string" && MONTH.test(b.month) ? b.month : "";
  if (!month) return NextResponse.json({ error: "청구할 달을 확인해 주세요.", field: "month" }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const { data, error } = await sb.rpc("issue_billing_invoices", { p_month: `${month}-01`, p_actor: s.userId });
  if (error) return NextResponse.json({ error: "청구서를 만들지 못했습니다. 0032 마이그레이션이 적용됐는지 확인해 주세요." }, { status: 500 });
  const res = (data ?? {}) as { ok?: boolean; code?: string; issued?: number; skipped?: number };
  if (!res.ok) {
    if (res.code === "not_closed") return NextResponse.json({ error: `${month}은 아직 마감하지 않았습니다. 청구 명세에서 먼저 마감해 주세요.`, code: "not_closed" }, { status: 409 });
    return NextResponse.json({ error: "청구서를 만들지 못했습니다." }, { status: 500 });
  }
  await audit({ userId: s.userId, email: s.email }, "billing.invoice_issue", { type: "billing_period", id: null, label: month }, { after: { issued: res.issued ?? 0, skipped: res.skipped ?? 0 } });

  let sent = 0;
  let failed = 0;
  if (b.send === true) {
    const { data: rows, error: listError } = await sb.from("billing_invoices").select("*").eq("month", `${month}-01`).eq("status", "issued").is("sent_at", null);
    if (listError) return NextResponse.json({ error: "청구서는 만들었지만 보낼 목록을 읽지 못했습니다. 청구서 화면에서 한 장씩 보내 주세요." }, { status: 500 });
    for (const inv of (rows ?? []) as BillingInvoiceRow[]) {
      const r = await deliverInvoice(inv, "issued");
      if (r.mailed) sent++;
      else failed++;
    }
  }
  const parts = [`새로 만든 청구서 ${res.issued ?? 0}장`];
  if (res.skipped) parts.push(`이미 있던 ${res.skipped}장은 그대로 둠`);
  if (b.send === true) parts.push(`보냄 ${sent}장${failed ? `, 못 보냄 ${failed}장(받을 이메일 확인 필요)` : ""}`);
  return NextResponse.json({ ok: true, issued: res.issued ?? 0, skipped: res.skipped ?? 0, sent, failed, message: `${parts.join(" · ")}.` });
}
