import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listNotifications } from "@/lib/data";
import { ago } from "@/lib/format";
import { MarkAllRead } from "@/components/MarkAllRead";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  const s = await requireSession();
  const list = dbReady() ? await listNotifications(s.userId) : [];
  const unread = list.filter((n) => !n.read_at).length;

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
              <Link key={n.id} href={n.href} className="card card--link" style={style}>{inner}</Link>
            ) : (
              <div key={n.id} className="card" style={style}>{inner}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
