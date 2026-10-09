import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listNotifications } from "@/lib/data";
import { ago } from "@/lib/format";
import { MarkAllRead } from "@/components/MarkAllRead";
import { NotificationLink } from "@/components/NotificationLink";

export const dynamic = "force-dynamic";

const KINDS = ["접수", "배포", "견적", "비교", "선정", "계약", "기관", "시스템"];

export default async function Notifications({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string }> }) {
  const s = await requireSession();
  const { kind = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const { list, hasMore } = dbReady() ? await listNotifications(s.userId, 50, { kind: KINDS.includes(kind) ? kind : undefined, page }) : { list: [], hasMore: false };
  const unread = list.filter((n) => !n.read_at).length;
  const base = s.profile.role === "admin" ? "/admin/notifications" : s.profile.role === "cro" ? "/cro/notifications" : "/app/notifications";
  const href = (k: string, p: number) => `${base}?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <div className="ph">
        <div>
          <h1>알림</h1>
          <p>{unread ? `읽지 않은 알림 ${unread}건` : "모두 읽었습니다"}</p>
        </div>
        {unread > 0 && (
          <div className="ph__actions">
            <MarkAllRead />
          </div>
        )}
      </div>
      {s.profile.role === "admin" && (
        <div className="seg" style={{ marginBottom: 14, flexWrap: "wrap", height: "auto" }}>
          {[["", "전체"], ...KINDS.map((k) => [k, k])].map(([k, label]) => (
            <Link key={k} href={href(k, 1)} role="button" aria-pressed={kind === k} style={{ height: 32, display: "inline-flex", alignItems: "center", padding: "0 12px", fontSize: 13, background: kind === k ? "var(--ink)" : "var(--wh)", color: kind === k ? "var(--wh)" : "var(--ink)", fontWeight: kind === k ? 600 : 400 }}>{label}</Link>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <div className="empty">
          <b>알림이 없습니다</b>
          견적 도착, 비교표 공개, 계약 진행 소식이 여기에 쌓입니다.
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {list.map((n) => {
            const inner = (
              <>
                <span
                  style={{
                    flex: "none", width: 36, height: 36, borderRadius: 10,
                    background: n.read_at ? "var(--tint)" : "var(--brand)", color: n.read_at ? "var(--brand)" : "var(--onbrand)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, letterSpacing: ".02em",
                  }}
                >
                  {n.kind}
                </span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: n.read_at ? 600 : 700 }}>{n.title}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{ago(n.created_at)}</span>
                  </div>
                  {n.body && <span style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{n.body}</span>}
                </div>
                {!n.read_at && <span style={{ flex: "none", width: 8, height: 8, borderRadius: "50%", background: "var(--brand)", marginTop: 6 }} />}
              </>
            );
            const style: React.CSSProperties = { borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", color: "var(--ink)" };
            return n.href ? (
              <NotificationLink key={n.id} id={n.id} href={n.href} unread={!n.read_at} style={style}>{inner}</NotificationLink>
            ) : (
              <div key={n.id} className="card" style={style}>{inner}</div>
            );
          })}
        </div>
      )}
      {(page > 1 || hasMore) && (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          {page > 1 && <Link href={href(kind, page - 1)} className="b2 bsm">이전</Link>}
          {hasMore && <Link href={href(kind, page + 1)} className="b2 bsm">다음</Link>}
        </div>
      )}
    </>
  );
}
