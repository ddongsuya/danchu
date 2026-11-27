"use client";

import { useRef } from "react";

/** 요금제 비교 창 (시안 검토판 c-plan-pick). 차이가 나는 항목만 줄로 보여 준다. 금액은 공개 전 */
const ROWS: [string, string, string, string][] = [
  ["받은 요청", "포함", "포함", "포함"],
  ["이번 달 5,000만 원 미만 견적", "5건", "제한 없음", "제한 없음"],
  ["시험 목록 · 캘린더", "미제공", "포함", "포함"],
  ["견적서 · 단가표", "미제공", "미제공", "포함"],
  ["오늘 · CRM (안건 · 고객사 · 활동 · 분석)", "미제공", "미제공", "포함"],
  ["담당자 계정", "1", "3", "제한 없음"],
  ["월 요금", "공개 전", "공개 전", "공개 전"],
];

export function PlanCompare() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="b1" onClick={() => ref.current?.showModal()}>요금제 비교</button>
      <dialog ref={ref} className="ix-dialog pln-cmp" aria-labelledby="pln-cmp-title" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="ix-dialog__in">
          <h2 id="pln-cmp-title" className="ix-dialog__title">요금제</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>차이 항목</th><th>무료</th><th>Plus</th><th>Pro</th></tr></thead>
              <tbody>{ROWS.map(([k, ...v]) => <tr key={k}><td>{k}</td>{v.map((x, i) => <td key={i} className="tnum">{x}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="ix-dialog__acts">
            <button type="button" className="b2" onClick={() => ref.current?.close()}>닫기</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
