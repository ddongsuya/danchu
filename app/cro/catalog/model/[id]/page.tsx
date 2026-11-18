import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadCatalog } from "@/lib/catalog-db";
import { kindOfCategory } from "@/lib/kind-design";
import { kdFromCatalog } from "@/lib/quote-doc";
import { loadPriceBook, type PriceBook } from "@/lib/price-book-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { ModelStandard } from "@/components/cro/catalog/ModelStandard";
import "@/components/cro/catalog/model.css";

export const dynamic = "force-dynamic";

/** 효력 모델 표준 설계 (0047). 일 단위 스키마·군 구성·평가항목과 단가표로 계산한 표준가 */
export default async function ModelStandardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} pendingOrg={s.pendingOrg} />;
  if (!dbReady()) notFound();
  const sb = getSupabaseAdmin();
  const rows = await loadCatalog(org.id);
  const row = rows.find((r) => r.id === id);
  if (!row || kindOfCategory(row.category) !== "pd") notFound();
  let book: PriceBook = { items: [], marginPct: 0, log: [] };
  if (sb) {
    try {
      book = await loadPriceBook(sb, org.id);
    } catch (e) {
      console.error("model page price-book", e);
    }
  }
  const pd = kdFromCatalog("pd", row)?.pd;
  if (!pd) notFound();
  const others = rows
    .filter((r) => r.id !== row.id && kindOfCategory(r.category) === "pd" && r.kd?.pd)
    .map((r) => ({ id: r.id, name: r.kd!.pd!.model || r.item, pd: r.kd!.pd! }));
  return (
    <ModelStandard
      row={{ ...row, kd: { ...row.kd, pd } }}
      siblings={rows.filter((r) => r.item_key === row.item_key)}
      others={others}
      book={book}
      readOnly={!!s.demo || org.status !== "approved"}
    />
  );
}
