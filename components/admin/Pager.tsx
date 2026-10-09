import Link from "next/link";

/** 단순 이전·다음 페이지. hasMore 는 한 페이지 크기 +1 로 조회해 판단한다 */
export function Pager({ page, hasMore, href }: { page: number; hasMore: boolean; href: (p: number) => string }) {
  if (page <= 1 && !hasMore) return null;
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
      {page > 1 && <Link href={href(page - 1)} className="b2 bsm">이전</Link>}
      <span style={{ alignSelf: "center", fontSize: 13, color: "var(--muted)" }} className="tnum">{page} 페이지</span>
      {hasMore && <Link href={href(page + 1)} className="b2 bsm">다음</Link>}
    </div>
  );
}
