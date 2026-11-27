import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { mmdd } from "@/lib/format";
import type { Role } from "@/lib/auth";
import type { NotificationRow } from "@/lib/data";
import { MarkAllRead } from "@/components/MarkAllRead";
import { NotificationLink } from "@/components/NotificationLink";
import "./noti.css";

export const KINDS = ["접수", "배포", "견적", "비교", "선정", "계약", "기관", "시스템"];

/** 알림 화면 (시안 r-noti · c-noti). 데이터는 app/app/notifications/page.tsx 가 읽어 넘긴다 (검토 화면은 예시) */
export function NotificationsView({ role, base, list, unread, hasMore, failed, kind, onlyUnread, page }: { role: Role; base: string; list: NotificationRow[]; unread: number; hasMore: boolean; failed: boolean; kind: string; onlyUnread: boolean; page: number }) {
  const settingsHref = role === "admin" ? null : role === "cro" ? "/cro/profile/notifications" : "/app/profile/notifications";
  const href = (o: { kind?: string; page?: number; unread?: boolean }) => {
    const q = new URLSearchParams();
    if (o.kind) q.set("kind", o.kind);
    if (o.unread) q.set("unread", "1");
    if (o.page && o.page > 1) q.set("page", String(o.page));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };

  let body: React.ReactNode;
  if (failed) body = <ErrorState title="알림을 불러오지 못했어요" />;
  else if (list.length === 0 && (onlyUnread || kind || page > 1))
    body = <EmptyState kind="filtered" title={onlyUnread ? "읽지 않은 알림이 없어요" : "알림이 없어요"} action={<Link href={href({})} className="b2 bsm">전체 보기</Link>} />;
  else if (list.length === 0) body = <EmptyState title="알림이 없어요" action={settingsHref ? <Link href={settingsHref} className="b2 bsm">알림 설정</Link> : undefined} />;
  else
    body = (
      <ul className="nt-list">
        {list.map((n) => {
          const sub = [n.body?.split("\n")[0], mmdd(n.created_at)].filter(Boolean).join(" · ");
          const inner = (
            <>
              <span className="nt-t">{n.title}</span>
              <span className="nt-sub tnum">{sub}</span>
              {!n.read_at && <span className="nt-new">새 알림</span>}
            </>
          );
          return (
            <li key={n.id}>
              {n.href ? (
                <NotificationLink id={n.id} href={n.href} unread={!n.read_at} className="nt-row">
                  {inner}
                </NotificationLink>
              ) : (
                <div className="nt-row">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="nt">
      <div className="nt-head">
        <h1>알림</h1>
        <nav className="nt-seg" aria-label="알림 구분">
          <Link href={href({ kind })} aria-current={!onlyUnread ? "page" : undefined}>
            전체
          </Link>
          <Link href={href({ kind, unread: true })} aria-current={onlyUnread ? "page" : undefined}>
            읽지 않음{unread > 0 && <span className="tnum"> {unread}</span>}
          </Link>
        </nav>
        <span className="nt-sp" />
        {unread > 0 && !failed && <MarkAllRead count={unread} />}
      </div>
      {role === "admin" && (
        <nav className="nt-kinds" aria-label="알림 종류">
          {["", ...KINDS].map((k) => (
            <Link key={k || "all"} href={href({ kind: k, unread: onlyUnread })} aria-current={kind === k ? "page" : undefined}>
              {k || "전체"}
            </Link>
          ))}
        </nav>
      )}
      {body}
      {!failed && (page > 1 || hasMore) && (
        <div className="nt-pager">
          {page > 1 && <Link href={href({ kind, unread: onlyUnread, page: page - 1 })} className="b2 bsm">이전</Link>}
          {hasMore && <Link href={href({ kind, unread: onlyUnread, page: page + 1 })} className="b2 bsm">다음</Link>}
        </div>
      )}
    </div>
  );
}
