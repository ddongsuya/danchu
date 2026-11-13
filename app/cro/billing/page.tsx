import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { PlanView, type OrgPlanState } from "@/components/cro/plan/PlanView";
import { getSupabaseAdmin } from "@/lib/supabase";
import { INVOICE_VIEW_LABEL, invoiceView } from "@/lib/invoices";
import { isPlanId, type PlanId } from "@/lib/plans";
import { quotesThisMonth, seatsUsed } from "@/lib/plan-usage";
import type { BillingInvoiceRow } from "@/lib/db-types";
import { comma, todaySeoul, ymd } from "@/lib/format";
import "@/components/cro/plan/plan.css";

export const dynamic = "force-dynamic";

const PILL: Record<string, string> = { issued: "pill--sf", overdue: "pill--warn", paid: "pill--ok", void: "pill--sf" };

/**
 * 기관 요금제·결제 (0044). 요금제 탭: 지금 요금제, 사용량, 요금제 고르기. 청구서 탭: 월 청구서 목록 (0032, 취소한 청구서는 빼고).
 * 휴대폰에서 한 화면에 들어가도록 두 탭으로 나눈다
 */
export default async function CroBilling({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const tab = (await searchParams).tab === "invoices" ? "invoices" : "plan";
  const today = todaySeoul();
  const orgPlan: OrgPlanState = {
    plan: (isPlanId(org.plan) ? org.plan : "free") as PlanId,
    plan_next: (isPlanId(org.plan_next) ? org.plan_next : null) as PlanId | null,
    plan_next_from: org.plan_next_from ?? null,
  };

  return (
    <div className="pln">
      <div className="ph">
        <div><h1>요금제·결제</h1></div>
      </div>
      <nav className="pln-tabs" aria-label="요금제·결제">
        <Link href="/cro/billing" aria-current={tab === "plan" ? "page" : undefined}>요금제</Link>
        <Link href="/cro/billing?tab=invoices" aria-current={tab === "invoices" ? "page" : undefined}>청구서</Link>
      </nav>
      {tab === "plan" ? <PlanTab orgId={org.id} org={orgPlan} today={today} owner={s.profile.org_role === "owner" && !s.demo} /> : <Invoices orgId={org.id} today={today} />}
    </div>
  );
}

async function PlanTab({ orgId, org, today, owner }: { orgId: string; org: OrgPlanState; today: string; owner: boolean }) {
  const [seats, sent] = dbReady() ? await Promise.all([seatsUsed(orgId), quotesThisMonth(orgId)]) : [1, 0];
  return <PlanView org={org} today={today} seats={seats} sent={sent} owner={owner} />;
}

async function Invoices({ orgId, today }: { orgId: string; today: string }) {
  const sb = dbReady() ? getSupabaseAdmin() : null;
  const { data, error } = sb
    ? await sb.from("billing_invoices").select("id, invoice_no, month, total, due_date, status, paid_on").eq("org_id", orgId).neq("status", "void").order("month", { ascending: false })
    : { data: [], error: null };
  const list = (data ?? []) as Pick<BillingInvoiceRow, "id" | "invoice_no" | "month" | "total" | "due_date" | "status" | "paid_on">[];
  if (error) return <div className="note note--warn" role="alert">청구서를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</div>;
  if (!list.length) return <div className="empty"><b>아직 청구서가 없어요</b>청구서가 나오면 이메일과 알림으로 알려요.</div>;
  return (
    <div className="card tbl-wrap">
      <table className="tbl tbl--stack">
        <thead>
          <tr><th>청구 달</th><th>번호</th><th className="tnum">합계 (부가세 포함)</th><th>납부 기한</th><th>상태</th></tr>
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
  );
}
