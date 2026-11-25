import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import { ToxStandard } from "@/components/cro/catalog/ToxStandard";
import { catalogItems, itemKey, newVariant } from "@/lib/catalog";
import { croNav, CRO_PATHS } from "@/lib/cro-nav";
import { PLANS } from "@/lib/plans";
import type { PriceItem } from "@/lib/price-book";
import type { Rate } from "@/lib/quote-doc";
import { SESSION, previewEnabled } from "../cro-crm/fixtures";
import "@/components/cro/catalog/catalog.css";
import "@/components/cro/catalog/model.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "독성 표준 설계 검토 · 단추", robots: { index: false, follow: false } };

/** 화면 확인용 예시 값. 실제 기관 설계·단가가 아니다. 저장은 화면 안에서만 */
const item = catalogItems().find((it) => it.key === itemKey("일반독성", "반복투여 4주"))!;
const ROW = {
  ...newVariant(item, {
    source: "manual", species: ["SD 랫드", "ICR 마우스"], route: "경구(PO)", routes: ["경구(PO)", "정맥(IV)"],
    method: "OECD TG 407 (설치류 28일)", glp: "GLP", groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: 2, recovery_per_sex: 5,
    dosing: "28일, 1일 1회", weeks: 14, std_price: 60_000_000,
    includes: ["임상병리", "조직병리(검경 포함)", "조제물분석", "통계분석", "QA 점검", "안과검사"],
    options: [{ name: "TK 분석", amount: 7_000_000 }],
    kd: { tox: { groups: [{ label: "부형제 대조군", dose: "0 mg/kg" }, { label: "저용량군", dose: "100 mg/kg" }, { label: "중용량군", dose: "300 mg/kg" }, { label: "고용량군", dose: "1,000 mg/kg" }] } },
    extra: { exp_recovery: "대조군·고용량군의 마지막 5마리/성을 회복 동물로 지정" },
  }),
  id: "00000000-0000-4000-8000-000000000101",
};
const RATES: Rate[] = [
  { id: "animal", kind: "animal", label: "본시험 동물 수", unit: "마리", add: null, deduct: null, shown: "동물 수 추가 / 차감" },
  { id: "recovery", kind: "recovery", label: "회복군", unit: "마리", add: 900_000, deduct: null, shown: "회복군 추가 / 제외" },
  { id: "group", kind: "group", label: "투여군", unit: "군", add: 4_200_000, deduct: 3_000_000, shown: "투여군 추가 / 제외" },
];
const ITEMS: PriceItem[] = [
  { id: "a1", category: "animal", name: "랫드 SD 수컷 7주", attrs: { species: "랫드", strain: "SD", sex: "수컷", weeks: "7" }, unit: "head", price: 26_000, memo: "", sort: 0, archived: false },
  { id: "a2", category: "animal", name: "마우스 ICR", attrs: { species: "마우스", strain: "ICR" }, unit: "head", price: 9_000, memo: "", sort: 0, archived: false },
];

/** ?book=off 면 단가표를 독성에 쓰지 않는 기관, ?ro=1 이면 읽기 전용 */
export default async function CroToxPreview({ searchParams }: { searchParams: Promise<{ book?: string; ro?: string }> }) {
  if (!previewEnabled()) notFound();
  const sp = await searchParams;
  const { nav, tabs } = croNav("pro", 0, CRO_PATHS);
  return (
    <AppState>
      <Shell session={SESSION} nav={nav} tabs={tabs} plan={PLANS.pro.name}>
        <ToxStandard row={ROW} siblings={[ROW]} rates={RATES} book={{ applyTox: sp.book !== "off", items: ITEMS }} readOnly={sp.ro === "1"} local />
      </Shell>
    </AppState>
  );
}
