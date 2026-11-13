import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { TodayView } from "@/components/cro/crm/TodayView";
import { loadCtx } from "@/components/cro/crm/load";
import { canUse } from "@/lib/plans";
import { todaySeoul } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 오늘 (2026-11-07 CRM 1단계, 시안 v5 1번). 오늘 할 일(일정·할 일·단추 기한)과 손이 필요한 안건.
 * 옛 "견적 진행"은 /cro/requests (받은 요청). 예전 링크 /cro?sel= 는 그쪽으로 보낸다.
 */
export default async function CroToday({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  const { sel } = await searchParams;
  if (sel && /^[0-9a-f-]{36}$/.test(sel)) redirect(`/cro/requests?sel=${sel}`);
  const s = await requireSession("cro");
  // 고객 관리가 없는 요금제(정식 서비스 뒤 무료·Plus)는 받은 요청이 첫 화면
  if (s.org?.status === "approved" && !canUse(s.org, "crm", todaySeoul())) redirect("/cro/requests");
  const got = await loadCtx(s);
  if (!got) return <><div className="ph"><div><h1>오늘</h1></div></div><PendingOrg org={s.org} pendingOrg={s.pendingOrg} /></>;
  return <TodayView c={got.c} undecided={[...got.bundle.danchu.values()]} />;
}
