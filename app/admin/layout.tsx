import type { Metadata, Viewport } from "next";
import { requireSession } from "@/lib/auth";
import { dbReady, unreadCount } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";

export const metadata: Metadata = { title: "단추 운영", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("admin", "/admin");
  const unread = dbReady() ? await unreadCount(session.userId) : 0;
  // 시안 v7 a-intake 메뉴 묶음: 운영 · 거래 · 요청·기록 (2026-11-26). 기관 옆 숫자는 승인 대기
  const pendingOrgs = dbReady() ? await countPendingOrgs() : 0;
  const nav: NavItem[] = [
    { href: "/admin", label: "접수", icon: "list", exact: true, group: "운영" },
    { href: "/admin/cros", label: "기관", icon: "cros", group: "운영", badge: pendingOrgs },
    { href: "/admin/users", label: "사용자", icon: "user", group: "운영" },
    { href: "/admin/early", label: "사전예약", icon: "list", group: "운영" },
    { href: "/admin/awards", label: "수주·계약", icon: "award", group: "거래" },
    { href: "/admin/billing", label: "청구 명세", icon: "doc", group: "거래" },
    { href: "/admin/invoices", label: "청구서", icon: "receipt", group: "거래" },
    { href: "/admin/quote-design", label: "견적서 양식 요청", icon: "doc", group: "요청·기록" },
    { href: "/admin/audit", label: "운영 기록", icon: "list", group: "요청·기록" },
    { href: "/admin/notifications", label: "알림", icon: "bell", badge: unread, group: "요청·기록" },
  ];
  // 휴대폰 아래 탭은 예전과 같은 다섯 개 (접수 · 기관 · 수주·계약 · 청구 명세 · 청구서)
  const tabs = ["/admin", "/admin/cros", "/admin/awards", "/admin/billing", "/admin/invoices"].map((h) => nav.find((i) => i.href === h)!);
  return (
    <AppState>
      <Shell session={session} nav={nav} tabs={tabs}>
        {children}
      </Shell>
    </AppState>
  );
}

async function countPendingOrgs(): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { count } = await sb.from("cro_orgs").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
