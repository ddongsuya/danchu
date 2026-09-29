import Link from "next/link";
import type { Role, Session } from "@/lib/auth";
import { Mark } from "@/components/app/ui";
import { NavLinks, TabLinks } from "./NavLinks";
import { LogoutButton } from "./LogoutButton";
import "./portal.css";
import { ArrowUpRight, Question } from "@phosphor-icons/react/dist/ssr";

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
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="pt__side">
        <Link href={nav[0]?.href ?? "/"} className="pt__sbrand">
          <Mark size={28} />
          <span>단추</span>
          <span className="pt__role" style={{ marginLeft: "auto" }}>{ROLE_LABEL[role]}</span>
        </Link>
        <div className="pt__nav-label">내 워크스페이스</div>
        <nav className="pt__nav" aria-label="주요 메뉴">
          <NavLinks items={nav} variant="side" />
        </nav>
        <Link href="/guide" className="pt__guide"><Question size={20} aria-hidden="true" /><span>시험 가이드</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <div className="pt__user">
          <div className="pt__identity"><span className="pt__avatar" aria-hidden="true">{who.slice(0, 1)}</span><div>
            <b>{who}</b>
            {org}
          </div></div>
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
            <span className="pt__workspace-title">{ROLE_LABEL[role]} 워크스페이스</span>
            <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org || who}</span>
          </div>
        </header>
        <main className="pt__main" id="main-content">{children}</main>
        <nav className="pt__tabs" aria-label="주요 메뉴">
          <TabLinks items={nav} />
        </nav>
      </div>
    </div>
  );
}
