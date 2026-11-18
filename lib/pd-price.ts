/**
 * 효력시험 금액 계산 (0047, 효력시험 견적 툴 구현 계획).
 * 금액 = Σ 사용량 × 단가표 단가, 견적 금액 = 단가 합계 × (1 + 관리비·이익 %). 원 단위 반올림.
 * 사용량은 설계(군 구성·횟수)에서 나온다. 금액은 코드만 계산한다 (AI 가 쓴 금액은 받지 않는다).
 */
import { COST_KEYS, type CostKey, type PdRole } from "./kind-design";
import { CAT_BUCKET, PRICE_UNIT_LABEL, type PriceItem, type PriceUnit } from "./price-book";

/** 사용량 규칙 한 줄. 사용량 = 대상 마리 × times × per (대상이 none 이면 1 × times × per) */
export type PriceUse = {
  itemId: string;
  /** 누구에게: 전 군 · 유발군(정상군 제외) · 투여군(정상군 제외) · 동물과 무관(1식·개) */
  who: "all" | "induced" | "dosed" | "none";
  /** 횟수·일수·시간 (마리·일이면 일수, 마리·회면 횟수) */
  times: number;
  /** 검체당 항목 수·장기 수 같은 곱 (없으면 1) */
  per: number;
  /** 견적서 비용 묶음. 없으면 분류 기본값 */
  bucket?: CostKey;
};

export type PriceGroup = { id: string; role: PdRole; n: number };

export type PriceLine = {
  itemId: string; name: string; unit: PriceUnit; price: number;
  usage: number; amount: number; bucket: CostKey;
  /** "40마리 × 17일 × 2,500" 같은 계산식 */
  formula: string;
  /** 단가표에 없거나 숨긴 항목: 금액을 짐작하지 않고 0 으로 두고 표시 */
  missing: boolean;
};

export type PriceResult = {
  lines: PriceLine[];
  /** 단가 합계 (관리비·이익 전) */
  sum: number;
  marginPct: number;
  margin: number;
  /** 견적 금액 (부가세 별도) */
  total: number;
  /** 견적서 비용 내역 다섯 칸. 관리비·이익을 묶음마다 나눠 더하고, 끝자리는 마지막 묶음에 맞춘다 */
  buckets: Record<CostKey, number>;
  missing: number;
};

const v0 = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);
const won = (n: number) => n.toLocaleString("ko-KR");

export function animalsOf(groups: PriceGroup[], who: PriceUse["who"]): number {
  if (who === "none") return 1;
  return groups.reduce((a, g) => a + (who === "all" || g.role !== "normal" ? v0(g.n) : 0), 0);
}

const TIMES_WORD: Partial<Record<PriceUnit, string>> = { head_day: "일", cage_day: "일", head_time: "회", head_hour: "시간" };
const PER_WORD: Partial<Record<PriceUnit, string>> = { sample_item: "항목", sample_panel: "패널", slide: "장" };

function formulaOf(u: PriceUse, unit: PriceUnit, animals: number, price: number): string {
  const bits: string[] = [];
  if (u.who !== "none") bits.push(`${won(animals)}마리`);
  if (u.times !== 1 || TIMES_WORD[unit]) bits.push(`${won(u.times)}${TIMES_WORD[unit] ?? "회"}`);
  if (u.per !== 1 || PER_WORD[unit]) bits.push(`${won(u.per)}${PER_WORD[unit] ?? ""}`);
  if (!bits.length) bits.push(PRICE_UNIT_LABEL[unit]);
  return `${bits.join(" × ")} × ${won(price)}`;
}

/** 설계와 단가표로 금액 계산 */
export function pdPrice(groups: PriceGroup[], uses: PriceUse[], items: PriceItem[], marginPct: number): PriceResult {
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: PriceLine[] = uses.map((u) => {
    const it = byId.get(u.itemId);
    const times = Math.max(0, Math.round(v0(u.times) * 100) / 100);
    const per = Math.max(0, v0(u.per) || 1);
    const animals = animalsOf(groups, u.who);
    const usage = Math.round(animals * times * per * 100) / 100;
    if (!it || it.archived) {
      return { itemId: u.itemId, name: it?.name ?? "단가표에 없는 항목", unit: it?.unit ?? "lot", price: 0, usage, amount: 0, bucket: u.bucket ?? (it ? CAT_BUCKET[it.category] : "cost_report"), formula: "", missing: true };
    }
    const amount = Math.round(usage * it.price);
    return { itemId: it.id, name: it.name, unit: it.unit, price: it.price, usage, amount, bucket: u.bucket ?? CAT_BUCKET[it.category], formula: formulaOf({ ...u, times, per }, it.unit, animals, it.price), missing: false };
  });
  const sum = lines.reduce((a, l) => a + l.amount, 0);
  const pct = Math.max(0, marginPct);
  const margin = Math.round((sum * pct) / 100);
  const total = sum + margin;

  const raw = Object.fromEntries(COST_KEYS.map((k) => [k, 0])) as Record<CostKey, number>;
  for (const l of lines) raw[l.bucket] += l.amount;
  const buckets = Object.fromEntries(COST_KEYS.map((k) => [k, Math.round(raw[k] * (1 + pct / 100))])) as Record<CostKey, number>;
  const last = [...COST_KEYS].reverse().find((k) => raw[k] > 0);
  if (last) buckets[last] += total - COST_KEYS.reduce((a, k) => a + buckets[k], 0);

  return { lines, sum, marginPct: pct, margin, total, buckets, missing: lines.filter((l) => l.missing).length };
}

export type PriceDiffLine = { itemId: string; name: string; unit: PriceUnit; before: number; after: number; delta: number; usageBefore: number; usageAfter: number };

/** 표준 설계 대비 바뀐 항목 (요청 반영 화면의 금액 장부). 사용량이 같은 줄은 뺀다 */
export function pdPriceDiff(std: PriceResult, cur: PriceResult): { lines: PriceDiffLine[]; sumDelta: number; marginDelta: number; totalDelta: number } {
  const ids = [...new Set([...std.lines.map((l) => l.itemId), ...cur.lines.map((l) => l.itemId)])];
  const sumBy = (r: PriceResult, id: string) => r.lines.filter((l) => l.itemId === id).reduce((a, l) => ({ amount: a.amount + l.amount, usage: a.usage + l.usage, l }), { amount: 0, usage: 0, l: undefined as PriceLine | undefined });
  const lines = ids.flatMap((id): PriceDiffLine[] => {
    const a = sumBy(std, id);
    const b = sumBy(cur, id);
    if (a.usage === b.usage && a.amount === b.amount) return [];
    const ref = (b.l ?? a.l)!;
    return [{ itemId: id, name: ref.name, unit: ref.unit, before: a.amount, after: b.amount, delta: b.amount - a.amount, usageBefore: a.usage, usageAfter: b.usage }];
  });
  return { lines, sumDelta: cur.sum - std.sum, marginDelta: cur.margin - std.margin, totalDelta: cur.total - std.total };
}
