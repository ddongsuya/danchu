import "./early-shared.css";

/** 사전예약 안내 네 줄 (사전예약 페이지·메인 팝업이 같이 쓴다) */
export const EARLY_SPEC: [string, string][] = [
  ["예약 기간", "지금부터 2027년 5월 31일까지"],
  ["시범 운영", "2027년 6월 1일 시작"],
  ["이용 요금", "시범 운영 기간 무료"],
  ["예약 소식", "예약 완료, 시범 운영 시작 문자"],
];

export function EarlySpec({ className }: { className?: string }) {
  return (
    <dl className={className ? `es ${className}` : "es"}>
      {EARLY_SPEC.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
