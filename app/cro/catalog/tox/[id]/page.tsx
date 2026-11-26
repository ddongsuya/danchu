import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadCatalog } from "@/lib/catalog-db";
import { kindOfCategory } from "@/lib/kind-design";
import { loadRates } from "@/lib/quote-doc-db";
import { loadPriceBook } from "@/lib/price-book-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ToxStandard } from "@/components/cro/catalog/ToxStandard";
import "@/components/cro/catalog/catalog.css";
import "@/components/cro/catalog/model.css";

export const dynamic = "force-dynamic";

/** 독성시험 표준 설계 (2026-11-26). 군 구성·평가항목·추가 비용 단가. 효력 모델 표준과 같은 판 */
export default async function ToxStandardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} pendingOrg={s.pendingOrg} />;
  if (!dbReady()) notFound();
  const sb = getSupabaseAdmin();
  const [rows, rates, book] = await Promise.all([
    loadCatalog(org.id),
    loadRates(org.id),
    sb ? loadPriceBook(sb, org.id).catch((e) => { console.error("tox page price-book", e); return null; }) : null,
  ]);
  const row = rows.find((r) => r.id === id);
  if (!row || kindOfCategory(row.category) !== "tox") notFound();
  return (
    <ToxStandard
      row={row}
      siblings={rows.filter((r) => r.item_key === row.item_key)}
      rates={rates.get(row.item_key)}
      book={book ? { applyTox: !!book.applyTox, items: book.items } : null}
      readOnly={!!s.demo || org.status !== "approved"}
    />
  );
}
