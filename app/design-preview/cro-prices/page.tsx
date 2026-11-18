import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { PriceBookView } from "@/components/cro/prices/PriceBookView";
import { croNav, CRO_PATHS } from "@/lib/cro-nav";
import { PLANS } from "@/lib/plans";
import type { PriceItem } from "@/lib/price-book";
import { SESSION, previewEnabled } from "../cro-crm/fixtures";
import "@/components/cro/prices/prices.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "단가표 화면 검토 · 단추", robots: { index: false, follow: false } };

/** 화면 확인용 예시 금액 (시안 v15 와 같은 값). 실제 기관 단가가 아니다. 저장은 화면 안에서만 */
const I = (id: string, category: PriceItem["category"], attrs: Record<string, string>, unit: PriceItem["unit"], price: number, memo = "", name?: string): PriceItem => ({
  id, category, attrs, unit, price, memo, sort: 0, archived: false,
  name: name ?? Object.values(attrs).join(" "),
});
const ITEMS: PriceItem[] = [
  I("a1", "animal", { species: "마우스", strain: "C57BL/6", sex: "수컷", weeks: "8" }, "head", 38000, "SPF", "마우스 C57BL/6 수컷 8주"),
  I("a2", "animal", { species: "마우스", strain: "BALB/c", sex: "암컷", weeks: "6" }, "head", 24000, "SPF", "마우스 BALB/c 암컷 6주"),
  I("a3", "animal", { species: "랫드", strain: "SD", sex: "수컷", weeks: "7" }, "head", 26000, "SPF", "랫드 SD 수컷 7주"),
  I("h1", "housing", { species: "마우스", condition: "SPF" }, "head_day", 2500),
  I("h2", "housing", { species: "랫드", condition: "SPF" }, "head_day", 4000),
  I("m1", "model", { model: "DSS 대장염", method: "화학 유발", reagent: "포함" }, "head", 30000),
  I("m2", "model", { model: "CIA 관절염", method: "면역 유발", reagent: "포함" }, "head", 45000),
  I("m3", "model", { model: "피하 종양", method: "세포 접종", reagent: "별도" }, "head", 20000),
  I("d1", "dosing", { route: "경구", size: "소동물" }, "head_time", 3000, "존데"),
  I("d2", "dosing", { route: "복강", size: "소동물" }, "head_time", 3500),
  I("d3", "dosing", { route: "양성대조물질 구입" }, "lot", 400000, "모델별"),
  I("o1", "observe", { item: "체중" }, "head_time", 500),
  I("o2", "observe", { item: "임상 점수" }, "head_time", 1500),
  I("o3", "observe", { item: "종양 크기" }, "head_time", 1500),
  I("o4", "observe", { item: "채혈" }, "head_time", 5000),
  I("q1", "molecular", { method: "ELISA", matrix: "혈청" }, "sample_item", 30000, "duplicate", "사이토카인 ELISA 혈청"),
  I("q2", "molecular", { method: "qPCR", matrix: "조직" }, "sample_item", 25000, "1유전자"),
  I("p1", "pathology", { stain: "H&E", organs: "1", reading: "포함" }, "slide", 60000),
  I("p2", "pathology", { stain: "IHC", organs: "1", reading: "포함" }, "slide", 120000),
  I("r1", "report", { item: "최종 보고서", lang: "국문" }, "lot", 1500000),
];
const LOG = [
  { id: 2, item_name: "H&E 염색", before: 55000, after: 60000, via: "web", changed_at: "2026-11-18T01:00:00Z" },
  { id: 1, item_name: "마우스 사육", before: 2300, after: 2500, via: "web", changed_at: "2026-10-02T01:00:00Z" },
];

export default function CroPricesPreview() {
  if (!previewEnabled()) notFound();
  const { nav, tabs } = croNav("pro", 0, CRO_PATHS);
  return (
    <AppState>
      <Shell session={SESSION} nav={nav} tabs={tabs} plan={PLANS.pro.name}>
        <PriceBookView initial={{ items: ITEMS, marginPct: 15, log: LOG }} local />
      </Shell>
    </AppState>
  );
}
