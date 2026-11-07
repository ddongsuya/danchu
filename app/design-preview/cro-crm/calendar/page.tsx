import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { CalendarView, calRange, type CalView } from "@/components/cro/crm/CalendarView";
import { buildOpts } from "@/components/cro/crm/opts";
import { buildAgenda, todayKst, ymdKst } from "@/lib/crm-shape";
import { buildPipeline } from "@/lib/pipeline";
import { CPATHS, ME, NAV, SESSION, crmSample, previewEnabled, previewMonday, sample } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "캘린더 검토 · 단추", robots: { index: false, follow: false } };

/** 캘린더 검토용 (로그인 없이, 저장 안 됨). ?v=month, ?w=, ?d=, ?e=, ?mine=1 */
export default async function CrmCalendarPreview({ searchParams }: { searchParams: Promise<{ v?: string; w?: string; d?: string; e?: string; mine?: string }> }) {
  if (!previewEnabled()) notFound();
  const sp = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const today = todayKst();
  const view: CalView = sp.v === "month" ? "month" : "week";
  const anchor = sp.w && ymd.test(sp.w) ? sp.w : previewMonday();
  const { from, to } = calRange(view, anchor);
  const data = crmSample();
  const { invites, awards } = sample();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline = buildPipeline(invites as any, awards as any).map((p) => ({ id: p.id, no: p.no, title: p.title, next: p.next, due: p.due, group: p.group }));
  const items = buildAgenda({ events: data.events, tasks: data.tasks, quotes: data.quotes, pipeline, companies: data.companies, contacts: data.contacts, from, to, me: ME, base: { clients: CPATHS.clients, pipe: CPATHS.pipe, docs: CPATHS.docs } });
  const sel = sp.e ? data.events.find((e) => e.id === sp.e) ?? null : null;
  const day = sp.d && ymd.test(sp.d) && sp.d >= from && sp.d <= to ? sp.d : sel ? ymdKst(sel.starts_at) : today >= from && today <= to ? today : from;
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV}>
        <CalendarView view={view} anchor={anchor} day={day} items={items} sel={sel} mine={sp.mine === "1"} paths={CPATHS} opts={buildOpts({ ...data, me: ME })}
          companies={new Map(data.companies.map((c) => [c.id, c.name]))} quotes={new Map(data.quotes.map((q) => [q.id, q]))} />
      </Shell>
    </AppState>
  );
}
