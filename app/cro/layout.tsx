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
  title: "단추 CRO · 견적 진행",
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
    // 2026-11-07: 받은 요청 · 제출한 견적 · 수주를 "견적 진행" 하나로 합침. /cro/quotes · /cro/awards 경로는 그대로 둔다 (상세 버튼이 연결)
    { href: "/cro", label: "견적 진행", icon: "inbox", exact: true },
    { href: "/cro/clients", label: "고객", icon: "clients" },
    { href: "/cro/docs", label: "견적서", icon: "quote" },
    { href: "/cro/catalog", label: "시험 목록", icon: "list" },
    { href: "/cro/notifications", label: "알림", icon: "bell", badge: unread },
    { href: "/cro/org", label: "기관", icon: "org" },
    { href: "/cro/billing", label: "청구", icon: "receipt" },
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
      <Shell session={session} nav={nav}>
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
