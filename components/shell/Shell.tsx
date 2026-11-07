import Link from "next/link";
import type { Role, Session } from "@/lib/auth";
import { Lockup } from "@/components/Logo";
import { NavLinks, TabLinks } from "./NavLinks";
import { LogoutButton } from "./LogoutButton";
import { ViewportHeight } from "@/components/site/ViewportHeight";
import "./portal.css";
import { ArrowUpRight, BookOpenText } from "@phosphor-icons/react/dist/ssr";

/** soon: 아직 열리지 않은 메뉴 (사전예약 기간). 누를 수 없고 옆에 열리는 날을 적는다 */
/** group: 넓은 화면 사이드바에서 이 항목 위에 작은 묶음 이름을 단다 (앞 항목과 묶음이 다를 때만) */
export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean; soon?: string; group?: string };
export type IconName = "home" | "plus" | "bell" | "user" | "inbox" | "doc" | "award" | "org" | "list" | "cros" | "settings" | "receipt" | "explore" | "book" | "quote" | "clients" | "calendar" | "today" | "deals" | "report" | "note" | "more";

// 화면에서는 "기관"으로 통일한다 (의뢰자 화면의 "선택한 기관"과 같은 말)
const ROLE_LABEL: Record<Role, string> = { requester: "의뢰자", cro: "기관", admin: "운영자" };

/**
 * 포털 공통 셸 — 넓은 화면은 사이드바, 좁은 화면은 상단 바 + 하단 탭.
 * 각 역할 layout이 nav 목록을 넘긴다.
 */
/** tabs: 휴대폰 아래 탭을 따로 줄 때 (없으면 nav 앞 다섯 개) */
export function Shell({ session, nav, tabs, children }: { session: Session; nav: NavItem[]; tabs?: NavItem[]; children: React.ReactNode }) {
  const role = session.profile.role;
  const who = session.profile.name || session.email;
  const org = role === "cro" ? session.org?.name : session.profile.company;
  // 이름을 누르면 프로필로 (운영자는 메뉴에 프로필이 없어 여기가 유일한 길이다)
  const profileHref = role === "admin" ? "/admin/profile" : role === "cro" ? "/cro/profile" : "/app/profile";

  return (
    <div className="pt">
      {/* 첫 장면 높이 기준 (--vhpx). 인앱 브라우저가 svh 를 크게 잡는 문제를 랜딩과 같은 방법으로 피한다 */}
      <ViewportHeight />
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="pt__side">
        <Link href={nav[0]?.href ?? "/"} className="pt__sbrand">
          <Lockup size={24} />
          <span className="pt__role" style={{ marginLeft: "auto" }}>{ROLE_LABEL[role]}</span>
        </Link>
        <div className="pt__nav-label">내 워크스페이스</div>
        <nav className="pt__nav" aria-label="주요 메뉴">
          <NavLinks items={nav} variant="side" />
        </nav>
        <a href="/guide/library" className="pt__guide"><BookOpenText size={20} aria-hidden="true" /><span>가이드라인 자료실</span><ArrowUpRight size={15} aria-hidden="true" /></a>
        <div className="pt__user">
          <Link href={profileHref} className="pt__identity" aria-label={`프로필 · ${who}`}><span className="pt__avatar" aria-hidden="true">{who.slice(0, 1)}</span><div>
            <b>{who}</b>
            {org}
          </div></Link>
          <LogoutButton />
        </div>
      </aside>

      <div className="pt__body">
        {session.demo && (
          <div className="pt__demo" role="status">
            <b>미리보기</b>
            <span>{ROLE_LABEL[role]} 화면을 기존 계정으로 보는 중이에요. 저장은 되지 않아요.</span>
            <nav aria-label="미리보기 역할">
              {(["requester", "cro", "admin"] as Role[]).map((r) => (
                <a key={r} href={`/demo?as=${r}`} aria-current={r === role ? "page" : undefined}>{ROLE_LABEL[r]}</a>
              ))}
              <a href="/demo?off=1">끝내기</a>
            </nav>
          </div>
        )}
        <header className="pt__top">
          <div className="pt__topin">
            <Link href={nav[0]?.href ?? "/"} className="pt__brand">
              <Lockup size={20} />
              <span className="pt__role">{ROLE_LABEL[role]}</span>
            </Link>
            <span className="pt__workspace-title">{ROLE_LABEL[role]} 워크스페이스</span>
            <div className="pt__topr">
              {/* 좁은 화면에는 사이드바가 없어 자료실 링크를 위 바에 둔다 */}
              <a href="/guide/library" className="pt__toplib only-narrow" aria-label="가이드라인 자료실"><BookOpenText size={22} aria-hidden="true" /></a>
              <Link href={profileHref} className="pt__who" aria-label={`프로필 · ${who}`} style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org || who}</Link>
            </div>
          </div>
        </header>
        <main className="pt__main" id="main-content">{children}</main>
        <nav className="pt__tabs" aria-label="주요 메뉴">
          <TabLinks items={tabs ?? nav} />
        </nav>
      </div>
    </div>
  );
}
