import { shortCite } from "@/lib/cite";
import { findDoc } from "@/lib/guideline-library";

/**
 * 가이드라인 근거 표기. 화면에는 "근거 ICH M3 · 식약처 독성시험기준"처럼 문서와 번호만 보이고,
 * 누르면 원래 표기(조항·표·별표)와 문서별 원문 링크(가이드라인 자료실의 공식 주소)를 펼쳐 볼 수 있다.
 * 줄일 것도 없고 원문 링크도 없으면 그냥 한 줄로 둔다.
 */
export function Cite({ basis, className = "cite" }: { basis: string | string[] | undefined | null; className?: string }) {
  if (!basis || (Array.isArray(basis) && !basis.length)) return null;
  const full = Array.isArray(basis) ? basis.join(" · ") : basis;
  const short = shortCite(full);
  if (!short) return null;
  const docs = [...new Set(short.split(" · ").map(findDoc).filter((d) => d !== undefined))];
  if (short === full && !docs.length) return <span className={className}>근거 {short}</span>;
  return (
    <details className={className}>
      <summary>근거 {short}</summary>
      {short !== full && <span className="cite__full">{full}</span>}
      {docs.length > 0 && (
        <span className="cite__links">
          {docs.map((d) => (
            <a key={d.short} href={d.url} target="_blank" rel="noopener noreferrer">{d.short} 원문 보기<span className="sr-only"> (새 창)</span></a>
          ))}
          <a href="/guide/library">가이드라인 자료실</a>
        </span>
      )}
    </details>
  );
}
