import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompareBoard, type CompareCol, type CompareRowDef } from "@/components/CompareBoard";
import { CompareReport } from "@/components/app/CompareReport";
import { ComparePending } from "@/components/app/ComparePending";
import { SelectedBanner } from "@/components/app/SelectedBanner";
import { Crumb } from "@/components/app/ui";
import { previewEnabled } from "../../cro-crm/fixtures";
import { ReqFrame } from "../frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "비교 보고서 검토 · 단추", robots: { index: false, follow: false } };

/** 예시 숫자 (가상, VAT 별도). 시안 검토판 DEMO-0012 시나리오: 기관 A는 2차, 기관 C는 1차 유지, 기관 C는 견적서 PDF 없음 */
const ROWS: CompareRowDef[] = [
  { seq: 1, name: "반복투여 4주", category: "일반독성" },
  { seq: 2, name: "회복 2주", category: "일반독성" },
  { seq: 3, name: "TK 위성군 · 분석", category: "PK/TK/ADME·생체시료분석" },
  { seq: 4, name: "조제물분석", category: "조제물분석" },
];
const M = 1_000_000;
const col = (id: string, name: string, amounts: number[], over: Partial<CompareCol>): CompareCol => ({
  id, name, total: amounts.reduce((a, b) => a + b, 0) * M, weeks: 20, final: null, finalReport: null, start: "2027-08-23", valid: "2027-07-31",
  pay: "착수금 30% 계약 시 · 중도금 40% 중간 보고서 제출 시 · 잔금 30% 최종 보고서 제출 시", includes: ["임상병리", "조직병리(검경 포함)", "TK 분석"], note: null,
  glpOk: true, glpMissing: [], glp: ["식약처(KGLP)"], unavailable: [], conditional: 0,
  items: amounts.map((a, i) => ({ seq: i + 1, avail: "가능", amount: a * M, weeks: i === 0 ? 4 : 2 })),
  hasPdf: true, selected: false, auto: false, revision: 1, blocked: null, arrivedAt: "2027-06-28", askHref: "/design-preview/qna", ...over,
});
function cols(sel: boolean): CompareCol[] {
  return [
    col("qa", "예시 기관 A", [86, 13, 15, 4], { weeks: 20, note: "TK는 위성군 암수 각 3마리, 9시점 기준이에요. 2차에서 회복군을 고용량군만으로 줄였어요.", selected: sel, detail: { status: "submitted", total: 112 * M, weeks: 20, note: null, at: "2027-07-08", items: [{ seq: 2, amount: 7 * M, weeks: 2, mode: "as_requested", reason: "" }] } }),
    col("qb", "예시 기관 B", [95, 14, 18, 5], { weeks: 22, arrivedAt: "2027-06-29", start: "2027-09-06", valid: "2027-08-13", pay: "착수금 50% 계약 시 · 잔금 50% 최종 보고서 제출 시", note: "회복군은 대조군과 고용량군 기준이에요." }),
    col("qc", "예시 기관 C", [78, 12, 11, 4], { weeks: 24, arrivedAt: "2027-06-30", start: "2027-08-16", valid: "2027-07-30", hasPdf: false, conditional: 1, includes: ["임상병리", "조직병리(검경 포함)"], note: "TK는 6시점 기준이에요.", detail: { status: "kept", total: null, weeks: null, note: null, items: [] }, items: [{ seq: 1, avail: "가능", amount: 78 * M, weeks: 4 }, { seq: 2, avail: "가능", amount: 12 * M, weeks: 2 }, { seq: 3, avail: "조건부 가능", amount: 11 * M, weeks: 2 }, { seq: 4, avail: "가능", amount: 4 * M, weeks: 2 }] }),
  ];
}

/**
 * 비교 보고서 검토 (로그인 없이, DANCHU_DESIGN_PREVIEW=1). ?s=pre 열리기 전 · ?s=sel 선정 뒤 · 없으면 선정 전.
 * 상세 패널은 주소 끝에 #q-qa (견적서 PDF 분할은 #q-qa/doc, 예시라 PDF 는 불러오지 못한 상태로 보인다)
 */
export default async function ComparePreview({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (!previewEnabled()) notFound();
  const { s } = await searchParams;
  const path = "/app/r/DEMO-0012/compare";
  if (s === "pre") {
    return (
      <ReqFrame path={path}>
        <Crumb href="/design-preview/req/compare" label="DEMO-0012" />
        <ComparePending replyBy="2027-07-01" f={{ sent: 3, opened: 3, joined: 3, submitted: 2, rest: 0 }} ended={false} />
      </ReqFrame>
    );
  }
  const sel = s === "sel";
  const c = cols(sel);
  return (
    <ReqFrame path={path}>
      <Crumb href="/design-preview/req/compare" label="DEMO-0012" />
      <CompareReport
        comparedAt="2027-06-30T07:40:00Z"
        cols={c}
        rows={ROWS}
        board={<CompareBoard no="DEMO-0012" cols={c} rows={ROWS} canSelect={!sel} />}
        banner={sel ? <SelectedBanner no="DEMO-0012" text="7월 12일 예시 기관 A를 선정했어요 · 계약 결과 보고 기한 7월 26일" /> : null}
        detailHref={s === "open" ? "/design-preview/detail" : null}
      />
    </ReqFrame>
  );
}
