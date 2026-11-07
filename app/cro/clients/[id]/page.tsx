import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CompanyDetail, DETAIL_TABS, type DetailTab } from "@/components/cro/crm/CompanyDetail";
import { CRM_PATHS, buildOpts } from "@/components/cro/crm/opts";
import { awardsLite, loadCrmSynced } from "@/lib/crm";
import { isUuid, wonKo } from "@/lib/crm-shape";

export const dynamic = "force-dynamic";

/** 고객사 한 곳 (0038). ?p=<담당자 id> 로 좁히기, ?tab=log|quotes|events|tasks|info */
export default async function CroClient({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string; tab?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const { id } = await params;
  if (!isUuid(id) || !dbReady()) notFound();
  const sp = await searchParams;
  const { data, awards } = await loadCrmSynced(org.id, { userId: s.userId, demo: s.demo });
  const company = data.companies.find((c) => c.id === id);
  if (!company) notFound();
  const contacts = data.contacts.filter((c) => c.company_id === id);
  const keys = new Set(contacts.map((c) => c.danchu_key).filter(Boolean));
  const quotes = data.quotes.filter((q) => q.company_id === id);
  const tab = (DETAIL_TABS.some(([k]) => k === sp.tab) ? sp.tab : "log") as DetailTab;
  const scope = sp.p && contacts.some((c) => c.id === sp.p) ? sp.p : null;
  return (
    <CompanyDetail
      d={{
        company, contacts, quotes,
        tracks: data.tracks.filter((t) => quotes.some((q) => q.id === t.doc_id)),
        events: data.events.filter((e) => e.company_id === id),
        activities: data.activities.filter((a) => a.company_id === id),
        tasks: data.tasks.filter((t) => t.company_id === id),
        awards: awardsLite(awards).filter((w) => w.danchuKey && keys.has(w.danchuKey)),
        members: data.members,
        loose: data.quotes.filter((q) => !q.company_id).slice(0, 100).map((q) => ({ id: q.id, name: q.doc_no, sub: [q.client, q.title, wonKo(q.supply)].filter(Boolean).join(" · ") })),
      }}
      scope={scope} tab={tab} paths={CRM_PATHS}
      opts={buildOpts({ ...data, me: s.userId })}
    />
  );
}
