import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadPriceBook, type PriceBook } from "@/lib/price-book-db";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { PriceBookView } from "@/components/cro/prices/PriceBookView";
import "@/components/cro/prices/prices.css";

export const dynamic = "force-dynamic";

/** 효력시험 기관 단가표 (0047). 분류마다 다른 칸으로 넣고, 관리비·이익 %와 단가 바꾼 기록을 옆에 둔다 */
export default async function CroPricesPage() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} pendingOrg={s.pendingOrg} />;
  const sb = dbReady() ? getSupabaseAdmin() : null;
  let book: PriceBook = { items: [], marginPct: 0, log: [] };
  let loadError = false;
  if (sb) {
    try {
      book = await loadPriceBook(sb, org.id);
    } catch (e) {
      console.error("price-book page", e);
      loadError = true;
    }
  }
  return <PriceBookView initial={book} readOnly={!!s.demo || org.status !== "approved"} loadError={loadError} />;
}
