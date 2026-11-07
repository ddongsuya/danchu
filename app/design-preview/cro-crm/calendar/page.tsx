import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarView, calRange, type CalView } from "@/components/cro/crm/CalendarView";
import { buildOpts } from "@/components/cro/crm/opts";
import { danchuNext } from "@/lib/crm-deals";
import { buildAgenda, todayKst, ymdKst, type DanchuDue } from "@/lib/crm-shape";
import { Frame } from "../frame";
import { CPATHS, ME, previewCtx, previewEnabled, previewMonday } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "캘린더 검토 · 단추", robots: { index: false, follow: false } };

/** 캘린더 검토용. ?v=month, ?w=, ?d=, ?e=, ?mine=1 */
export default async function CrmCalendarPreview({ searchParams }: { searchParams: Promise<{ v?: string; w?: string; d?: string; e?: string; mine?: string }> }) {
  if (!previewEnabled()) notFound();
  const sp = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const today = todayKst();
  const view: CalView = sp.v === "month" ? "month" : "week";
  const anchor = sp.w && ymd.test(sp.w) ? sp.w : previewMonday();
  const { from, to } = calRange(view, anchor);
  const { data, danchu: srcs } = previewCtx();
  const dealOf = new Map(data.deals.filter((d) => d.invite_id).map((d) => [d.invite_id as string, d]));
  const danchu: DanchuDue[] = [...srcs.values()].flatMap((x) => {
    const deal = dealOf.get(x.inviteId);
    if (deal && deal.status !== "open") return [];
    const n = danchuNext(x);
    return n?.due ? [{ id: deal?.id ?? x.inviteId, dealId: deal?.id ?? null, no: x.rfqNo, title: x.cats.slice(0, 2).join(" · "), next: n.label, due: n.due, href: n.href }] : [];
  });
  const items = buildAgenda({ events: data.events, tasks: data.tasks, quotes: data.quotes, danchu, deals: data.deals, companies: data.companies, contacts: data.contacts, from, to, me: ME, base: { deals: CPATHS.deals, docs: CPATHS.docs } });
  const sel = sp.e ? data.events.find((e) => e.id === sp.e) ?? null : null;
  const day = sp.d && ymd.test(sp.d) && sp.d >= from && sp.d <= to ? sp.d : sel ? ymdKst(sel.starts_at) : today >= from && today <= to ? today : from;
  return (
    <Frame>
      <CalendarView view={view} anchor={anchor} day={day} items={items} sel={sel} mine={sp.mine === "1"} paths={CPATHS} opts={buildOpts({ ...data, me: ME })}
        companies={new Map(data.companies.map((c) => [c.id, c.name]))} quotes={new Map(data.quotes.map((q) => [q.id, q]))} />
    </Frame>
  );
}
