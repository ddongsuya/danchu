/**
 * 단가표를 독성시험 동물 단가에도 쓰기 (0051 cro_price_settings.apply_tox, 기관 설정).
 * 켜면 시험 목록의 독성 단가 중 본시험 동물·회복군 줄의 추가 단가가 빈 칸일 때만 단가표 "동물" 분류 단가로 채운다.
 * 기관이 적은 단가는 그대로 둔다. 순수 함수만 둔다 (DB 는 부르는 쪽).
 */
import type { CatalogRow } from "./catalog";
import { kindOfCategory } from "./kind-design";
import type { PriceItem } from "./price-book";
import { defaultRates, standardGroups, type Rate } from "./quote-doc";

const tokens = (s: string) => s.toLowerCase().split(/[\s()·,]+/).filter(Boolean);

/** 시험 목록 동물종("SD 랫드")과 단가표 동물 항목이 얼마나 맞는지. 2: 계통까지, 1: 종만, 0: 안 맞음 */
function speciesScore(it: PriceItem, species: string): 0 | 1 | 2 {
  const want = tokens(species);
  if (!want.length) return 0;
  const strain = (it.attrs.strain ?? "").toLowerCase().replace(/\s+/g, "");
  const kind = (it.attrs.species ?? "").toLowerCase().replace(/\s+/g, "");
  if (strain && want.includes(strain)) return 2;
  const have = new Set([...tokens(it.name), ...tokens(it.attrs.species ?? ""), ...tokens(it.attrs.strain ?? "")]);
  if (want.every((t) => have.has(t))) return 2;
  if (!strain && kind && want.includes(kind)) return 1;
  return 0;
}

/**
 * 이 동물종의 단가표 동물 단가 (마리당). 없으면 null.
 * ponytail: 같은 계통이 성별·주령으로 여러 줄이면 단가표 순서의 첫 줄을 쓴다. 성별 단가가 필요하면 시험 목록에 직접 적는다
 */
export function animalPriceFor(items: PriceItem[], species: string): PriceItem | null {
  let best: PriceItem | null = null;
  let score = 0;
  for (const it of items) {
    if (it.category !== "animal" || it.unit !== "head" || it.archived) continue;
    const s = speciesScore(it, species);
    if (s > score) { best = it; score = s; }
  }
  return best;
}

const FILL = new Set<Rate["kind"]>(["animal", "recovery"]);

/**
 * 본시험 동물·회복군 줄의 빈 추가 단가를 단가표로 채운다. species[0] 은 대표 동물종(단가 칸), 나머지는 동물종별 칸.
 * 추가 단가를 기관이 적은 줄은 그대로 둔다. 차감 단가는 건드리지 않는다 (비면 추가 단가로 뺀다)
 */
export function fillToxRates(rates: Rate[], species: string[], items: PriceItem[]): Rate[] {
  return rates.map((r) => {
    if (!FILL.has(r.kind) || r.add != null) return r;
    const main = species[0] ? animalPriceFor(items, species[0]) : null;
    const bySpecies = { ...(r.bySpecies ?? {}) };
    for (const sp of species.slice(1)) {
      if (bySpecies[sp]?.add != null) continue;
      const p = animalPriceFor(items, sp);
      if (p && p.price !== main?.price) bySpecies[sp] = { add: p.price, deduct: bySpecies[sp]?.deduct ?? null };
    }
    const next: Rate = { ...r, add: main?.price ?? null };
    if (Object.keys(bySpecies).length) next.bySpecies = bySpecies;
    return next;
  });
}

/**
 * 견적서가 쓰는 시험별 단가 (항목 키 → 단가). 설정이 꺼져 있으면 그대로.
 * 독성 시험만, 그 시험 줄들의 동물종을 모아 채운다. 단가를 저장하지 않은 군 구성 시험은 기본 줄(동물 수·회복군·투여군)부터 채운다
 */
export function toxBookRates(rates: ReadonlyMap<string, Rate[]>, rows: CatalogRow[], book: { items: PriceItem[]; applyTox?: boolean } | null | undefined): Map<string, Rate[]> {
  const out = new Map(rates);
  if (!book?.applyTox || !book.items.length) return out;
  const byKey = new Map<string, CatalogRow[]>();
  for (const r of rows) if (kindOfCategory(r.category) === "tox") byKey.set(r.item_key, [...(byKey.get(r.item_key) ?? []), r]);
  for (const [key, list] of byKey) {
    const saved = rates.get(key);
    const base = saved?.length ? saved : list.some((r) => standardGroups(r).length > 0) ? defaultRates(true) : [];
    if (!base.length) continue;
    const species = [...new Set(list.flatMap((r) => r.species))];
    out.set(key, fillToxRates(base, species, book.items));
  }
  return out;
}
