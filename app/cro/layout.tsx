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
  const nav: NavItem[] = prereg ? [...PREREG_NAV_CRO] : [
    // 2026-11-07 CRM 1단계 (시안 v5): 오늘 · 안건 · 고객사 · 보고서가 중심. 받은 요청(옛 견적 진행)은 견적 묶음으로, 단추 요청은 안건 보드에도 들어온다
    { href: "/cro", label: "오늘", icon: "today", exact: true },
    { href: "/cro/deals", label: "안건", icon: "deals" },
    { href: "/cro/clients", label: "고객사", icon: "clients" },
    { href: "/cro/reports", label: "보고서", icon: "report" },
    { href: "/cro/requests", label: "받은 요청", icon: "inbox", group: "견적" },
    { href: "/cro/docs", label: "견적서", icon: "quote", group: "견적" },
    { href: "/cro/catalog", label: "시험 목록", icon: "list", group: "견적" },
    { href: "/cro/calendar", label: "캘린더", icon: "calendar", group: "견적" },
    { href: "/cro/notifications", label: "알림", icon: "bell", badge: unread, group: "견적" },
    { href: "/cro/org", label: "기관", icon: "org", group: "설정" },
    { href: "/cro/billing", label: "청구", icon: "receipt", group: "설정" },
  ];
  // 휴대폰 아래 탭: 오늘 · 안건 · 기록 · 더보기 (나머지는 더보기 화면)
  const tabs: NavItem[] | undefined = prereg ? undefined : [
    { href: "/cro", label: "오늘", icon: "today", exact: true },
    { href: "/cro/deals", label: "안건", icon: "deals" },
    { href: "/cro/log", label: "기록", icon: "note" },
    { href: "/cro/more", label: "더보기", icon: "more", badge: unread },
  ];
  if (session.profile.role === "admin") nav.push({ href: "/admin", label: "운영자 콘솔", icon: "settings" });
  return (
    <AppState>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})()",
        }}
      />
      <Shell session={session} nav={nav} tabs={tabs}>
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
