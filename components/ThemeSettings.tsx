"use client";

import { useApp } from "@/components/app/AppState";

function Toggle({ on, onFlip, label }: { on: boolean; onFlip: () => void; label: string }) {
  return (
    <button type="button" className="tgl" aria-pressed={on} aria-label={label} onClick={onFlip}>
      <span />
    </button>
  );
}

/** 화면 설정 — 값은 이 기기에만 저장된다 */
export function ThemeSettings() {
  const { dark, theme, toggleDark, push, mail, setFlag } = useApp();
  return (
    <div className="card card--rows">
      <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>설정</div>
      <div className="kv" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span>다크 모드</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{theme === "system" ? `기기 설정을 따름 · 지금 ${dark ? "어두움" : "밝음"}` : dark ? "항상 어둡게" : "항상 밝게"}</span>
        </div>
        <Toggle on={dark} onFlip={toggleDark} label="다크 모드" />
      </div>
      <div className="kv" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span>이메일 알림</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>견적 도착 · 비교표 · 계약 진행</span>
        </div>
        <Toggle on={mail} onFlip={() => setFlag("mail", !mail)} label="이메일 알림" />
      </div>
      <div className="kv" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span>푸시 알림</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>앱 설치 후 사용할 수 있습니다</span>
        </div>
        <Toggle on={push} onFlip={() => setFlag("push", !push)} label="푸시 알림" />
      </div>
    </div>
  );
}
