import Link from "next/link";
import { CroTabBar } from "@/components/app/ui";
import { CRO_ME } from "@/lib/cro-data";

/** 기관 — 핸드오프 범위 밖이라 최소 구성: 프로필 · 보유 인증(회신에 자동 채움) · 로그아웃 */
export default function CroOrg() {
  return (
    <div className="scr scr--sf">
      <div style={{ padding: "calc(var(--top) + 10px) 20px 0" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>기관</h1>
      </div>
      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="card" style={{ padding: 18, display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ flex: "none", width: 52, height: 52, borderRadius: "50%", background: "var(--ink)", color: "var(--wh)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>{CRO_ME.name.slice(0, 1)}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{CRO_ME.name}</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{CRO_ME.user} {CRO_ME.title}</span>
          </div>
          <span className="pill" style={{ fontSize: 11, padding: "4px 8px", background: "var(--ink)", color: "var(--wh)" }}>CRO</span>
        </div>
      </div>
      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="grouplab">보유 인증 · 회신에 자동으로 채워집니다</div>
        <div className="card card--rows">
          <div className="kv"><span className="kv__k">GLP</span><span className="kv__v">{CRO_ME.glp.join(" · ")}</span></div>
          <div className="kv"><span className="kv__k">AAALAC</span><span className="kv__v">{CRO_ME.aaalac ? "인증" : "—"}</span></div>
        </div>
      </div>
      <div className="pad" style={{ padding: "16px 20px 28px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <Link href="/app/login" className="b2" style={{ color: "var(--body)" }}>로그아웃</Link>
        <span style={{ fontSize: 12, color: "var(--ph)" }}>단추 v1.0 · hello@danchu.kr</span>
      </div>
      <CroTabBar active="org" />
    </div>
  );
}
