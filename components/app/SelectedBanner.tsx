"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/** 선정 확인창이 성공한 뒤 이 배너로 포커스를 옮기라는 표시 (sessionStorage, 요청 번호) */
export const SELECTED_FLAG = "danchu:selected";

/** 비교 보고서 위 선정 결과 배너 (2026-11-27 시안 r-selected). 선정 취소는 정하지 않은 정책이라 버튼이 없다 */
export function SelectedBanner({ no, text }: { no: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SELECTED_FLAG) !== no) return;
      sessionStorage.removeItem(SELECTED_FLAG);
    } catch { return; }
    ref.current?.focus();
  }, [no]);
  return (
    <div ref={ref} tabIndex={-1} className="rq-banner cmp-ban" role="status">
      <p className="rq-banner__t"><b>{text}</b></p>
      <div className="rq-banner__a"><Link href={`/app/r/${no}`} className="b1">진행 상태 보기</Link></div>
    </div>
  );
}
