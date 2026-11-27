"use client";

import { useSearchParams } from "next/navigation";
import { readBoardUrl, sortLabel } from "@/lib/compare-board";

/** 보고서 머리 줄의 지금 정렬 이름. 표의 정렬을 바꾸면 주소(?sort=)와 함께 바뀐다 */
export function SortLabel() {
  const p = useSearchParams();
  return <>{sortLabel(readBoardUrl(`?${p.toString()}`, "").sort)}</>;
}

/** 보고서를 브라우저 인쇄로 PDF 저장 (인쇄 대화상자에서 PDF로 저장) */
export function ReportPdfButton() {
  return <button type="button" className="b2 bsm noprint" onClick={() => window.print()}>PDF 내려받기</button>;
}
