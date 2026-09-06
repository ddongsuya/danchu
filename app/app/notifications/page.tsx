import { Mark, TabBar } from "@/components/app/ui";
import { NOTIFS } from "@/lib/app-data";

export default function Notifications() {
  return (
    <div className="scr scr--sf" style={{ position: "relative" }}>
      {/* 푸시 미리보기 — 실제 알림은 기기 OS가 띄운다 */}
      <div
        className="drop-in"
        style={{
          position: "absolute", top: "calc(var(--top) + 8px)", left: 10, right: 10, zIndex: 30,
          background: "rgba(245,245,244,.92)", backdropFilter: "blur(20px)", borderRadius: 24,
          padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
          boxShadow: "0 10px 30px -10px rgba(26,25,25,.25)",
        }}
      >
        <span style={{ flex: "none", width: 38, height: 38, borderRadius: 9, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }}>
          <Mark size={26} shadow={false} />
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, color: "#1A1919" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
            <b style={{ fontWeight: 600 }}>단추</b>
            <span style={{ fontSize: 13, color: "#6F6E6B" }}>지금</span>
          </div>
          <span style={{ fontSize: 15, lineHeight: 1.35 }}>KIT 안전성평가연구소 견적이 도착했습니다 · DC-2026-0007 (3/5)</span>
        </div>
      </div>

      <div style={{ padding: "calc(var(--top) + 92px) 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>알림</h1>
        <button type="button" className="btxt" style={{ padding: "8px 0" }}>모두 읽음</button>
      </div>

      <div className="pad" style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {NOTIFS.map((n, i) =>
          n[0] === "h" ? (
            <div key={`h${i}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", padding: "12px 0 2px" }}>
              {n[1]}
            </div>
          ) : (
            (() => {
              const [icon, title, body, time, unread] = n as [string, string, string, string, 0 | 1];
              return (
                <div key={title} className="card" style={{ borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    style={{
                      flex: "none", width: 36, height: 36, borderRadius: 10,
                      background: unread ? "var(--brand)" : "var(--tint)",
                      color: unread ? "var(--onbrand)" : "var(--brand)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, letterSpacing: ".02em",
                    }}
                  >
                    {icon}
                  </span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: unread ? 700 : 600 }}>{title}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{time}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.45 }}>{body}</span>
                  </div>
                  {unread === 1 && <span style={{ flex: "none", width: 8, height: 8, borderRadius: "50%", background: "var(--brand)", marginTop: 6 }} />}
                </div>
              );
            })()
          ),
        )}
      </div>

      <TabBar active="notifications" unread />
    </div>
  );
}
