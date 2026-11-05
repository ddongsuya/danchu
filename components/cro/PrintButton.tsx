"use client";

/** 브라우저 인쇄로 PDF 저장 (인쇄 대화상자에서 "PDF로 저장") */
export function PrintButton({ label = "PDF로 저장" }: { label?: string }) {
  return (
    <button type="button" className="b2" onClick={() => window.print()}>
      {label}
    </button>
  );
}
