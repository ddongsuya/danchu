import type { BillingInvoiceRow } from "./db-types";
import { esc, mailWrap, sendMail } from "./mail";
import { notifyUsers, operatorReplyTo, siteUrl } from "./notify";
import { getSupabaseAdmin } from "./supabase";
import { captureError } from "./observe";

/**
 * 월 청구서 (0032). 마감한 달의 명세로 기관마다 1장 만든다.
 * 금액 = 공급가액(그 달 합계) + 부가세 10%. 납부 기한은 발행일 + 14일. 계좌 이체 후불이고, 입금 확인은 운영자가 한다.
 * 알림은 세 곳으로 간다: 청구서 받을 이메일, 기관 담당자 계정 이메일, 기관 화면 알림.
 */

export const INVOICE_DUE_DAYS = 14;
export const VAT_RATE = 0.1;

export function vatOf(supply: number): number {
  return Math.round(supply * VAT_RATE);
}

export type InvoiceView = "issued" | "overdue" | "paid" | "void";

/** 화면 상태. 기한 지남은 저장하지 않고 오늘(서울)과 비교한다 */
export function invoiceView(inv: Pick<BillingInvoiceRow, "status" | "due_date">, today: string): InvoiceView {
  if (inv.status === "paid") return "paid";
  if (inv.status === "void") return "void";
  return inv.due_date < today ? "overdue" : "issued";
}

export const INVOICE_VIEW_LABEL: Record<InvoiceView, string> = {
  issued: "납부 대기",
  overdue: "기한 지남",
  paid: "입금 확인",
  void: "취소",
};

/** 날짜 차이 (b - a, 일) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * 독촉 단계. 1 = 기한 3일 전, 2 = 기한 다음 날, 3 = 기한 7일 뒤, 4 = 기한 30일 뒤(운영자에게도 알림).
 * 오늘 보낼 단계가 이미 보낸 단계보다 높을 때만 그 단계를 돌려준다
 */
export function reminderStageFor(dueDate: string, today: string, sentStage: number): 0 | 1 | 2 | 3 | 4 {
  const d = daysBetween(dueDate, today);
  const stage = d >= 30 ? 4 : d >= 7 ? 3 : d >= 1 ? 2 : d >= -3 ? 1 : 0;
  return stage > sentStage ? (stage as 0 | 1 | 2 | 3 | 4) : 0;
}

/** 입금 계좌 (환경변수). 비어 있으면 청구서에 "운영자가 따로 안내" 문구 */
export function bankInfo(): { bank: string; account: string; holder: string } | null {
  const bank = (process.env.BILLING_BANK_NAME || "").trim();
  const account = (process.env.BILLING_BANK_ACCOUNT || "").trim();
  const holder = (process.env.BILLING_BANK_HOLDER || "").trim();
  return bank && account && holder ? { bank, account, holder } : null;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const monthLabel = (m: string) => `${Number(m.slice(0, 4))}년 ${Number(m.slice(5, 7))}월`;
const dayLabel = (d: string) => `${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

/** 청구서 항목 (화면·메일 공통). 0원 항목은 뺀다 */
export function invoiceItems(inv: Pick<BillingInvoiceRow, "detail">): { label: string; note: string; amount: number }[] {
  const s = inv.detail.summary;
  const items: { label: string; note: string; amount: number }[] = [];
  if (s?.monthly_fee) items.push({ label: "월 구독료", note: "5,000만 원 미만 견적 발송 포함", amount: s.monthly_fee });
  const lines = inv.detail.lines ?? [];
  if (lines.length) items.push({ label: "견적서 송부 비용", note: `5,000만 원 이상 견적 ${lines.length}건`, amount: lines.reduce((t, l) => t + (l.fee_due ?? 0), 0) });
  const settled = (inv.detail.awards ?? []).filter((a) => a.kind === "settlement");
  if (settled.length) items.push({ label: "계약 성사 수수료", note: `확정된 계약 ${settled.length}건`, amount: settled.reduce((t, a) => t + (a.fee ?? 0), 0) });
  for (const a of inv.detail.adjustments ?? []) items.push({ label: "조정", note: a.reason, amount: a.amount });
  return items;
}

type MailKind = "issued" | "resend" | "reminder_before" | "overdue";

/** 청구서 메일 본문 (해요체) */
export function invoiceMail(inv: BillingInvoiceRow, kind: MailKind): { subject: string; html: string } {
  const link = `${siteUrl()}/cro/billing/${inv.id}`;
  const bank = bankInfo();
  const m = monthLabel(inv.month);
  const subject = {
    issued: `[단추] ${m} 이용료 청구서 (${inv.invoice_no})`,
    resend: `[단추] ${m} 이용료 청구서를 다시 보내요 (${inv.invoice_no})`,
    reminder_before: `[단추] ${m} 이용료 납부 기한이 3일 남았어요`,
    overdue: `[단추] ${m} 이용료 납부 기한이 지났어요`,
  }[kind];
  const lead = {
    issued: `${esc(inv.org_name)}의 ${m} 단추 이용료 청구서예요.`,
    resend: `${esc(inv.org_name)}의 ${m} 단추 이용료 청구서를 다시 보내요.`,
    reminder_before: `${m} 이용료 납부 기한이 ${dayLabel(inv.due_date)}이에요. 이미 보내셨다면 이 메일은 넘기셔도 돼요.`,
    overdue: `${m} 이용료 납부 기한(${dayLabel(inv.due_date)})이 지났어요. 확인 후 입금해 주세요. 이미 보내셨다면 입금일을 회신해 주세요.`,
  }[kind];
  const rows = invoiceItems(inv)
    .map((i) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #e9e9e4">${esc(i.label)}<br><span style="font-size:12px;color:#61615c">${esc(i.note)}</span></td><td style="padding:8px 10px;border-bottom:1px solid #e9e9e4;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${won(i.amount)}</td></tr>`)
    .join("");
  const total = `
    <tr><td style="padding:8px 10px;color:#61615c">공급가액</td><td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${won(inv.supply_amount)}</td></tr>
    <tr><td style="padding:8px 10px;color:#61615c">부가세 (10%)</td><td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">${won(inv.vat)}</td></tr>
    <tr><td style="padding:10px;font-weight:700;border-top:2px solid #1b1b19">합계</td><td style="padding:10px;text-align:right;font-weight:700;border-top:2px solid #1b1b19;font-variant-numeric:tabular-nums">${won(inv.total)}</td></tr>`;
  const pay = bank
    ? `<p style="margin:16px 0 0">입금 계좌: <b>${esc(bank.bank)} ${esc(bank.account)}</b> (예금주 ${esc(bank.holder)})<br>입금자명에 청구서 번호 <b>${esc(inv.invoice_no)}</b>를 적어 주세요.</p>`
    : `<p style="margin:16px 0 0">입금 계좌는 운영자가 이 메일 회신으로 따로 알려요.</p>`;
  const html = mailWrap(`
    <h2 style="margin:0 0 12px;font-size:20px">${m} 이용료 청구서</h2>
    <p>${lead}</p>
    <p style="font-size:13px;color:#61615c;margin:0 0 8px">청구서 번호 ${esc(inv.invoice_no)} · 납부 기한 ${dayLabel(inv.due_date)}</p>
    <table style="border-collapse:collapse;font-size:14px;width:100%;margin:8px 0">${rows}${total}</table>
    ${pay}
    <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#1b1b19;color:#f4f4f0;text-decoration:none;padding:13px 22px;border-radius:2px;font-weight:600;font-size:15px">청구서 보기</a></p>
    <p style="font-size:13px;color:#61615c">견적별 내역은 청구서 화면에서 볼 수 있고, PDF로 저장할 수 있어요. 금액이 맞지 않으면 이 메일에 회신해 주세요.</p>`);
  return { subject, html };
}

/** 받는 사람: 청구서 이메일(없으면 대표 이메일) + 기관 담당자 계정. 담당자 ID 는 화면 알림용 */
export async function invoiceRecipients(orgId: string): Promise<{ emails: string[]; userIds: string[] }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { emails: [], userIds: [] };
  const [{ data: org }, { data: members }] = await Promise.all([
    sb.from("cro_orgs").select("contact_email, billing_email").eq("id", orgId).maybeSingle(),
    sb.from("profiles").select("id, email").eq("cro_org_id", orgId),
  ]);
  const o = org as { contact_email: string | null; billing_email?: string | null } | null;
  const first = (o?.billing_email || o?.contact_email || "").trim();
  const emails = [...new Set([first, ...(members ?? []).map((m) => (m.email ?? "").trim())].filter(Boolean).map((e) => e.toLowerCase()))];
  return { emails, userIds: (members ?? []).map((m) => m.id) };
}

/**
 * 청구서 보내기: 메일 + 기관 화면 알림. 보낸 기록(mark_invoice_sent)은 메일이 한 통이라도 나갔을 때만 남긴다.
 * 돌려주는 값: 메일이 나갔는지와 받는 사람 수
 */
export async function deliverInvoice(inv: BillingInvoiceRow, kind: MailKind): Promise<{ mailed: boolean; to: number }> {
  const { emails, userIds } = await invoiceRecipients(inv.org_id);
  const { subject, html } = invoiceMail(inv, kind);
  // 청구서는 수신 거부 설정과 상관없이 보낸다 (서비스 이용 계약상 고지). 화면 알림은 늘 남긴다
  const mailed = emails.length ? await sendMail({ to: emails, subject, html, replyTo: operatorReplyTo() }) : false;
  const title = kind === "overdue" ? `${monthLabel(inv.month)} 이용료 납부 기한이 지났어요` : kind === "reminder_before" ? `${monthLabel(inv.month)} 이용료 납부 기한이 3일 남았어요` : `${monthLabel(inv.month)} 이용료 청구서가 왔어요`;
  // 문자는 처음 발행과 기한 지남에만 (다시 보내기·3일 전 안내는 메일과 사이트 알림만)
  const sms = kind === "issued" || kind === "overdue"
    ? { kind: "invoice" as const, text: `${monthLabel(inv.month)} 이용료 ${kind === "overdue" ? "납부 기한이 지났어요" : "청구서가 나왔어요"}. 합계 ${won(inv.total)}, 기한 ${inv.due_date}. ${siteUrl()}/cro/billing/${inv.id}`, dedupeKey: `invoice:${inv.id}:${kind}:${inv.reminder_stage}` }
    : undefined;
  await notifyUsers(userIds, { kind: "기관", title, body: `${inv.invoice_no} · 합계 ${won(inv.total)} · 기한 ${dayLabel(inv.due_date)}`, href: `/cro/billing/${inv.id}` }, undefined, sms);
  if (mailed && (kind === "issued" || kind === "resend")) {
    const sb = getSupabaseAdmin();
    const { error } = sb ? await sb.rpc("mark_invoice_sent", { p_id: inv.id }) : { error: null };
    if (error) captureError(error, "invoice:mark_sent", { invoice: inv.invoice_no });
  }
  return { mailed, to: emails.length };
}
