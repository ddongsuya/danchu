"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** 알림 한 줄. 누르면 읽음 처리한 뒤 이동한다 (실패해도 이동은 한다) */
export function NotificationLink({ id, href, unread, className, onNavigate, children }: { id: string; href: string; unread: boolean; className?: string; onNavigate?: () => void; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onNavigate?.();
        if (!unread) return;
        e.preventDefault();
        fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }), keepalive: true })
          .catch(() => null)
          .finally(() => {
            router.push(href);
            router.refresh();
          });
      }}
    >
      {children}
    </Link>
  );
}
