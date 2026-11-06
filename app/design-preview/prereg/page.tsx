import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { PreregGate } from "@/components/app/Prereg";
import { PREREG_NAV_CRO, PREREG_NAV_REQ } from "@/components/app/prereg-nav";
import type { Role, Session } from "@/lib/auth";
import { daysToPilot } from "@/lib/prereg";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "사전예약 대기 화면 검토 · 단추", robots: { index: false, follow: false } };

/**
 * 사전예약 대기 화면 검토용 (로그인 없이). Vercel 미리보기 배포에서만 열린다. 실제 계정·데이터는 쓰지 않는다.
 * ?role=req|cro, ?reserved=1 이면 "사전예약 완료" 표시
 */
export default async function PreregPreview({ searchParams }: { searchParams: Promise<{ role?: string; reserved?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const cro = sp.role === "cro";
  const role: Role = cro ? "cro" : "requester";
  const session: Session = {
    userId: "prereg-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "prereg-preview", email: "preview@example.invalid", role, name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  return (
    <AppState>
      <Shell session={session} nav={cro ? PREREG_NAV_CRO : PREREG_NAV_REQ}>
        <PreregGate role={cro ? "cro" : "req"} days={daysToPilot()} reserved={sp.reserved === "1"}>{null}</PreregGate>
      </Shell>
    </AppState>
  );
}
