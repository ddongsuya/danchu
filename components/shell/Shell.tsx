import Link from "next/link";
import type { Role, Session } from "@/lib/auth";
import { Mark } from "@/components/app/ui";
import { NavLinks, TabLinks } from "./NavLinks";
import { LogoutButton } from "./LogoutButton";
import "./portal.css";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };
export type IconName = "home" | "plus" | "bell" | "user" | "inbox" | "doc" | "award" | "org" | "list" | "cros" | "settings";

const ROLE_LABEL: Record<Role, string> = { requester: "의뢰자", cro: "CRO", admin: "운영자" };

/**
 * 포털 공통 셸 — 넓은 화면은 사이드바, 좁은 화면은 상단 바 + 하단 탭.
 * 각 역할 layout이 nav 목록을 넘긴다.
 */
export function Shell({ session, nav, children }: { session: Session; nav: NavItem[]; children: React.ReactNode }) {
  const role = session.profile.role;
  const who = session.profile.name || session.email;
  const org = role === "cro" ? session.org?.name : session.profile.company;

  return (
    <div className="pt">
      <aside className="pt__side">
        <Link href={nav[0]?.href ?? "/"} className="pt__sbrand">
          <Mark size={28} />
          <span>단추</span>
          <span className="pt__role" style={{ marginLeft: "auto" }}>{ROLE_LABEL[role]}</span>
        </Link>
        <nav className="pt__nav" aria-label="주요 메뉴">
          <NavLinks items={nav} variant="side" />
        </nav>
        <div className="pt__user">
          <div>
            <b>{who}</b>
            {org}
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="pt__body">
        <header className="pt__top">
          <div className="pt__topin">
            <Link href={nav[0]?.href ?? "/"} className="pt__brand">
              <Mark size={24} />
              <span>단추</span>
              <span className="pt__role">{ROLE_LABEL[role]}</span>
            </Link>
            <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org || who}</span>
          </div>
        </header>
        <main className="pt__main">{children}</main>
        <nav className="pt__tabs" aria-label="주요 메뉴">
          <TabLinks items={nav} />
        </nav>
      </div>
    </div>
  );
}
