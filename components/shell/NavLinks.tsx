"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconName, NavItem } from "./Shell";

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 4h16v12H4z" />
      <path d="M4 16l3-6h10l3 6" />
    </>
  ),
  doc: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5" />
    </>
  ),
  org: (
    <>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  cros: (
    <>
      <path d="M3 21h18M5 21V10l5-4v15M10 21V6l5 3v12M15 21V9l4 2v10" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

function isOn(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/** 다른 항목의 접두어가 되는 경로(예: /app)는 더 구체적인 항목이 켜져 있으면 끈다 */
function activeHref(pathname: string, items: NavItem[]): string | null {
  const on = items.filter((i) => isOn(pathname, i)).sort((a, b) => b.href.length - a.href.length);
  return on[0]?.href ?? null;
}

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" }) {
  const pathname = usePathname();
  const active = activeHref(pathname, items);
  void variant;
  return (
    <>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="pt__navi" data-on={active === it.href ? "1" : "0"}>
          <Icon name={it.icon} size={20} />
          <span>{it.label}</span>
          {it.badge ? <span className="pt__dot">{it.badge > 99 ? "99+" : it.badge}</span> : null}
        </Link>
      ))}
    </>
  );
}

export function TabLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = activeHref(pathname, items);
  return (
    <>
      {items.slice(0, 5).map((it) => (
        <Link key={it.href} href={it.href} className="pt__tab" data-on={active === it.href ? "1" : "0"}>
          <Icon name={it.icon} />
          <span>{it.label}</span>
          {it.badge ? <span className="pt__dot">{it.badge > 99 ? "99+" : it.badge}</span> : null}
        </Link>
      ))}
    </>
  );
}
