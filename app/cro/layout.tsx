import type { Metadata, Viewport } from "next";
import { requireSession } from "@/lib/auth";
import { dbReady, unreadCount } from "@/lib/data";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { PreregGate } from "@/components/app/Prereg";
import { PREREG_NAV_CRO } from "@/components/app/prereg-nav";
import { daysToPilot } from "@/lib/prereg";
import { sessionInPrereg } from "@/lib/prereg-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { croNav, croTier } from "@/lib/cro-nav";
import { PLANS, inPilotPeriod, monthlyQuoteLimit } from "@/lib/plans";
import { quotesThisMonth } from "@/lib/plan-usage";
import { todaySeoul } from "@/lib/format";

export const metadata: Metadata = {
  title: "단추 CRO",
  description: "배포된 견적 요청을 확인하고 단추 표준 양식으로 회신해요.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추 CRO" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function CroLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("cro", "/cro");
  const prereg = await sessionInPrereg(session);
  const unread = dbReady() && !prereg ? await unreadCount(session.userId) : 0;
  // 2026-11-13 요금제별 화면 구성 (lib/cro-nav.ts). 시범 운영 중에는 모두 Pro 구성이고 요금제 표시도 없다
  const today = todaySeoul();
  const tier = croTier(session.org, today);
  const built = croNav(tier, unread);
  const nav: NavItem[] = prereg ? [...PREREG_NAV_CRO] : built.nav;
  const tabs: NavItem[] | undefined = prereg ? undefined : built.tabs;
  const paid = !prereg && !inPilotPeriod(today) && session.org?.status === "approved";
  const limit = paid ? monthlyQuoteLimit(session.org, today) : null;
  const used = limit != null && dbReady() && session.org ? await quotesThisMonth(session.org.id) : 0;
  const usage = limit != null ? <span className={used >= limit ? "pt__usage--full" : undefined}>견적 {used} / {limit}건</span> : undefined;
  if (session.profile.role === "admin") nav.push({ href: "/admin", label: "운영자 콘솔", icon: "settings" });
  return (
    <AppState>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})()",
        }}
      />
      <Shell session={session} nav={nav} tabs={tabs} plan={paid ? PLANS[tier].name : undefined} usage={usage}>
        {prereg ? <PreregGate role="cro" days={daysToPilot()} reserved={await reserved(session.email)} hasOrg={!!(session.org || session.pendingOrg)}>{children}</PreregGate> : children}
      </Shell>
    </AppState>
  );
}


async function reserved(email: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { data } = await sb.from("early_signups").select("id").eq("role", "cro").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}
