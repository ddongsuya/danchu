import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { CompanyDetail, DETAIL_TABS, type DetailTab } from "@/components/cro/crm/CompanyDetail";
import { buildOpts } from "@/components/cro/crm/opts";
import { awardsLite } from "@/lib/crm";
import { wonKo } from "@/lib/crm-shape";
import { CPATHS, ME, NAV, SESSION, crmSample, previewEnabled, sample } from "../../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "고객사 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 고객사 화면 검토용 (로그인 없이, 저장 안 됨). ?p= 담당자, ?tab= */
export default async function CrmClientPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string; tab?: string }> }) {
  if (!previewEnabled()) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const data = crmSample();
  const company = data.companies.find((c) => c.id === id);
  if (!company) notFound();
  const contacts = data.contacts.filter((c) => c.company_id === id);
  const keys = new Set(contacts.map((c) => c.danchu_key).filter(Boolean));
  const quotes = data.quotes.filter((q) => q.company_id === id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const awards = awardsLite(sample().awards as any).filter((w) => w.danchuKey && keys.has(w.danchuKey));
  const tab = (DETAIL_TABS.some(([k]) => k === sp.tab) ? sp.tab : "log") as DetailTab;
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV}>
        <CompanyDetail
          d={{
            company, contacts, quotes, tracks: data.tracks, events: data.events.filter((e) => e.company_id === id), activities: data.activities.filter((a) => a.company_id === id),
            tasks: data.tasks.filter((t) => t.company_id === id), awards, members: data.members,
            loose: data.quotes.filter((q) => !q.company_id).map((q) => ({ id: q.id, name: q.doc_no, sub: [q.client, q.title, wonKo(q.supply)].join(" · ") })),
          }}
          scope={sp.p && contacts.some((c) => c.id === sp.p) ? sp.p : null} tab={tab} paths={CPATHS} opts={buildOpts({ ...data, me: ME })}
        />
      </Shell>
    </AppState>
  );
}
