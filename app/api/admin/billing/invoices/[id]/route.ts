import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { deliverInvoice } from "@/lib/invoices";
import { todaySeoul } from "@/lib/format";
import type { BillingInvoiceRow } from "@/lib/db-types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST { action: 'send' | 'paid' | 'void', paidOn?: 'YYYY-MM-DD', note?, reason? }
 * - send: 청구서 메일과 기관 화면 알림 (처음이면 발행 안내, 이미 보냈으면 다시 보냄)
 * - paid: 입금 확인. 입금일은 오늘 또는 그 전
 * - void: 취소. 사유 필수, 입금 확인한 청구서는 취소할 수 없다. 고칠 금액은 다음 열린 달 조정 항목으로
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "청구서를 찾을 수 없습니다." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { action?: unknown; paidOn?: unknown; note?: unknown; reason?: unknown };
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });
  const { data: row, error } = await sb.from("billing_invoices").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "청구서를 읽지 못했습니다." }, { status: 500 });
  const inv = row as BillingInvoiceRow | null;
  if (!inv) return NextResponse.json({ error: "청구서를 찾을 수 없습니다." }, { status: 404 });
  const actor = { userId: s.userId, email: s.email };
  const target = { type: "billing_invoice" as const, id: inv.id, label: `${inv.invoice_no} ${inv.org_name}` };

  if (b.action === "send") {
    if (inv.status === "void") return NextResponse.json({ error: "취소한 청구서는 보낼 수 없습니다.", code: "void" }, { status: 409 });
    const r = await deliverInvoice(inv, inv.sent_at ? "resend" : "issued");
    if (!r.mailed) return NextResponse.json({ error: r.to ? "메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요." : "받을 이메일이 없습니다. 기관 화면에서 청구서 이메일이나 대표 이메일을 먼저 넣어 주세요.", code: r.to ? "mail_failed" : "no_recipient" }, { status: 502 });
    await audit(actor, "billing.invoice_send", target, { after: { to: r.to, resend: !!inv.sent_at } });
    return NextResponse.json({ ok: true, message: `${inv.org_name}에 청구서를 보냈습니다 (${r.to}곳).` });
  }

  if (b.action === "paid") {
    const paidOn = typeof b.paidOn === "string" && DAY.test(b.paidOn) ? b.paidOn : "";
    if (!paidOn || paidOn > todaySeoul()) return NextResponse.json({ error: "입금일을 오늘이나 그 전 날짜로 적어 주세요.", field: "paidOn" }, { status: 400 });
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
    const { data, error: e } = await sb.rpc("mark_invoice_paid", { p_id: inv.id, p_actor: s.userId, p_paid_on: paidOn, p_note: note });
    if (e) return NextResponse.json({ error: "입금 확인을 저장하지 못했습니다." }, { status: 500 });
    const res = (data ?? {}) as { ok?: boolean; code?: string; already?: boolean };
    if (!res.ok) return NextResponse.json({ error: res.code === "void" ? "취소한 청구서입니다." : "입금일을 확인해 주세요.", code: res.code }, { status: 409 });
    if (!res.already) await audit(actor, "billing.invoice_paid", target, { after: { paid_on: paidOn, total: inv.total }, note: note || undefined });
    return NextResponse.json({ ok: true, message: res.already ? "이미 입금 확인한 청구서입니다." : `${inv.invoice_no} 입금을 확인했습니다.` });
  }

  if (b.action === "void") {
    const reason = typeof b.reason === "string" ? b.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "취소 사유를 적어 주세요.", field: "reason" }, { status: 400 });
    if (reason.length > 300) return NextResponse.json({ error: "사유는 300자 안으로 적어 주세요.", field: "reason" }, { status: 400 });
    const { data, error: e } = await sb.rpc("void_invoice", { p_id: inv.id, p_actor: s.userId, p_reason: reason });
    if (e) return NextResponse.json({ error: "취소를 저장하지 못했습니다." }, { status: 500 });
    const res = (data ?? {}) as { ok?: boolean; code?: string; already?: boolean };
    if (!res.ok) return NextResponse.json({ error: res.code === "paid" ? "입금 확인한 청구서는 취소할 수 없습니다. 돌려드릴 금액은 다음 달 조정 항목으로 넣어 주세요." : "취소하지 못했습니다.", code: res.code }, { status: 409 });
    if (!res.already) await audit(actor, "billing.invoice_void", target, { note: reason });
    return NextResponse.json({ ok: true, message: `${inv.invoice_no}을 취소했습니다. 같은 달 청구서를 다시 만들 수 있습니다.` });
  }

  return NextResponse.json({ error: "할 일을 골라 주세요.", field: "action" }, { status: 400 });
}
