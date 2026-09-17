import { requireSession } from "@/lib/auth";
import { loadCatalog, loadOrgPresets } from "@/lib/catalog-db";
import { catalogItems } from "@/lib/catalog";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CatalogEditor } from "@/components/cro/CatalogEditor";

export const dynamic = "force-dynamic";

export default async function CroCatalogPage() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org) return <PendingOrg org={null} />;
  const [rows, presets] = await Promise.all([loadCatalog(org.id), loadOrgPresets(org.id)]);
  const items = catalogItems();
  const filled = new Set(rows.map((r) => r.item_key)).size;
  return (
    <>
      <div className="ph">
        <div>
          <h1>역량 카탈로그</h1>
          <p>
            시험 항목마다 수행하는 조합(동물종 × 투여경로 × 시험법)을 등록하고, 조합별 표준 설계·리드타임·참고 단가를 적어 두면 요청서가 도착할 때 가장 가까운 조합으로 회신 초안이 채워집니다. 비워 둔 항목은 회신할 때 직접 입력하고, 제출한 값은 자동으로 여기에 쌓입니다. 단가는 선택이며 이 기관의 초안에만 쓰입니다.
          </p>
        </div>
        <span className="pill pill--tint">항목 {filled} / {items.length} · 조합 {rows.length}</span>
      </div>
      <CatalogEditor items={items} initialRows={rows} orgCategories={org.categories} orgPresets={presets} />
    </>
  );
}
