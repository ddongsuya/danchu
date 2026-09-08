import type { Metadata, Viewport } from "next";
import { requireSession } from "@/lib/auth";
import { dbReady, unreadCount } from "@/lib/data";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";

export const metadata: Metadata = { title: "단추 운영", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("admin", "/admin");
  const unread = dbReady() ? await unreadCount(session.userId) : 0;
  const nav: NavItem[] = [
    { href: "/admin", label: "접수", icon: "list", exact: true },
    { href: "/admin/cros", label: "CRO 기관", icon: "cros" },
    { href: "/admin/awards", label: "수주·계약", icon: "award" },
    { href: "/admin/notifications", label: "알림", icon: "bell", badge: unread },
    { href: "/admin/users", label: "사용자", icon: "user" },
  ];
  return (
    <AppState>
      <Shell session={session} nav={nav}>
        {children}
      </Shell>
    </AppState>
  );
}
