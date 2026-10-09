/** 목록 검색. GET 폼이라 URL 에 남고 뒤로 가기가 자연스럽다. 다른 쿼리(status 등)는 hidden 으로 유지 */
export function SearchBox({ q, placeholder, keep }: { q: string; placeholder: string; keep?: Record<string, string | undefined> }) {
  return (
    <form method="get" style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input className="inp" type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label="검색" style={{ height: 36, fontSize: 14, minWidth: 220 }} />
      <button type="submit" className="b2 bsm">찾기</button>
    </form>
  );
}
