import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { ModelStandard } from "@/components/cro/catalog/ModelStandard";
import { croNav, CRO_PATHS } from "@/lib/cro-nav";
import { PLANS } from "@/lib/plans";
import { SESSION, previewEnabled } from "../cro-crm/fixtures";
import { PD_ITEMS, PD_MODEL, PD_ROW } from "../pd-fixtures";
import "@/components/cro/catalog/model.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "모델 표준 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 효력 모델 표준 설계 검토용 (시안 v15 예시 금액). 저장은 화면 안에서만 */
export default function CroModelPreview() {
  if (!previewEnabled()) notFound();
  const { nav, tabs } = croNav("pro", 0, CRO_PATHS);
  return (
    <AppState>
      <Shell session={SESSION} nav={nav} tabs={tabs} plan={PLANS.pro.name}>
        <ModelStandard
          row={PD_ROW}
          siblings={[PD_ROW]}
          others={[{ id: "preview-cia", name: "CIA 관절염", pd: { ...PD_MODEL, model: "CIA 관절염" } }]}
          book={{ items: PD_ITEMS, marginPct: 15, log: [] }}
          local
        />
      </Shell>
    </AppState>
  );
}
