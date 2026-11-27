import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { NotificationsView } from "@/components/notifications/NotificationsView";
import { SettingsView, type Section } from "@/components/settings/SettingsPage";
import { SupportForm } from "@/components/SupportForm";
import { croNav, CRO_PATHS } from "@/lib/cro-nav";
import type { Session } from "@/lib/auth";
import type { NotificationRow } from "@/lib/data";
import { SESSION as CRO, previewEnabled } from "../cro-crm/fixtures";
import { ReqFrame } from "../req/frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "공용 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 예시 알림 (실제 알림이 아니다) */
const NOTI: NotificationRow[] = [
  { id: "n1", kind: "기관", title: "기관 참여", body: "DEMO-0021 · 1곳 참여", href: null, read_at: null, created_at: "2026-11-26T01:00:00Z" },
  { id: "n2", kind: "견적", title: "견적 도착", body: "DEMO-0019 · 견적 1건", href: null, read_at: null, created_at: "2026-11-25T01:00:00Z" },
  { id: "n3", kind: "계약", title: "계약 결과 보고", body: "DEMO-0003 · 예시 기관 B", href: null, read_at: "2026-11-24T01:00:00Z", created_at: "2026-11-20T01:00:00Z" },
  { id: "n4", kind: "비교", title: "기관 질의", body: "DEMO-0019 · 기관 A", href: null, read_at: "2026-11-24T01:00:00Z", created_at: "2026-11-19T01:00:00Z" },
];
const REQ: Session = { userId: "design-preview", email: "preview@example.invalid", org: null, pendingOrg: null, profile: { id: "design-preview", email: "preview@example.invalid", role: "requester", name: "검토 담당", company: "예시바이오", dept: null, phone: null, org_type: null, cro_org_id: null } };
const ADM: Session = { ...REQ, profile: { ...REQ.profile, role: "admin", name: "운영 담당", company: null } };

/**
 * 공용 화면 검토 (로그인 없이, 예시 데이터). 미리보기 배포에서만 열린다.
 * ?view=noti&role=req|cro|admin (&state=empty|unread0|err) · ?view=set&role=req|cro|admin&section=general|noti|company|account|security · ?view=support
 */
export default async function SharedPreview({ searchParams }: { searchParams: Promise<{ view?: string; role?: string; state?: string; section?: string }> }) {
  if (!previewEnabled()) notFound();
  const q = await searchParams;
  const role = q.role === "cro" ? "cro" : q.role === "admin" ? "admin" : "req";
  const s = role === "cro" ? CRO : role === "admin" ? ADM : REQ;
  let body: React.ReactNode;
  if (q.view === "set") {
    const section = (["general", "noti", "company", "account", "security"].includes(q.section ?? "") ? q.section : "general") as Section;
    body = <SettingsView s={s} section={section} noti={q.state === "err" ? undefined : { email: true, sms: false, hasPhone: false }} />;
  } else if (q.view === "support") {
    body = <SupportForm email={s.email} requests={[{ no: "DEMO-0019", substance: "예시 물질" }]} />;
  } else {
    const st = q.state ?? "";
    const list = st === "empty" || st === "unread0" || st === "err" ? [] : NOTI;
    const base = role === "cro" ? "/cro/notifications" : role === "admin" ? "/admin/notifications" : "/app/notifications";
    body = <NotificationsView role={s.profile.role} base={base} list={list} unread={st === "empty" || st === "unread0" ? 0 : 2} hasMore={false} failed={st === "err"} kind="" onlyUnread={st === "unread0"} page={1} />;
  }
  if (role === "req") return <ReqFrame path={q.view === "set" ? "/app/profile" : q.view === "support" ? "/app/support" : "/app/notifications"}>{body}</ReqFrame>;
  const nav = role === "cro" ? croNav("pro", 2, CRO_PATHS).nav : [{ href: "/admin", label: "접수", icon: "list" as const, exact: true }, { href: "/admin/profile", label: "프로필", icon: "user" as const }];
  return (
    <AppState>
      <Shell session={s} nav={nav} recent={NOTI}>
        {body}
      </Shell>
    </AppState>
  );
}
