/** 요청 검색 창 (시안 r-search, Ctrl K). 요청 번호 · 시험 이름 · 시험물질에서 찾는다 (대소문자 · 띄어쓰기 무시) */
export type SearchThread = { no: string; substance: string; title?: string; done: boolean };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export function searchThreads<T extends SearchThread>(items: T[], q: string): { open: T[]; done: T[] } {
  const k = norm(q);
  const hit = k ? items.filter((t) => [t.no, t.substance, t.title ?? ""].some((v) => norm(v).includes(k))) : items;
  return { open: hit.filter((t) => !t.done), done: hit.filter((t) => t.done) };
}
