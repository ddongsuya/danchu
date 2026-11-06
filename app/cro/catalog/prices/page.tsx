import { redirect } from "next/navigation";

/** 견적서 단가는 시험 목록 서랍으로 합쳤다 (2026-11-06). 예전 링크는 같은 시험을 연다 */
export default async function CatalogPrices({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const sp = await searchParams;
  redirect(sp.item ? `/cro/catalog?item=${encodeURIComponent(sp.item)}` : "/cro/catalog");
}
