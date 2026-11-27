import { requireSession } from "@/lib/auth";
import { dbReady, listNotifications, unreadCount } from "@/lib/data";
import { KINDS, NotificationsView } from "@/components/notifications/NotificationsView";

export const dynamic = "force-dynamic";

/**
 * 알림 (시안 검토판 r-noti · c-noti). 의뢰자·기관·운영자가 같은 화면을 쓴다 (/cro·/admin 은 다시 내보냄).
 * 머리 줄: 알림 · 전체/읽지 않음 · 모두 읽음. 운영자는 종류 고르기가 더 있다.
 * 빈 화면은 처음(알림이 없어요 + 알림 설정)과 읽지 않음 0건(읽지 않은 알림이 없어요 + 전체 보기)을 나눈다.
 */
export default async function Notifications({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string; unread?: string }> }) {
  const s = await requireSession();
  const { kind: kindQ = "", page: pageStr = "1", unread: unreadQ } = await searchParams;
  const kind = KINDS.includes(kindQ) ? kindQ : "";
  const onlyUnread = unreadQ === "1";
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const [{ list, hasMore, failed }, unread] = dbReady()
    ? await Promise.all([listNotifications(s.userId, 50, { kind: kind || undefined, page, unread: onlyUnread }), unreadCount(s.userId)])
    : [{ list: [], hasMore: false, failed: false }, 0];
  const role = s.profile.role;
  const base = role === "admin" ? "/admin/notifications" : role === "cro" ? "/cro/notifications" : "/app/notifications";
  return <NotificationsView role={role} base={base} list={list} unread={unread} hasMore={hasMore} failed={!!failed} kind={kind} onlyUnread={onlyUnread} page={page} />;
}
