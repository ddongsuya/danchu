import Link from "next/link";

/** 의뢰자 요청 상세 제목 아래 "다음 할 일" (2026-10-29 과업 점검 2·5). 지금 할 수 있는 일 하나만 */
export function NextStep({ no, kind, cro, croEmail }: { no: string; kind: "no_join" | "contract"; cro?: string; croEmail?: string }) {
  if (kind === "no_join")
    return (
      <div className="next-step" role="status">
        <p><b>회신 기한까지 참여한 기관이 없었어요.</b></p>
        <div className="next-step__actions"><Link href={`/app/support?rfq=${no}`} className="b1">기한 연장 요청</Link><Link href={`/app/r/${no}?end=1#end`} scroll={false} className="b2">요청 마무리</Link></div>
      </div>
    );
  return (
    <div className="next-step" role="status">
      <p><b>선정한 기관({cro})과 계약을 진행해 주세요.</b> 계약은 기관과 직접 맺고, 체결되면 기관이 결과를 보고해요.</p>
      {croEmail && <div className="next-step__actions"><a href={`mailto:${croEmail}?subject=${encodeURIComponent(`[단추 ${no}] 계약 진행`)}`} className="b1">기관 담당자에게 메일</a></div>}
    </div>
  );
}
