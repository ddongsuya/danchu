import { requireSession } from "@/lib/auth";
import { isUuid, personLabel } from "@/lib/crm-shape";
import { STAGE_LABEL, type Stage } from "@/lib/crm-deals";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { LogView } from "@/components/cro/crm/LogView";
import { loadCtx } from "@/components/cro/crm/load";
import { rowsOf } from "@/components/cro/crm/ctx";
import "@/components/cro/crm/crm.css";

export const dynamic = "force-dynamic";

/**
 * 기록 남기기 (시안 v5 휴대폰 3번). ?deal= 안건을 먼저 골라 둔다.
 * 없으면 방금(2시간 안) 시작한 일정의 안건, 그다음 내 안건 중 최근에 손댄 것.
 */
export default async function CroLog({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const s = await requireSession("cro");
  const got = await loadCtx(s);
  if (!got) return <PendingOrg org={s.org} pendingOrg={s.pendingOrg} />;
  const { c } = got;
  const { data, now, me, paths } = c;
  const rows = rowsOf(c).filter((r) => r.deal.status === "open").sort((x, y) => Number(y.mine) - Number(x.mine) || y.deal.updated_at.localeCompare(x.deal.updated_at));
  const ct = (id: string) => data.contacts.find((x) => x.id === id);
  const deals = rows.map((r) => {
    const own = r.deal.contact_ids.map(ct).filter((x): x is NonNullable<typeof x> => !!x);
    const rest = r.deal.company_id ? data.contacts.filter((x) => x.company_id === r.deal.company_id && !r.deal.contact_ids.includes(x.id)) : [];
    return {
      id: r.deal.id, title: r.deal.title, stage: STAGE_LABEL[r.deal.stage as Stage],
      who: [r.company ?? (r.danchuNo ? `단추 ${r.danchuNo}` : ""), r.contact ?? ""].filter(Boolean).join(" · "),
      companyId: r.deal.company_id, contacts: [...own, ...rest].map((x) => ({ id: x.id, name: personLabel(x.name, x.title) })),
    };
  });
  const sp = await searchParams;
  const recent = data.events.filter((e) => e.deal_id && e.starts_at <= new Date(now).toISOString() && e.starts_at >= new Date(now - 2 * 36e5).toISOString()).sort((x, y) => y.starts_at.localeCompare(x.starts_at))[0];
  const start = sp.deal && isUuid(sp.deal) && deals.some((d) => d.id === sp.deal) ? sp.deal : recent?.deal_id && deals.some((d) => d.id === recent.deal_id) ? recent.deal_id : null;
  return <LogView deals={deals} start={start} members={data.members} me={me} back={start ? `${paths.deals}/${start}` : paths.today} base={paths.deals} />;
}
