import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { loadCatalog } from "@/lib/catalog-db";
import { catalogItems } from "@/lib/catalog";
import { loadRates } from "@/lib/quote-doc-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { TestList } from "@/components/cro/catalog/TestList";
import "@/components/cro/catalog/catalog.css";

export const dynamic = "force-dynamic";

/** 시험 목록 (기관 카탈로그). 조건·표준가·추가 비용 단가를 한 화면에서 고친다 */
export default async function CroCatalogPage() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} pendingOrg={s.pendingOrg} />;
  const [rows, rates] = dbReady() ? await Promise.all([loadCatalog(org.id), loadRates(org.id)]) : [[], new Map()];
  return (
    <Suspense>
      <TestList items={catalogItems()} initialRows={rows} initialRates={Object.fromEntries(rates)} orgCategories={org.categories} readOnly={!!s.demo} />
    </Suspense>
  );
}
