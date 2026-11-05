import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { monthRangeOf } from "@/lib/billing";
import { bankInfo, INVOICE_VIEW_LABEL, invoiceView } from "@/lib/invoices";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { BillingInvoiceRow } from "@/lib/db-types";
import { comma, todaySeoul, ymd } from "@/lib/format";
import { InvoiceIssue, InvoiceActions } from "@/components/admin/InvoiceActions";

export const dynamic = "force-dynamic";

const muted = { fontSize: 12, color: "var(--muted)" } as const;
const PILL: Record<string, string> = { issued: "pill--sf", overdue: "pill--warn", paid: "pill--ok", void: "pill--sf" };

/**
 * 월 청구서 (0032). 마감한 달의 명세로 기관마다 1장 만들고, 메일·기관 화면 알림으로 보낸다.
 * 입금은 계좌 이체로 받고 운영자가 확인한다. 금액이 틀렸으면 취소하고 다음 열린 달 조정 항목으로 바로잡는다.
 * 기한이 지나면 예약 작업이 기한 3일 전, 다음 날, 7일 뒤, 30일 뒤에 안내 메일을 보낸다.
 */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSession("admin");
  const { month } = await searchParams;
  const r = monthRangeOf(month);
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const sb = getSupabaseAdmin()!;
  const [{ data: rows, error }, { data: period }, { data: open }] = await Promise.all([
    sb.from("billing_invoices").select("*").eq("month", r.from).order("issued_at", { ascending: true }),
    sb.from("billing_periods").select("month").eq("month", r.from).maybeSingle(),
    sb.from("billing_invoices").select("id, total, due_date").eq("status", "issued"),
  ]);
  const list = (rows ?? []) as BillingInvoiceRow[];
  const today = todaySeoul();
  const unpaid = (open ?? []) as Pick<BillingInvoiceRow, "id" | "total" | "due_date">[];
  const overdue = unpaid.filter((x) => x.due_date < today);
  const live = list.filter((x) => x.status !== "void");
  const notSent = live.filter((x) => x.status === "issued" && !x.sent_at).length;
  const bank = bankInfo();

  return (
    <>
      <div className="ph">
        <div>
          <h1>청구서</h1>
          <p>
            {r.label} · {live.length}장 · 합계 {comma(live.reduce((t, x) => t + x.total, 0))} (부가세 포함)
            {` · 전체 미납 ${unpaid.length}장 ${comma(unpaid.reduce((t, x) => t + x.total, 0))}`}
            {overdue.length ? ` · 기한 지남 ${overdue.length}장` : ""}
          </p>
        </div>
        <div className="ph__actions" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href={`/admin/invoices?month=${r.prev}`} className="b2">이전 달</Link>
          <Link href={`/admin/invoices?month=${r.next}`} className="b2">다음 달</Link>
          <Link href={`/admin/billing?month=${r.from.slice(0, 7)}`} className="b2">청구 명세</Link>
        </div>
      </div>

      {!bank && <div className="note note--warn" style={{ marginBottom: 12 }}>입금 계좌가 설정되지 않았습니다. Vercel 환경변수 BILLING_BANK_NAME, BILLING_BANK_ACCOUNT, BILLING_BANK_HOLDER 를 넣으면 청구서와 메일에 계좌가 나옵니다. 넣기 전에는 "운영자가 회신으로 안내"로 나갑니다.</div>}
      {error && <div className="note note--warn" role="alert" style={{ marginBottom: 12 }}>청구서를 불러오지 못했습니다. `0032_billing_invoices.sql` 이 적용됐는지 확인해 주세요. ({error.message})</div>}

      {!period ? (
        <div className="empty"><b>아직 마감하지 않은 달입니다</b>청구 명세에서 이 달을 마감하면 청구서를 만들 수 있습니다.</div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <InvoiceIssue month={r.from.slice(0, 7)} hasAny={list.length > 0} notSent={notSent} />
          </div>
          <div className="card tbl-wrap">
            {list.length === 0 ? (
              <p className="empty">이 달 청구서가 없습니다. 합계가 0원보다 큰 기관이 있으면 위 버튼으로 만듭니다.</p>
            ) : (
              <table className="tbl tbl--stack">
                <thead>
                  <tr>
                    <th>기관</th>
                    <th>번호</th>
                    <th className="tnum">공급가액</th>
                    <th className="tnum">합계 (부가세 포함)</th>
                    <th>기한</th>
                    <th>상태</th>
                    <th>보냄</th>
                    <th><span className="sr-only">처리</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((x) => {
                    const v = invoiceView(x, today);
                    return (
                      <tr key={x.id}>
                        <td data-label="기관">{x.org_name}</td>
                        <td data-label="번호" className="tnum"><Link href={`/cro/billing/${x.id}`}>{x.invoice_no}</Link></td>
                        <td data-label="공급가액" className="tnum">{comma(x.supply_amount)}</td>
                        <td data-label="합계" className="tnum">{comma(x.total)}</td>
                        <td data-label="기한" className="tnum">{ymd(x.due_date)}</td>
                        <td data-label="상태">
                          <span className={`pill ${PILL[v]}`}>{INVOICE_VIEW_LABEL[v]}</span>
                          {x.status === "paid" && <span style={{ ...muted, display: "block" }}>입금 {ymd(x.paid_on)}{x.paid_note ? ` · ${x.paid_note}` : ""}</span>}
                          {x.status === "void" && <span style={{ ...muted, display: "block" }}>사유: {x.void_reason}</span>}
                        </td>
                        <td data-label="보냄" className="tnum">{x.sent_at ? `${ymd(x.last_sent_at)} (${x.sent_count}회)` : "아직"}</td>
                        <td data-label="처리" className="tbl__act">{x.status === "issued" ? <InvoiceActions id={x.id} sent={!!x.sent_at} /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
