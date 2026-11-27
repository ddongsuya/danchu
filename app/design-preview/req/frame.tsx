import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { ReqColumn, ReqThreads, ReqTop, type ReqThread } from "@/components/app/ReqShell";
import type { Session } from "@/lib/auth";

/** 의뢰자 화면 검토 틀 (DANCHU_DESIGN_PREVIEW=1). 실제 계정·요청이 아니다 */
const SESSION: Session = { userId: "design-preview", email: "preview@example.invalid", org: null, pendingOrg: null, profile: { id: "design-preview", email: "preview@example.invalid", role: "requester", name: "검토 담당", company: "예시바이오", dept: null, phone: null, org_type: null, cro_org_id: null } };
const NAV: NavItem[] = [
  { href: "/app/new", label: "새 견적 요청", icon: "plus" }, { href: "/app?q=", label: "요청 검색", icon: "search" }, { href: "/app/notifications", label: "알림", icon: "bell", badge: 2 }, { href: "/guide/library", label: "가이드라인 자료실", icon: "book" },
];
const TABS: NavItem[] = [
  { href: "/app", label: "내 견적 요청", icon: "home", exact: true }, { href: "/app/new", label: "새 견적 요청", icon: "plus" }, { href: "/app/notifications", label: "알림", icon: "bell" }, { href: "/app/profile", label: "프로필", icon: "user" },
];
export const THREADS: ReqThread[] = [
  { no: "DEMO-0021", substance: "예시 물질", categories: ["안전성약리"], done: false },
  { no: "DEMO-0019", substance: "예시 물질", categories: ["유전독성"], done: false },
  { no: "DEMO-0012", substance: "예시 물질", categories: ["일반독성"], done: false },
  { no: "DEMO-0007", substance: "예시 물질", categories: ["효력시험(약효)"], done: false },
  { no: "DEMO-0003", substance: "예시 물질", categories: ["일반독성"], done: true },
];

export function ReqFrame({ path, children, empty }: { path: string; children: React.ReactNode; empty?: boolean }) {
  const items = empty ? [] : THREADS;
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV} tabs={TABS} chat={{ side: <ReqThreads items={items} path={path} />, top: <ReqTop items={items} path={path} /> }}>
        <ReqColumn path={path}>{children}</ReqColumn>
      </Shell>
    </AppState>
  );
}
