import type { Metadata, Viewport } from "next";
import { requireSession } from "@/lib/auth";
import { dbReady, listRequestsForUser, unreadCount } from "@/lib/data";
import { ReqColumn, ReqThreads, ReqTop, type ReqThread } from "@/components/app/ReqShell";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { PreregGate } from "@/components/app/Prereg";
import { PREREG_NAV_REQ } from "@/components/app/prereg-nav";
import { daysToPilot } from "@/lib/prereg";
import { sessionInPrereg } from "@/lib/prereg-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { summaryFacetsOf, testNamesOf } from "@/lib/quote-items";
import type { Values } from "@/lib/rfq-schema";

export const metadata: Metadata = {
  title: "단추 · 내 견적 요청",
  description: "비임상 시험 견적을 요청하고 도착한 견적을 비교해요.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "단추" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F4" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("requester", "/app");
  const prereg = await sessionInPrereg(session);
  const live = dbReady() && !prereg;
  const [unread, list] = live ? await Promise.all([unreadCount(session.userId), listRequestsForUser(session.userId)]) : [0, []];
  // 휴대폰 아래 탭 (그대로)
  const tabs: NavItem[] = prereg ? [...PREREG_NAV_REQ] : [
    { href: "/app", label: "홈", icon: "home", exact: true },
    { href: "/app/new", label: "새 요청", icon: "plus" },
    { href: "/app/notifications", label: "알림", icon: "bell", badge: unread },
    { href: "/app/profile", label: "프로필", icon: "user" },
  ];
  // 넓은 화면 사이드바 (2026-11-26 시안 v7 ChatGPT 짜임): 새 요청 · 검색 · 알림 · 자료실, 그 아래 요청 목록
  const nav: NavItem[] = prereg ? [...PREREG_NAV_REQ] : [
    { href: "/app/new", label: "새 견적 요청", icon: "plus" },
    { href: "/app?q=", label: "요청 검색", icon: "search" },
    { href: "/app/notifications", label: "알림", icon: "bell", badge: unread },
    { href: "/guide/library", label: "가이드라인 자료실", icon: "book" },
  ];
  // 운영자가 의뢰자 화면을 볼 때는 운영자 콘솔로 돌아가는 길을 둔다
  if (session.profile.role === "admin") {
    const back: NavItem = { href: "/admin", label: "운영자 콘솔", icon: "settings" };
    tabs.push(back);
    nav.push(back);
  }
  const threads: ReqThread[] = list.map((r) => ({ no: r.rfq_no, substance: r.substance, title: threadTitle(r.payload as Values), categories: r.categories, done: ["closed", "cancelled"].includes(r.status) }));
  return (
    <AppState>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var s=JSON.parse(localStorage.getItem('danchu.app.settings')||'{}');var t=s.theme||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})()",
        }}
      />
      <Shell session={session} nav={nav} tabs={tabs} chat={{ side: <ReqThreads items={threads} />, top: <ReqTop items={threads} /> }}>
        <ReqColumn>{prereg ? <PreregGate role="req" days={daysToPilot()} reserved={await reserved(session.email, "req")}>{children}</PreregGate> : children}</ReqColumn>
      </Shell>
    </AppState>
  );
}


/** 이 이메일로 사전예약했는가 */
async function reserved(email: string, role: "req" | "cro"): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { data } = await sb.from("early_signups").select("id").eq("role", role).eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}

/** 사이드바 요청 이름 (시안 v7): 시험 이름, 동물종이 하나면 괄호로. 세부 시험이 없으면 빈 값 (시험물질로 대신) */
function threadTitle(p: Values): string {
  const name = testNamesOf(p);
  if (!name) return "";
  const { species } = summaryFacetsOf(p);
  return species.length === 1 ? `${name} (${species[0]})` : name;
}
