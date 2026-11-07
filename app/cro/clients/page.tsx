import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CompanyList } from "@/components/cro/crm/CompanyList";
import { CRM_PATHS } from "@/components/cro/crm/opts";
import { loadCrmSynced } from "@/lib/crm";
import { COMPANY_FILTERS, companyRows, duplicatePairs, filterRows, isOpenQuote, type CompanyFilter } from "@/lib/crm-shape";

export const dynamic = "force-dynamic";

/**
 * 고객사 (2026-11-07, 0038). 단추에서 선정된 의뢰자는 열 때마다 고객사·담당자로 들어오고, 단추 밖 고객사는 직접 추가한다.
 * ?f= 거르기 (전체·이번 주 일정·열린 견적·단추에서 선정·연락 30일 넘음), ?q= 이름 찾기
 */
export default async function CroClients({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  const filter = (sp.f && sp.f in COMPANY_FILTERS ? sp.f : "all") as CompanyFilter;
  const q = (sp.q ?? "").slice(0, 60);
  if (!dbReady()) return <CompanyList rows={[]} total={{ companies: 0, contacts: 0, openQuotes: 0 }} filter={filter} q={q} dups={[]} paths={CRM_PATHS} ready={false} />;
  const { data } = await loadCrmSynced(org.id, { userId: s.userId, demo: s.demo });
  const rows = companyRows({ companies: data.companies, contacts: data.contacts, quotes: data.quotes, events: data.events, activities: data.activities, tasks: data.tasks });
  const name = new Map(data.companies.map((c) => [c.id, c.name]));
  const dups = duplicatePairs(data.companies).map(([a, b]) => ({ a: { id: a, name: name.get(a) ?? "" }, b: { id: b, name: name.get(b) ?? "" } }));
  return (
    <CompanyList
      rows={filterRows(rows, filter, q)}
      total={{ companies: data.companies.length, contacts: data.contacts.length, openQuotes: data.quotes.filter((x) => x.company_id && isOpenQuote(x)).length }}
      filter={filter} q={q} dups={dups} paths={CRM_PATHS} ready={data.ready}
    />
  );
}
