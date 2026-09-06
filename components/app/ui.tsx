import Link from "next/link";

/* ── 아이콘 ──────────────────────────────────────── */

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

const TAB_ICONS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
  plus: "M12 5v14M5 12h14",
} as const;

/* ── 화면 골격 ────────────────────────────────────── */

/** 서브 화면 상단 바 — 좌 뒤로가기 · 중앙 제목 · 우 보조 액션 */
export function SubHeader({
  back,
  backLabel,
  title,
  action,
  sheet = false,
  children,
}: {
  back?: string;
  backLabel?: string;
  title: string;
  action?: { label: string; href?: string; brand?: boolean };
  sheet?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`hd${sheet ? " hd--sheet" : ""}`}>
      <div className="hd__bar">
        {back ? (
          <Link href={back} className="hd__back">
            <Caret />
            {backLabel}
          </Link>
        ) : (
          <span style={{ minWidth: 56 }} />
        )}
        <span className="hd__ttl">{title}</span>
        {action ? (
          action.href ? (
            <Link href={action.href} className={`hd__act${action.brand ? " hd__act--brand" : ""}`}>
              {action.label}
            </Link>
          ) : (
            <span className={`hd__act${action.brand ? " hd__act--brand" : ""}`}>{action.label}</span>
          )
        ) : (
          <span style={{ minWidth: 56 }} />
        )}
      </div>
      {children}
    </div>
  );
}

/** 하단 탭바 — 홈 · 알림 · [요청] · 프로필 */
export function TabBar({ active, unread = false }: { active: "home" | "notifications" | "profile"; unread?: boolean }) {
  const item = (key: "home" | "notifications" | "profile", href: string, icon: keyof typeof TAB_ICONS, label: string, dot = false) => (
    <Link href={href} className="tab" data-on={active === key ? "1" : "0"}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={TAB_ICONS[icon]} />
        {icon === "bell" && <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />}
      </svg>
      <span>{label}</span>
      {dot && <span className="tab__dot" />}
    </Link>
  );
  return (
    <nav className="tabs" aria-label="주요 메뉴">
      {item("home", "/app", "home", "홈")}
      {item("notifications", "/app/notifications", "bell", "알림", unread)}
      <Link href="/app/new" className="tab tab--fab" aria-label="견적 요청">
        <i>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d={TAB_ICONS.plus} />
          </svg>
        </i>
        <span>요청</span>
      </Link>
      <Link href="/app/profile" className="tab" data-on={active === "profile" ? "1" : "0"}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        <span>프로필</span>
      </Link>
    </nav>
  );
}

/** 상태 pill — 요청 상태 톤 3종 */
export function StatusPill({ tone, children }: { tone: "sf" | "tint" | "ok" | "err"; children: React.ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

/** 진행바 */
export function Bar({ pct }: { pct: number }) {
  return (
    <div className="bar">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
