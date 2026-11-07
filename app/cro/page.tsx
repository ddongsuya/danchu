import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { TodayView } from "@/components/cro/crm/TodayView";
import { loadCtx } from "@/components/cro/crm/load";

export const dynamic = "force-dynamic";

/**
 * 오늘 (2026-11-07 CRM 1단계, 시안 v5 1번). 오늘 할 일(일정·할 일·단추 기한)과 손이 필요한 안건.
 * 옛 "견적 진행"은 /cro/requests (받은 요청). 예전 링크 /cro?sel= 는 그쪽으로 보낸다.
 */
export default async function CroToday({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  const { sel } = await searchParams;
  if (sel && /^[0-9a-f-]{36}$/.test(sel)) redirect(`/cro/requests?sel=${sel}`);
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <><div className="ph"><div><h1>오늘</h1></div></div><PendingOrg org={s.org} pendingOrg={s.pendingOrg} /></>;
  return <TodayView c={got.c} undecided={[...got.bundle.danchu.values()]} />;
}
