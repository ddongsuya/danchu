/* ── 포털 공통 아이콘·작은 조각 ─────────────────────── */

export function Mark({ size = 26, shadow = true }: { size?: number; shadow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden="true"
      style={shadow ? { filter: "drop-shadow(0 2px 6px rgba(26,25,25,.15))" } : undefined}
    >
      <circle cx="14" cy="14" r="13" fill="#fff" />
      <circle cx="10" cy="10" r="1.9" fill="var(--brand)" />
      <circle cx="18" cy="10" r="1.9" fill="var(--brand)" />
      <circle cx="10" cy="18" r="1.9" fill="var(--brand)" />
      <circle cx="18" cy="18" r="1.9" fill="var(--brand)" />
    </svg>
  );
}

/** 브랜드 원 안의 체크 — 완료 화면과 옵션 선택에 공통 사용 */
export function CheckDisc({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--brand)" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--onbrand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="var(--onbrand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Caret({ dir = "left", size = 16, color = "currentColor" }: { dir?: "left" | "right" | "down"; size?: number; color?: string }) {
  const d = dir === "left" ? "M15 6l-6 6 6 6" : dir === "right" ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Lock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** 상태 pill */
export function StatusPill({ tone, children }: { tone: "sf" | "tint" | "ok" | "err" | "warn" | "ink"; children: React.ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

/** 진행바 */
export function Bar({ pct, err = false }: { pct: number; err?: boolean }) {
  return (
    <div className="bar">
      <i className={err ? "bar--err" : ""} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** 뒤로가기 줄 */
export function Crumb({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="crumb">
      <Caret size={14} />
      {label}
    </a>
  );
}
