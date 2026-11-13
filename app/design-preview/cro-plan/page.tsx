import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanView, type OrgPlanState } from "@/components/cro/plan/PlanView";
import { Frame } from "../cro-crm/frame";
import { previewEnabled } from "../cro-crm/fixtures";
import "@/components/cro/plan/plan.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "요금제·결제 검토 · 단추", robots: { index: false, follow: false } };

const SCENES: Record<string, { org: OrgPlanState; today: string; seats: number; sent: number }> = {
  pilot: { org: { plan: "free", plan_next: null, plan_next_from: null }, today: "2027-09-14", seats: 2, sent: 3 },
  reserved: { org: { plan: "free", plan_next: "pro", plan_next_from: "2028-01-01" }, today: "2027-09-14", seats: 2, sent: 3 },
  free: { org: { plan: "free", plan_next: null, plan_next_from: null }, today: "2028-03-14", seats: 1, sent: 5 },
  plus: { org: { plan: "plus", plan_next: null, plan_next_from: null }, today: "2028-03-14", seats: 3, sent: 12 },
  down: { org: { plan: "pro", plan_next: "plus", plan_next_from: "2028-04-01" }, today: "2028-03-14", seats: 3, sent: 12 },
};

/** 기관 요금제·결제 검토용 (?s=pilot|reserved|free|plus|down). 미리보기 배포에서만 열린다. 저장은 되지 않는다 */
export default async function CroPlanPreview({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (!previewEnabled()) notFound();
  const sc = SCENES[(await searchParams).s ?? "pilot"] ?? SCENES.pilot;
  return (
    <Frame>
      <div className="pln">
        <div className="ph"><div><h1>요금제·결제</h1></div></div>
        <nav className="pln-tabs" aria-label="요금제·결제"><a href="#" aria-current="page">요금제</a><a href="#">청구서</a></nav>
        <PlanView org={sc.org} today={sc.today} seats={sc.seats} sent={sc.sent} owner />
      </div>
    </Frame>
  );
}
