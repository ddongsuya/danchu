import { findDoc } from "@/lib/guideline-library";

/** "근거 ICH M3 · 식약처 독성시험기준" 한 줄. 자료실에 있는 문서는 원문으로 바로 잇는다. */
export function BasisLinks({ names, className = "basis" }: { names: string[]; className?: string }) {
  return (
    <p className={className}>
      근거{" "}
      {names.map((n, i) => {
        const d = findDoc(n);
        return (
          <span key={n}>
            {i > 0 && " · "}
            {d ? <a href={d.url} target="_blank" rel="noopener noreferrer">{n}<span className="sr-only"> 원문 (새 창)</span></a> : n}
          </span>
        );
      })}
    </p>
  );
}
