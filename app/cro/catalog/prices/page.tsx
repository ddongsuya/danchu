import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { loadCatalog } from "@/lib/catalog-db";
import { catalogUsage, loadRates } from "@/lib/quote-doc-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { RatesEditor } from "@/components/cro/quote/RatesEditor";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/** 견적서 단가 (0035): 조건별 표준가 + 시험별 추가 비용 단가 */
export default async function CatalogPrices({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  const [catalog, rates, usage] = dbReady() ? await Promise.all([loadCatalog(org.id), loadRates(org.id), catalogUsage(org.id)]) : [[], new Map(), {}];
  return (
    <>
      <div className="ph">
        <div>
          <Link href="/cro/catalog" className="crumb">역량 카탈로그</Link>
          <h1>견적서 단가</h1>
          <p>견적서 생성 툴이 쓰는 금액이에요. 단추 요청의 비교표나 다른 기관에는 보이지 않아요. 단가 변경은 새 견적서부터 적용돼요.</p>
        </div>
        <div className="ph__actions"><Link href="/cro/docs" className="b2 bsm">견적서 목록</Link></div>
      </div>
      <RatesEditor catalog={catalog} rates={Object.fromEntries(rates)} usage={usage} initialItem={sp.item} readOnly={!!s.demo} />
    </>
  );
}
