import { requireSession } from "@/lib/auth";
import { loadCatalog, loadOrgPresets } from "@/lib/catalog-db";
import { catalogItems } from "@/lib/catalog";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CatalogEditor } from "@/components/cro/CatalogEditor";

export const dynamic = "force-dynamic";

export default async function CroCatalogPage() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} pendingOrg={s.pendingOrg} />;
  const [rows, presets] = await Promise.all([loadCatalog(org.id), loadOrgPresets(org.id)]);
  const items = catalogItems();
  const filled = new Set(rows.map((r) => r.item_key)).size;
  return (
    <>
      <div className="ph">
        <div>
          <h1>역량 카탈로그</h1>
          <p>
            자주 하는 시험의 조건·기간·단가를 적어 두면, 요청에 참여할 때 가장 가까운 조합으로 회신 초안이 채워집니다. 비워 둬도 되고, 회신에서 제출한 값은 여기에 저절로 쌓입니다. 적은 값은 이 기관의 초안에만 쓰입니다.
          </p>
        </div>
        <span className="pill pill--tint">항목 {filled} / {items.length} · 조합 {rows.length}</span>
      </div>
      <CatalogEditor items={items} initialRows={rows} orgCategories={org.categories} orgPresets={presets} />
    </>
  );
}
