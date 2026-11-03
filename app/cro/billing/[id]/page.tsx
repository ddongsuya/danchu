import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { bankInfo, INVOICE_VIEW_LABEL, invoiceItems, invoiceView } from "@/lib/invoices";
import type { BillingInvoiceRow } from "@/lib/db-types";
import { comma, todaySeoul, ymd } from "@/lib/format";
import { PrintButton } from "@/components/cro/PrintButton";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const muted = { fontSize: 12, color: "var(--muted)" } as const;

/**
 * 청구서 1장 (0032). 기관 담당자는 자기 기관 것만, 운영자는 모두 본다.
 * "PDF로 저장"은 브라우저 인쇄로 저장한다 (인쇄할 때는 메뉴를 숨기고 청구서만 남긴다, portal.css @media print)
 */
export default async function CroInvoice({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  if (!UUID.test(id) || !dbReady()) notFound();
  const sb = getSupabaseAdmin()!;
  const { data } = await sb.from("billing_invoices").select("*").eq("id", id).maybeSingle();
  const inv = data as BillingInvoiceRow | null;
  const admin = s.profile.role === "admin";
  if (!inv || (!admin && (inv.org_id !== s.org?.id || inv.status === "void"))) notFound();

  const v = invoiceView(inv, todaySeoul());
  const items = invoiceItems(inv);
  const bank = bankInfo();
  const lines = inv.detail.lines ?? [];
  const settled = (inv.detail.awards ?? []).filter((a) => a.kind === "settlement");
  const label = `${Number(inv.month.slice(0, 4))}년 ${Number(inv.month.slice(5, 7))}월`;

  return (
    <>
      <div className="ph noprint">
        <div>
          <Link href="/cro/billing" style={muted}>청구 목록</Link>
          <h1>{label} 이용료 청구서</h1>
        </div>
        <div className="ph__actions"><PrintButton /></div>
      </div>

      <article className="card invoice" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={muted}>청구서 번호</div>
            <div className="tnum" style={{ fontWeight: 600 }}>{inv.invoice_no}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{inv.org_name} 귀중</div>
          </div>
          <dl className="invoice__meta">
            <div><dt>발행일</dt><dd className="tnum">{ymd(inv.issued_at)}</dd></div>
            <div><dt>납부 기한</dt><dd className="tnum">{ymd(inv.due_date)}</dd></div>
            <div><dt>상태</dt><dd>{INVOICE_VIEW_LABEL[v]}{inv.status === "paid" && inv.paid_on ? ` (${ymd(inv.paid_on)})` : ""}</dd></div>
          </dl>
        </header>

        {inv.status === "void" && <div className="note note--warn">취소한 청구서예요. 사유: {inv.void_reason}</div>}

        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 0 }}>
            <thead><tr><th>항목</th><th className="tnum" style={{ textAlign: "right" }}>금액</th></tr></thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={n}><td>{i.label}<span style={{ ...muted, display: "block" }}>{i.note}</span></td><td className="tnum" style={{ textAlign: "right" }}>{comma(i.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>공급가액</td><td className="tnum" style={{ textAlign: "right" }}>{comma(inv.supply_amount)}</td></tr>
              <tr><td>부가세 (10%)</td><td className="tnum" style={{ textAlign: "right" }}>{comma(inv.vat)}</td></tr>
              <tr><td style={{ fontSize: 17 }}>합계</td><td className="tnum" style={{ textAlign: "right", fontSize: 17 }}>{comma(inv.total)}</td></tr>
            </tfoot>
          </table>
        </div>

        {inv.status !== "paid" && inv.status !== "void" && (
          <div className="note note--tint" style={{ flexDirection: "column", gap: 4 }}>
            <b style={{ fontWeight: 600 }}>입금 안내</b>
            {bank ? (
              <span>{bank.bank} {bank.account} (예금주 {bank.holder}). 입금자명에 청구서 번호 {inv.invoice_no}를 적어 주세요.</span>
            ) : (
              <span>입금 계좌는 청구서 메일 회신으로 따로 알려요.</span>
            )}
          </div>
        )}

        {lines.length > 0 && (
          <section>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>견적서 송부 비용 내역</h2>
            <div className="tbl-wrap">
              <table className="tbl tbl--stack">
                <thead><tr><th>요청</th><th>제출일</th><th className="tnum">견적 금액</th><th className="tnum">송부 비용</th></tr></thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.quote_id}>
                      <td data-label="요청" className="tnum">{l.rfq_no}</td>
                      <td data-label="제출일" className="tnum">{ymd(l.billing_at ?? l.first_submitted_at)}</td>
                      <td data-label="견적 금액" className="tnum">{comma(l.total_amount ?? 0)}</td>
                      <td data-label="송부 비용" className="tnum">{comma(l.fee_due ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {settled.length > 0 && (
          <section>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>계약 성사 수수료 내역</h2>
            <div className="tbl-wrap">
              <table className="tbl tbl--stack">
                <thead><tr><th>요청</th><th>계약 확정일</th><th className="tnum">계약 금액</th><th className="tnum">요율</th><th className="tnum">수수료</th></tr></thead>
                <tbody>
                  {settled.map((a) => (
                    <tr key={a.award_id}>
                      <td data-label="요청" className="tnum">{a.rfq_no}</td>
                      <td data-label="계약 확정일" className="tnum">{ymd(a.contract_confirmed_at ?? a.contract_reported_at)}</td>
                      <td data-label="계약 금액" className="tnum">{comma(a.contract_amount ?? 0)}</td>
                      <td data-label="요율" className="tnum">{a.fee_rate == null ? "-" : `${Math.round(a.fee_rate * 10000) / 100}%`}</td>
                      <td data-label="수수료" className="tnum">{comma(a.fee ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p style={{ ...muted, margin: 0 }}>금액은 {label} 마감 명세 기준이에요. 금액이 맞지 않으면 청구서 메일에 회신해 주세요. 확인 후 다음 달 청구에서 바로잡아요.</p>
      </article>
    </>
  );
}
