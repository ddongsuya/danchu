import { requireSession } from "@/lib/auth";
import { dbReady, listInvitesForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CalendarView, calRange, type CalView } from "@/components/cro/crm/CalendarView";
import { CRM_PATHS, buildOpts } from "@/components/cro/crm/opts";
import { loadCrmSynced } from "@/lib/crm";
import { buildAgenda, isUuid, todayKst, ymdKst } from "@/lib/crm-shape";
import { buildPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/**
 * 캘린더 (0038). ?v=month 월 보기(기본 주), ?w=YYYY-MM-DD 그 날이 든 주·달, ?d= 휴대폰에서 고른 날, ?e= 일정 상세, ?mine=1 내 일정만
 */
export default async function CroCalendar({ searchParams }: { searchParams: Promise<{ v?: string; w?: string; d?: string; e?: string; mine?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const today = todayKst();
  const view: CalView = sp.v === "month" ? "month" : "week";
  const anchor = sp.w && ymd.test(sp.w) ? sp.w : today;
  const { from, to } = calRange(view, anchor);
  const empty = { ready: false, companies: [], contacts: [], events: [], activities: [], tasks: [], quotes: [], tracks: [], members: [] };
  const [{ data, awards }, invites] = dbReady()
    ? await Promise.all([loadCrmSynced(org.id, { userId: s.userId, demo: s.demo }), listInvitesForOrg(org.id)])
    : [{ data: empty, awards: [] }, []];
  const pipeline = buildPipeline(invites, awards).map((p) => ({ id: p.id, no: p.no, title: p.title, next: p.next, due: p.due, group: p.group }));
  const items = buildAgenda({ events: data.events, tasks: data.tasks, quotes: data.quotes, pipeline, companies: data.companies, contacts: data.contacts, from, to, me: s.userId });
  const sel = sp.e && isUuid(sp.e) ? data.events.find((e) => e.id === sp.e) ?? null : null;
  const day = sp.d && ymd.test(sp.d) && sp.d >= from && sp.d <= to ? sp.d : sel ? ymdKst(sel.starts_at) : today >= from && today <= to ? today : view === "month" ? `${anchor.slice(0, 7)}-01` : from;
  return (
    <CalendarView
      view={view} anchor={anchor} day={day} items={items} sel={sel} mine={sp.mine === "1"} paths={CRM_PATHS}
      opts={buildOpts({ ...data, me: s.userId })}
      companies={new Map(data.companies.map((c) => [c.id, c.name]))}
      quotes={new Map(data.quotes.map((q) => [q.id, q]))}
    />
  );
}
