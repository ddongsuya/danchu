import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { CompanyList } from "@/components/cro/crm/CompanyList";
import { COMPANY_FILTERS, companyRows, duplicatePairs, filterRows, isOpenQuote, type CompanyFilter } from "@/lib/crm-shape";
import { CPATHS, NAV, SESSION, crmSample, previewEnabled } from "../fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "고객사 검토 · 단추", robots: { index: false, follow: false } };

/** 고객사 목록 검토용 (로그인 없이, 저장 안 됨). Vercel 미리보기 배포에서만 열린다 */
export default async function CrmClientsPreview({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  if (!previewEnabled()) notFound();
  const sp = await searchParams;
  const filter = (sp.f && sp.f in COMPANY_FILTERS ? sp.f : "all") as CompanyFilter;
  const q = sp.q ?? "";
  const data = crmSample();
  const rows = companyRows(data);
  const name = new Map(data.companies.map((c) => [c.id, c.name]));
  const dups = duplicatePairs(data.companies).map(([a, b]) => ({ a: { id: a, name: name.get(a) ?? "" }, b: { id: b, name: name.get(b) ?? "" } }));
  return (
    <AppState>
      <Shell session={SESSION} nav={NAV}>
        <CompanyList rows={filterRows(rows, filter, q)} total={{ companies: data.companies.length, contacts: data.contacts.length, openQuotes: data.quotes.filter((x) => x.company_id && isOpenQuote(x)).length }} filter={filter} q={q} dups={dups} paths={CPATHS} ready />
      </Shell>
    </AppState>
  );
}
