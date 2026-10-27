import { shortCite } from "@/lib/cite";

/**
 * 가이드라인 근거 표기. 화면에는 "근거 ICH M3 · 식약처 독성시험기준"처럼 문서와 번호만 보이고,
 * 누르면 원래 표기(조항·표·별표)를 펼쳐 볼 수 있다. 줄일 것이 없으면 그냥 한 줄로 둔다.
 */
export function Cite({ basis, className = "cite" }: { basis: string | string[] | undefined | null; className?: string }) {
  if (!basis || (Array.isArray(basis) && !basis.length)) return null;
  const full = Array.isArray(basis) ? basis.join(" · ") : basis;
  const short = shortCite(full);
  if (!short) return null;
  if (short === full) return <span className={className}>근거 {short}</span>;
  return (
    <details className={className}>
      <summary>근거 {short}</summary>
      <span className="cite__full">{full}</span>
    </details>
  );
}
