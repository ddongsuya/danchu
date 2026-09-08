import type { Metadata, Viewport } from "next";
import { requireSession } from "@/lib/auth";
import { dbReady, unreadCount } from "@/lib/data";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";

export const metadata: Metadata = {
  title: "단추 CRO — 받은 요청",
  description: "배포된 견적 요청을 확인하고 단추 표준 양식으로 회신합니다.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추 CRO" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function CroLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("cro", "/cro");
  const unread = dbReady() ? await unreadCount(session.userId) : 0;
  const nav: NavItem[] = [
    { href: "/cro", label: "받은 요청", icon: "inbox", exact: true },
    { href: "/cro/quotes", label: "제출한 견적", icon: "doc" },
    { href: "/cro/awards", label: "수주", icon: "award" },
    { href: "/cro/notifications", label: "알림", icon: "bell", badge: unread },
    { href: "/cro/org", label: "기관", icon: "org" },
  ];
  return (
    <AppState>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})()",
        }}
      />
      <Shell session={session} nav={nav}>
        {children}
      </Shell>
    </AppState>
  );
}
