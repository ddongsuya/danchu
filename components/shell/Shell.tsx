import Link from "next/link";
import type { Role, Session } from "@/lib/auth";
import type { NotificationRow } from "@/lib/data";
import { Lockup } from "@/components/Logo";
import { NavLinks } from "./NavLinks";
import { AccountMenu, DrawerButton, NotiBell, type MenuLink } from "./ShellMenus";
import { ViewportHeight } from "@/components/site/ViewportHeight";
import { UiProvider } from "@/components/ui/UiProvider";
import "./portal.css";
import "./tokens-openai.css";
import { BookOpenText, Gear } from "@phosphor-icons/react/dist/ssr";

/** soon: 아직 열리지 않은 메뉴 (사전예약 기간). 누를 수 없고 옆에 열리는 날을 적는다 */
/** group: 넓은 화면 사이드바에서 이 항목 위에 작은 묶음 이름을 단다 (앞 항목과 묶음이 다를 때만) */
export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean; soon?: string; group?: string };
export type IconName = "home" | "plus" | "bell" | "user" | "inbox" | "doc" | "award" | "org" | "list" | "cros" | "settings" | "receipt" | "explore" | "book" | "quote" | "clients" | "calendar" | "today" | "deals" | "report" | "note" | "more" | "tag" | "search";

// 화면에서는 "기관"으로 통일한다 (의뢰자 화면의 "선택한 기관"과 같은 말)
const ROLE_LABEL: Record<Role, string> = { requester: "의뢰자", cro: "기관", admin: "운영자" };

/** 계정 메뉴 항목 (시안 r-avatar · c-avatar · a-profile) */
function accountLinks(role: Role): MenuLink[] {
  if (role === "requester") return [{ label: "설정", href: "/app/profile" }, { label: "문의하기", href: "/app/support" }, { label: "가이드라인 자료실", href: "/guide/library" }];
  if (role === "cro") return [{ label: "내 프로필", href: "/cro/profile" }, { label: "기관 설정", href: "/cro/org" }, { label: "문의하기", href: "/cro/support" }];
  return [{ label: "내 프로필", href: "/admin/profile" }];
}

/** 설정 사이드바 (시안 c-set-* · a-profile). 이 주소들에 있는 동안 사이드바가 설정 메뉴로 바뀐다 */
function settingsNav(role: Role): NavItem[] | undefined {
  if (role === "cro")
    return [
      { href: "/cro/profile", label: "프로필", icon: "user", exact: true, group: "내 계정" },
      { href: "/cro/profile/notifications", label: "알림", icon: "bell", group: "내 계정" },
      { href: "/cro/profile/security", label: "보안", icon: "settings", group: "내 계정" },
      { href: "/cro/org", label: "기본 정보", icon: "org", exact: true, group: "기관" },
      { href: "/cro/org#members", label: "구성원", icon: "clients", group: "기관" },
      { href: "/cro/billing", label: "요금제·결제", icon: "receipt", group: "기관" },
    ];
  if (role === "admin") return [{ href: "/admin/profile", label: "프로필", icon: "user", group: "내 계정" }];
  return undefined;
}

/**
 * 포털 공통 셸. 넓은 화면은 사이드바, 좁은 화면은 위 바 + 왼쪽 서랍(시안 검토판 r-drawer · c-drawer).
 * 각 역할 layout 이 nav 목록을 넘긴다.
 * - chat: 의뢰자 화면의 ChatGPT 짜임. 넓은 화면에서 전체 폭 위 바 대신 사이드바 맨 위에 로고, 메뉴 아래 side(요청 목록),
 *   본문 위에 top(얇은 제목 줄), 사이드바 맨 아래 계정 줄(누르면 계정 메뉴)을 둔다.
 * - 그 밖(기관·운영자): 위 바에 종(최근 알림 팝오버)과 계정 메뉴. recent 는 종에 보일 최근 알림.
 * - plan: 기관 요금제 표시. usage: 위 바의 사용량 표시 (무료 요금제 이번 달 견적 수).
 * - tabs: 예전 휴대폰 아래 탭. 서랍으로 바뀌어 쓰지 않는다 (호출부 호환으로만 받는다).
 */
export function Shell({ session, nav, plan, usage, chat, recent = [], children }: { session: Session; nav: NavItem[]; tabs?: NavItem[]; plan?: string; usage?: React.ReactNode; chat?: { side: React.ReactNode; top: React.ReactNode }; recent?: NotificationRow[]; children: React.ReactNode }) {
  const role = session.profile.role;
  const who = session.profile.name || session.email;
  const org = role === "cro" ? session.org?.name : session.profile.company;
  const profileHref = role === "admin" ? "/admin/profile" : role === "cro" ? "/cro/profile" : "/app/profile";
  const homeHref = nav[0]?.href ?? "/";
  const bell = chat ? undefined : nav.find((i) => i.icon === "bell");
  const links = accountLinks(role);
  const menu = (place: "tr" | "bl", variant: "avatar" | "row") => <AccountMenu who={who} email={session.email} org={org} links={links} theme={role === "cro"} place={place} variant={variant} />;

  return (
    <div className={chat ? "pt pt--chat" : "pt"}>
      {/* 토스트·확인 창을 셸에 한 번만 둔다 (components/ui). 아래 화면은 useToast()·useConfirm() 으로 부른다 */}
      <UiProvider>
      {/* 첫 장면 높이 기준 (--vhpx). 인앱 브라우저가 svh 를 크게 잡는 문제를 랜딩과 같은 방법으로 피한다 */}
      <ViewportHeight />
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      {/* 넓은 화면: 전체 폭 위 바(브랜드 / 조직 · 요금제 … 사용량 · 자료실 · 알림 · 계정). 좁은 화면에서는 아래 pt__top 이 대신한다 */}
      {!chat && <header className="pt__bar">
        <Link href={homeHref} className="pt__barbrand"><Lockup size={22} /></Link>
        <span className="pt__barsep" aria-hidden="true">/</span>
        <span className="pt__barorg">{org || who}</span>
        <span className="pt__role">{ROLE_LABEL[role]}</span>
        {plan && <span className="pt__role pt__plan">{plan}</span>}
        <span className="pt__barsp" />
        {usage && <Link href="/cro/billing" className="pt__usage">{usage}</Link>}
        <a href="/guide/library" className="pt__baric" aria-label="가이드라인 자료실"><BookOpenText size={20} aria-hidden="true" /></a>
        {bell && <NotiBell href={bell.href} unread={bell.badge ?? 0} recent={recent} />}
        {menu("tr", "avatar")}
      </header>}
      <div className="pt__frame">
      <aside className="pt__side" aria-label="메뉴" tabIndex={-1}>
        {chat ? <Link href={homeHref} className="pt__sbrand"><Lockup size={22} /></Link> : <span className="pt__sorg">{org || who}</span>}
        <nav className="pt__nav" aria-label="주요 메뉴">
          <NavLinks items={nav} settings={settingsNav(role)} home={homeHref} />
        </nav>
        {chat?.side}
        <div className="pt__user">
          {chat ? menu("bl", "row") : (
            <Link href={profileHref} className="pt__navi pt__setlink" data-on="0"><Gear size={20} aria-hidden="true" /><span>설정</span></Link>
          )}
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
        {/* 좁은 화면 위 바: 메뉴(서랍) · 브랜드 … 종 · 계정 */}
        <header className="pt__top">
          <div className="pt__topin">
            <DrawerButton />
            <Link href={homeHref} className="pt__brand">
              <Lockup size={20} />
              {plan && <span className="pt__role pt__plan">{plan}</span>}
            </Link>
            <div className="pt__topr">
              {usage && <Link href="/cro/billing" className="pt__usage">{usage}</Link>}
              {bell && <NotiBell href={bell.href} unread={bell.badge ?? 0} recent={recent} />}
              {menu("tr", "avatar")}
            </div>
          </div>
        </header>
        {chat?.top}
        <main className="pt__main" id="main-content">{children}</main>
      </div>
      </div>
      </UiProvider>
    </div>
  );
}
