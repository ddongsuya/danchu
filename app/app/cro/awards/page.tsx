import { CroTabBar, Mark } from "@/components/app/ui";
import { AWARD, RESULTS } from "@/lib/cro-data";

const NEXT = [
  ["의뢰자와 계약 협의", "단추는 조건에 관여하지 않습니다. 직접 진행하세요."],
  ["계약 체결 보고", "체결일·계약금액을 앱에 입력 (수수료 정산 기준)"],
  ["시험물질 수령", "회신에 적은 필요량·시점 기준"],
];

export default function Awards() {
  const a = AWARD;
  return (
    <div className="scr scr--sf" style={{ position: "relative" }}>
      <div className="drop-in" style={{ position: "absolute", top: "calc(var(--top) + 8px)", left: 10, right: 10, zIndex: 30, background: "rgba(245,245,244,.92)", backdropFilter: "blur(20px)", borderRadius: 24, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start", boxShadow: "0 10px 30px -10px rgba(26,25,25,.25)" }}>
        <span style={{ flex: "none", width: 38, height: 38, borderRadius: 9, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }}>
          <Mark size={26} shadow={false} />
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, color: "#1A1919" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
            <b style={{ fontWeight: 600 }}>단추 CRO</b>
            <span style={{ fontSize: 13, color: "#6F6E6B" }}>지금</span>
          </div>
          <span style={{ fontSize: 15, lineHeight: 1.35 }}>선정되었습니다 · {a.no} {a.substance} {a.cats.split(" ")[0]}. 의뢰자 연락처가 공개되었습니다.</span>
        </div>
      </div>

      <div style={{ padding: "calc(var(--top) + 132px) 20px 0" }}>
        <div style={{ background: "var(--ink)", color: "var(--wh)", borderRadius: 20, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 16, position: "relative", overflow: "hidden" }}>
          <svg width="140" height="140" viewBox="0 0 28 28" aria-hidden="true" style={{ position: "absolute", right: -30, top: -30, opacity: .08 }}>
            <circle cx="14" cy="14" r="13" fill="var(--wh)" />
            <circle cx="10" cy="10" r="1.9" fill="var(--ink)" /><circle cx="18" cy="10" r="1.9" fill="var(--ink)" /><circle cx="10" cy="18" r="1.9" fill="var(--ink)" /><circle cx="18" cy="18" r="1.9" fill="var(--ink)" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bline)", letterSpacing: ".04em" }}>수주</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>선정되었습니다</span>
            <span className="tnum" style={{ fontSize: 14, color: "var(--wh)", opacity: .78 }}>{a.no} · {a.substance} · {a.cats}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12, borderTop: "1px solid color-mix(in srgb, var(--wh) 16%, transparent)" }}>
            <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 12, color: "var(--wh)", opacity: .6 }}>제출 견적</span><span className="tnum" style={{ fontSize: 17, fontWeight: 700 }}>{a.amount}</span></div>
            <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 12, color: "var(--wh)", opacity: .6 }}>선정일</span><span className="tnum" style={{ fontSize: 17, fontWeight: 700 }}>{a.date}</span></div>
          </div>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 14 }}>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>의뢰자 연락처</h2>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>{a.client.initial}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{a.client.name}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{a.client.org} · {a.client.email} · {a.client.phone}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`tel:${a.client.phone}`} className="b1" style={{ height: 44, borderRadius: 10, fontSize: 14 }}>전화</a>
            <a href={`mailto:${a.client.email}`} className="b2" style={{ height: 44, borderRadius: 10, fontSize: 14 }}>이메일</a>
          </div>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>다음 단계</h2>
          {NEXT.map(([t, d], i) => (
            <div key={t} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", background: i === 0 ? "var(--brand)" : "transparent", border: i === 0 ? 0 : "1.5px solid var(--iline)", color: i === 0 ? "var(--onbrand)" : "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
              <div style={{ fontSize: 15 }}><b style={{ fontWeight: 600 }}>{t}</b><small style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>{d}</small></div>
            </div>
          ))}
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>최근 결과</h2>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>선정 {RESULTS.filter((r) => r[2] === "선정").length} · 미선정 {RESULTS.filter((r) => r[2] !== "선정").length}</span>
      </div>
      <div className="pad" style={{ padding: "10px 20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {RESULTS.map(([title, sub, state]) => (
          <div key={title} className="card" style={{ borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span><span style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</span></div>
            <span className={`pill ${state === "선정" ? "pill--ok" : "pill--sf"}`}>{state}</span>
          </div>
        ))}
      </div>

      <CroTabBar active="quotes" />
    </div>
  );
}
