"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconName, NavItem } from "./Shell";

import { House, Plus, Bell, UserCircle, Tray, FileText, Medal, Buildings, ListBullets, Gear } from "@phosphor-icons/react";

const ICONS = { home: House, plus: Plus, bell: Bell, user: UserCircle, inbox: Tray, doc: FileText, award: Medal, org: Buildings, list: ListBullets, cros: Buildings, settings: Gear };
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const Glyph = ICONS[name];
  return <Glyph size={size} weight="regular" aria-hidden="true" />;
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
        <Link key={it.href} href={it.href} className="pt__navi" aria-current={active === it.href ? "page" : undefined} data-on={active === it.href ? "1" : "0"}>
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
        <Link key={it.href} href={it.href} className="pt__tab" aria-current={active === it.href ? "page" : undefined} data-on={active === it.href ? "1" : "0"}>
          <Icon name={it.icon} />
          <span>{it.label}</span>
          {it.badge ? <span className="pt__dot">{it.badge > 99 ? "99+" : it.badge}</span> : null}
        </Link>
      ))}
    </>
  );
}
