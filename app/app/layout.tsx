import type { Metadata, Viewport } from "next";
import { requireSession } from "@/lib/auth";
import { dbReady, unreadCount } from "@/lib/data";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";

export const metadata: Metadata = {
  title: "단추 — 내 견적 요청",
  description: "비임상 시험 견적을 요청하고 도착한 견적을 비교합니다.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F4" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("requester", "/app");
  const unread = dbReady() ? await unreadCount(session.userId) : 0;
  const nav: NavItem[] = [
    { href: "/app", label: "홈", icon: "home", exact: true },
    { href: "/app/new", label: "새 요청", icon: "plus" },
    { href: "/app/notifications", label: "알림", icon: "bell", badge: unread },
    { href: "/app/profile", label: "프로필", icon: "user" },
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
