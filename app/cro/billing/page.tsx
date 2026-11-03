import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { getSupabaseAdmin } from "@/lib/supabase";
import { INVOICE_VIEW_LABEL, invoiceView } from "@/lib/invoices";
import { PAID_FROM } from "@/lib/billing";
import type { BillingInvoiceRow } from "@/lib/db-types";
import { comma, todaySeoul, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const PILL: Record<string, string> = { issued: "pill--sf", overdue: "pill--warn", paid: "pill--ok", void: "pill--sf" };

/** 기관 청구서 목록 (0032). 취소한 청구서는 보이지 않는다 */
export default async function CroBilling() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const sb = dbReady() ? getSupabaseAdmin() : null;
  const { data, error } = sb
    ? await sb.from("billing_invoices").select("id, invoice_no, month, total, due_date, status, paid_on").eq("org_id", org.id).neq("status", "void").order("month", { ascending: false })
    : { data: [], error: null };
  const list = (data ?? []) as Pick<BillingInvoiceRow, "id" | "invoice_no" | "month" | "total" | "due_date" | "status" | "paid_on">[];
  const today = todaySeoul();
  const [y, m] = PAID_FROM.split("-").map(Number);

  return (
    <>
      <div className="ph">
        <div>
          <h1>청구</h1>
          <p>매달 마감 뒤 지난달 이용료 청구서가 와요. 청구는 {y}년 {m}월 1일부터예요.</p>
        </div>
      </div>
      {error ? (
        <div className="note note--warn" role="alert">청구서를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <b>아직 청구서가 없어요</b>
          청구서가 나오면 이메일과 알림으로 알려요.
        </div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead>
              <tr>
                <th>청구 달</th>
                <th>번호</th>
                <th className="tnum">합계 (부가세 포함)</th>
                <th>납부 기한</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => {
                const v = invoiceView(x, today);
                return (
                  <tr key={x.id}>
                    <td data-label="청구 달"><Link href={`/cro/billing/${x.id}`}>{Number(x.month.slice(0, 4))}년 {Number(x.month.slice(5, 7))}월</Link></td>
                    <td data-label="번호" className="tnum">{x.invoice_no}</td>
                    <td data-label="합계" className="tnum">{comma(x.total)}</td>
                    <td data-label="납부 기한" className="tnum">{ymd(x.due_date)}</td>
                    <td data-label="상태"><span className={`pill ${PILL[v]}`}>{INVOICE_VIEW_LABEL[v]}{x.status === "paid" && x.paid_on ? ` · ${ymd(x.paid_on)}` : ""}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
