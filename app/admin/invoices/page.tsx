import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { monthRangeOf } from "@/lib/billing";
import { bankInfo, INVOICE_VIEW_LABEL, invoiceView } from "@/lib/invoices";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { BillingInvoiceRow, BillingSnapshot } from "@/lib/db-types";
import { comma, mmdd, nextDay, todaySeoul } from "@/lib/format";
import { InvoiceIssue, InvoiceActions } from "@/components/admin/InvoiceActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FilterChips } from "@/components/admin/Blocks";

export const dynamic = "force-dynamic";

const PILL: Record<string, string> = { issued: "pill--warn", overdue: "pill--err", paid: "pill--ok", void: "pill--sf" };
/** 납부 기한 = 발행일 + 14일 (lib/invoices.ts, 0032) */
const DUE_DAYS = 14;

/**
 * 월 청구서 (0032, 시안 검토판 a-inv). 마감한 달의 명세로 기관마다 1장 만들고, 메일·기관 화면 알림으로 보낸다.
 * 위 탭: 이번 달 · 지난 달 · 전체. 입금은 계좌 이체로 받고 운영자가 확인한다. 금액이 틀렸으면 취소하고 다음 열린 달 조정 항목으로 바로잡는다.
 */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSession("admin");
  const { month } = await searchParams;
  const all = month === "all";
  const r = monthRangeOf(all ? undefined : month);
  const cur = monthRangeOf(undefined);
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const sb = getSupabaseAdmin()!;
  const listQ = all
    ? sb.from("billing_invoices").select("*").order("issued_at", { ascending: false }).limit(300)
    : sb.from("billing_invoices").select("*").eq("month", r.from).order("issued_at", { ascending: true });
  const [{ data: rows, error }, { data: period }] = await Promise.all([
    listQ,
    all ? Promise.resolve({ data: null }) : sb.from("billing_periods").select("month, snapshot").eq("month", r.from).maybeSingle(),
  ]);
  const list = (rows ?? []) as BillingInvoiceRow[];
  const today = todaySeoul();
  const live = list.filter((x) => x.status !== "void");
  // 만들 청구서 수: 마감 저장본에서 합계가 0원보다 큰 기관 중 아직 청구서가 없는 곳
  const snap = (period?.snapshot ?? null) as BillingSnapshot | null;
  const haveOrg = new Set(live.map((x) => x.org_id));
  const toIssue = (snap?.summary ?? []).filter((x) => x.total_due > 0 && !haveOrg.has(x.org_id)).length;
  const due = Array.from({ length: DUE_DAYS }).reduce<string>((d) => nextDay(d), today);
  const bank = bankInfo();
  const tabs = [
    { href: "/admin/invoices", label: "이번 달", on: !all && r.from === cur.from },
    { href: `/admin/invoices?month=${cur.prev}`, label: "지난 달", on: !all && r.from.slice(0, 7) === cur.prev },
    { href: "/admin/invoices?month=all", label: "전체", on: all },
  ];

  return (
    <>
      <div className="ph">
        <div>
          <h1>청구서</h1>
          <p>{all ? "전체 달" : r.label}</p>
        </div>
        <div className="ph__actions">
          <Link href={`/admin/billing${all ? "" : `?month=${r.from.slice(0, 7)}`}`} className="b2">청구 명세</Link>
          {!all && period && toIssue > 0 && <InvoiceIssue month={r.from.slice(0, 7)} label={r.label} orgs={toIssue} due={due} />}
        </div>
      </div>
      <div className="adm-bar"><FilterChips label="청구 달" items={tabs} /></div>

      {!bank && <div className="note note--warn adm-note">입금 계좌가 설정되지 않았어요. 청구서에는 &ldquo;운영자가 회신으로 안내&rdquo;로 나가요.</div>}

      {error ? (
        <ErrorState title="청구서를 불러오지 못했어요" />
      ) : list.length === 0 ? (
        <EmptyState title={all ? "청구서가 없어요" : r.from === cur.from ? "이번 달 청구서가 없어요" : `${r.label} 청구서가 없어요`} action={<Link href={`/admin/billing${all ? "" : `?month=${r.from.slice(0, 7)}`}`} className="b2 bsm">청구 명세</Link>} />
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead>
              <tr>
                <th>기관</th>
                <th>번호</th>
                <th className="num">공급가액</th>
                <th className="num">합계 (부가세 포함)</th>
                <th>납부 기한</th>
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
                    <td data-label="공급가액" className="num">{comma(x.supply_amount)}</td>
                    <td data-label="합계" className="num">{comma(x.total)}</td>
                    <td data-label="납부 기한" className="tnum">{mmdd(x.due_date)}</td>
                    <td data-label="상태">
                      <span className={`pill ${PILL[v]}`}>{INVOICE_VIEW_LABEL[v]}</span>
                      {x.status === "paid" && <span className="adm-small adm-muted" style={{ display: "block" }}>입금 {mmdd(x.paid_on)}{x.paid_note ? ` · ${x.paid_note}` : ""}</span>}
                      {x.status === "void" && <span className="adm-small adm-muted" style={{ display: "block" }}>사유: {x.void_reason}</span>}
                    </td>
                    <td data-label="보냄" className="tnum">{x.sent_at ? mmdd(x.last_sent_at ?? x.sent_at) : "-"}</td>
                    <td data-label="처리" className="tbl__act">{x.status === "issued" ? <InvoiceActions id={x.id} sent={!!x.sent_at} org={x.org_name} no={x.invoice_no} /> : null}</td>
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
