import { requireSession } from "@/lib/auth";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CalendarView, calRange, type CalView } from "@/components/cro/crm/CalendarView";
import { CRM_PATHS, buildOpts } from "@/components/cro/crm/opts";
import { loadCtx } from "@/components/cro/crm/load";
import { danchuNext } from "@/lib/crm-deals";
import { buildAgenda, isUuid, todayKst, ymdKst, type DanchuDue } from "@/lib/crm-shape";

export const dynamic = "force-dynamic";

/**
 * 캘린더 (0038). ?v=month 월 보기(기본 주), ?w=YYYY-MM-DD 그 날이 든 주·달, ?d= 휴대폰에서 고른 날, ?e= 일정 상세, ?mine=1 내 일정만
 */
export default async function CroCalendar({ searchParams }: { searchParams: Promise<{ v?: string; w?: string; d?: string; e?: string; mine?: string }> }) {
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const today = todayKst();
  const view: CalView = sp.v === "month" ? "month" : "week";
  const anchor = sp.w && ymd.test(sp.w) ? sp.w : today;
  const { from, to } = calRange(view, anchor);
  const { data, danchu: srcs } = got.bundle;
  // 단추 요청 기한 (회신·참여 결정). 끝난 안건은 뺀다
  const dealOf = new Map(data.deals.filter((d) => d.invite_id).map((d) => [d.invite_id as string, d]));
  const danchu: DanchuDue[] = [...srcs.values()].flatMap((x) => {
    const deal = dealOf.get(x.inviteId);
    if (deal && deal.status !== "open") return [];
    const n = danchuNext(x);
    return n?.due ? [{ id: deal?.id ?? x.inviteId, dealId: deal?.id ?? null, no: x.rfqNo, title: x.cats.slice(0, 2).join(" · ") || "시험 요청", next: n.label, due: n.due, href: n.href }] : [];
  });
  const items = buildAgenda({ events: data.events, tasks: data.tasks, quotes: data.quotes, danchu, deals: data.deals, companies: data.companies, contacts: data.contacts, from, to, me: s.userId, base: { deals: CRM_PATHS.deals, docs: CRM_PATHS.docs } });
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
