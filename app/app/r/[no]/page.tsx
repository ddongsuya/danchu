import Link from "next/link";
import { CheckMark, SubHeader } from "@/components/app/ui";
import { FOCUS, REPLIES, REQUESTS, TIMELINE } from "@/lib/app-data";

export default async function RequestDetail({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const req = REQUESTS.find((r) => r.no === no);
  const focused = no === FOCUS.no;
  const substance = req?.substance ?? FOCUS.substance;
  const cats = focused ? FOCUS.cats : (req?.cats ?? FOCUS.cats);
  const arrived = focused ? 3 : 0;

  return (
    <div className="scr scr--sf">
      <SubHeader sheet back="/app" backLabel="홈" title={no} action={{ label: "공유" }}>
        <div style={{ padding: "8px 0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{substance}</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{cats}</span>
            </div>
            <span className="pill pill--tint" style={{ marginTop: 4 }}>{req?.status ?? FOCUS.status}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FOCUS.chips.map((c) => (
              <span key={c} className="chip">{c}</span>
            ))}
          </div>
        </div>
      </SubHeader>

      <div className="pad" style={{ paddingTop: 20 }}>
        <div className="card" style={{ padding: "20px 20px 8px" }}>
          <h2 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>진행 상태</h2>
          {TIMELINE.map(([label, desc, date, st], i) => (
            <div key={label} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, flex: "none" }}>
                <span
                  style={{
                    width: 22, height: 22, borderRadius: "50%", flex: "none",
                    background: st === 2 ? "var(--brand)" : st === 1 ? "var(--tint)" : "var(--wh)",
                    border: `1.5px solid ${st ? "var(--brand)" : "var(--iline)"}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {st === 2 && <CheckMark size={12} />}
                </span>
                {i < TIMELINE.length - 1 && (
                  <span style={{ flex: 1, width: 1.5, background: st === 2 ? "var(--brand)" : "var(--iline)", margin: "3px 0", minHeight: 14 }} />
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flex: 1, paddingBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: st ? 700 : 500, color: st ? "var(--ink)" : "var(--muted)" }}>{label}</span>
                  {desc && <span style={{ fontSize: 13, color: "var(--muted)" }}>{desc}</span>}
                </div>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>회신 현황</h2>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{FOCUS.replyBy}</span>
      </div>
      <div className="pad" style={{ padding: "10px 20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {REPLIES.map(([name, state, on]) => (
          <div key={name} className="card" style={{ borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "var(--brand)" : "var(--dash)" }} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
            </div>
            <span style={{ fontSize: 13, color: on ? "var(--ink)" : "var(--muted)" }}>{state}</span>
          </div>
        ))}
      </div>

      <div className="cta cta--sf">
        {arrived > 0 ? (
          <Link href={`/app/r/${no}/compare`} className="b1">도착한 견적 {arrived}건 비교하기</Link>
        ) : (
          <button type="button" className="b1" disabled>견적을 기다리는 중입니다</button>
        )}
      </div>
    </div>
  );
}
