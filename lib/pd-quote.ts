/**
 * 효력시험 요청 반영 견적 (0047 4단계, 시안 v15 "요청 반영" 보드와 견적서 4쪽).
 * 견적서의 효력 시험 하나에 대해 기관 표준(std.kd.pd)과 이번 설계(kd.pd)를 같은 단가 사본(prices)으로 계산하고,
 * 표준에서 달라진 곳·묶음별 비용 내역을 만든다. 단가·관리비 %는 견적서·엑셀·회신에 나가지 않는다.
 * 순수 함수. quote-doc.ts 를 import 하지 않는다 (순환 방지).
 */
import { COST_KEYS, pdUseKey, type CostKey, type PdDesign, type PdEval, type PdUse } from "./kind-design";
import { isPriceCat, isPriceUnit, parseMargin, type PriceItem, type PriceUnit } from "./price-book";
import { animalsOf, pdPrice, pdPriceDiff, type PriceLine, type PriceResult } from "./pd-price";

/** 견적서를 만들 때의 단가·관리비 % 사본. 단가표를 바꿔도 이미 만든 견적서는 그대로 (0036 원칙) */
export type PriceSnap = { items: PriceItem[]; margin: number };

type PdTest = { kd?: { pd?: PdDesign }; std: { kd?: { pd?: PdDesign } }; prices?: PriceSnap };

const MAX_ITEMS = 200;
const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** 저장 전 정리. 모르는 분류·단위나 잘못된 금액은 버린다 */
export function cleanPriceSnap(v: unknown): PriceSnap | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const margin = parseMargin(o.margin);
  if (margin == null || !Array.isArray(o.items)) return undefined;
  const items: PriceItem[] = [];
  for (const r of o.items.slice(0, MAX_ITEMS)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const price = typeof x.price === "number" && Number.isInteger(x.price) && x.price >= 0 && x.price <= 100_000_000_000 ? x.price : null;
    const id = s(x.id, 60);
    if (!id || price == null || !isPriceCat(x.category) || !isPriceUnit(x.unit)) continue;
    items.push({ id, category: x.category, name: s(x.name, 120), attrs: {}, unit: x.unit, price, memo: "", sort: 0, archived: x.archived === true });
  }
  return { items, margin };
}

/** 두 설계가 쓰는 단가 항목만 사본으로 (단가표 전체를 견적서마다 담지 않는다) */
export function snapFor(book: { items: PriceItem[]; marginPct: number }, ...pds: (PdDesign | undefined)[]): PriceSnap {
  const ids = new Set(pds.flatMap((p) => (p?.uses ?? []).map((u) => u.itemId)));
  return { items: book.items.filter((i) => ids.has(i.id)).map((i) => ({ ...i, attrs: {}, memo: "" })), margin: book.marginPct };
}

/** 사본에 없는 항목을 하나 더한다 (요청 반영 화면에서 새 단가 항목을 고를 때) */
export function snapWith(snap: PriceSnap, item: PriceItem | undefined): PriceSnap {
  if (!item || snap.items.some((i) => i.id === item.id)) return snap;
  return { ...snap, items: [...snap.items, { ...item, attrs: {}, memo: "" }] };
}

const groupsOf = (pd: PdDesign) => pd.groups.map((g) => ({ id: g.id, role: g.role, n: g.n }));

export type PdChange = {
  /** 항목 (군 수 · 군당 마리 · 마리 수 · 평가항목 · 단가 항목) */
  item: string;
  before: string;
  after: string;
  /** 금액 영향 (관리비·이익 포함). span 이 2 이상이면 아래 줄과 한 칸을 같이 쓴다. 줄을 이어 받는 쪽은 null */
  amount: number | null;
  span: number;
};

export type PdQuote = {
  std: PriceResult;
  cur: PriceResult;
  diff: ReturnType<typeof pdPriceDiff>;
  changes: PdChange[];
};

/** 표준·이번 설계를 단가 사본으로 계산. 표준에 사용량 규칙이 없거나 사본이 없으면 null (예전 다섯 칸 방식) */
export function pdQuote(t: PdTest): PdQuote | null {
  const std = t.std.kd?.pd;
  const cur = t.kd?.pd;
  if (!t.prices || !std?.uses?.length || !cur) return null;
  const items = t.prices.items;
  const m = t.prices.margin;
  const a = pdPrice(groupsOf(std), std.uses, items, m);
  const b = pdPrice(groupsOf(cur), cur.uses ?? [], items, m);
  return { std: a, cur: b, diff: pdPriceDiff(a, b), changes: pdChanges(std, cur, items, m, a, b) };
}

const uniform = (ns: number[]) => (ns.length && ns.every((x) => x === ns[0]) ? ns[0] : null);
const useKey = (u: PdUse) => `${u.itemId}|${u.label ?? ""}`;

function pdChanges(std: PdDesign, cur: PdDesign, items: PriceItem[], m: number, a: PriceResult, b: PriceResult): PdChange[] {
  const rows: Omit<PdChange, "amount" | "span">[] = [];
  // 군: 군 수, 군당 마리(모든 군이 같을 때) 또는 마리 수
  const stdIds = new Set(std.groups.map((g) => g.id));
  const added = cur.groups.filter((g) => !stdIds.has(g.id));
  if (cur.groups.length !== std.groups.length || added.length) {
    const note = added.length ? ` (${added.map((g) => g.label || "새 군").join(", ")} 추가)` : "";
    rows.push({ item: "군 수", before: `${std.groups.length}군`, after: `${cur.groups.length}군${note}` });
  }
  const pa = uniform(std.groups.map((g) => g.n));
  const pb = uniform(cur.groups.map((g) => g.n));
  const na = std.groups.reduce((x, g) => x + g.n, 0);
  const nb = cur.groups.reduce((x, g) => x + g.n, 0);
  if (pa != null && pb != null && pa !== pb) rows.push({ item: "군당 마리", before: String(pa), after: String(pb) });
  else if ((pa == null || pb == null) && cur.groups.some((g) => { const o = std.groups.find((x) => x.id === g.id); return o && o.n !== g.n; })) rows.push({ item: "마리 수", before: `${na}마리`, after: `${nb}마리` });
  const groupRows = rows.length;

  // 평가항목·단가 항목: 군이 같았을 때와의 차이
  // 선택 항목(optional)은 표준가에 없으니 비교에서 뺀다
  const sa = new Set((std.evals ?? []).filter((e) => !e.optional).map((e) => e.item.trim()));
  const sb = new Set((cur.evals ?? []).filter((e) => !e.optional).map((e) => e.item.trim()));
  const plus = [...sb].filter((x) => x && !sa.has(x));
  const minus = [...sa].filter((x) => x && !sb.has(x));
  if (plus.length || minus.length) rows.push({ item: "평가항목", before: minus.length ? minus.join(", ") : "없음", after: plus.length ? plus.join(", ") : `${minus.join(", ")} 뺌` });
  else {
    const ka = new Map((std.uses ?? []).map((u) => [useKey(u), u]));
    const name = (u: PdUse) => u.label || items.find((i) => i.id === u.itemId)?.name || "단가 항목";
    const moved = (cur.uses ?? []).filter((u) => { const o = ka.get(useKey(u)); return !o || o.times !== u.times || o.per !== u.per || o.who !== u.who; });
    const gone = (std.uses ?? []).filter((u) => !(cur.uses ?? []).some((x) => useKey(x) === useKey(u)));
    if (moved.length || gone.length) rows.push({ item: "단가 항목", before: gone.length ? gone.map(name).join(", ") : "표준", after: moved.length ? moved.map(name).join(", ") : `${gone.map(name).join(", ")} 뺌` });
  }

  // 금액: 군만 바꿨을 때 → 나머지
  const mid = pdPrice(groupsOf(cur), std.uses ?? [], items, m).total;
  const gAmt = mid - a.total;
  const rest = b.total - mid;
  return rows.map((r, i): PdChange => {
    if (i < groupRows) return { ...r, amount: i === 0 ? gAmt : null, span: i === 0 ? groupRows : 0 };
    return { ...r, amount: rest, span: 1 };
  }).concat(rows.length === groupRows && rest !== 0 ? [{ item: "단가 항목", before: "표준", after: "사용량 조정", amount: rest, span: 1 }] : []);
}

/** 견적서 묶음 이름 (시안 v15 견적 내용) */
export const BUCKET_SHORT: Record<CostKey, string> = { cost_animal: "동물·모델", cost_dosing: "투여·관찰", cost_eval: "평가·분석", cost_path: "병리", cost_report: "보고서" };

const won = (n: number) => n.toLocaleString("ko-KR");
const USAGE_WORD: Partial<Record<PriceUnit, string>> = { head: "마리", head_day: "일", cage_day: "일", head_time: "회", head_hour: "시간" };

/** 비용 내역 "포함 내용": 단가는 빼고 이름과 사용량만 ("C57BL/6 마우스 60마리, 사육 17일") */
function lineNote(l: PriceLine, u: PdUse | undefined): string {
  const w = USAGE_WORD[l.unit];
  if (!w) return l.name;
  if (l.unit === "head") return `${l.name} ${won(l.usage)}마리`;
  if (u && u.who === "none") return `${l.name} ${won(u.times)}${w}`;
  return u ? `${l.name} ${won(u.times)}${w}` : l.name;
}

export type BucketRow = { key: CostKey; label: string; note: string; amount: number; std: number };

/** 견적서 비용 내역 다섯 묶음 (관리비·이익을 묶음마다 나눠 더한 값). 합 = 견적 금액 */
export function pdBuckets(q: PdQuote, pd: PdDesign): BucketRow[] {
  const uses = pd.uses ?? [];
  return COST_KEYS.map((k) => {
    const notes = q.cur.lines.map((l, i) => (l.bucket === k && !l.missing ? lineNote(l, uses[i]) : "")).filter(Boolean);
    return { key: k, label: BUCKET_SHORT[k], note: [...new Set(notes)].join(", "), amount: q.cur.buckets[k], std: q.std.buckets[k] };
  }).filter((r) => r.amount || r.std);
}

/** 금액 한글 표기: 31,055,750 → "삼천일백오만오천칠백오십" */
export function wonKo(n: number): string {
  const v = Math.floor(Math.abs(n));
  if (!v) return "영";
  const dig = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const small = ["", "십", "백", "천"];
  const big = ["", "만", "억", "조"];
  let out = "";
  let rest = v;
  for (let b = 0; rest > 0 && b < big.length; b++) {
    const chunk = rest % 10000;
    rest = Math.floor(rest / 10000);
    if (!chunk) continue;
    let part = "";
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(chunk / 10 ** i) % 10;
      if (d) part += dig[d] + small[i];
    }
    out = part + big[b] + out;
  }
  return out;
}

/** 일 단위 스키마의 처음·끝 날 */
export function dayRange(pd: PdDesign | undefined): { from: number; to: number; days: number } | null {
  const d = pd?.days ?? [];
  if (!d.length) return null;
  const from = Math.min(...d.map((l) => l.from));
  const to = Math.max(...d.map((l) => l.to));
  return { from, to, days: to - from + 1 };
}

const normName = (x: string) => x.toLowerCase().replace(/[\s()·,&/]/g, "");

/** 평가항목이 가리키는 사용량 줄. 지정이 없으면 장부 이름·항목 이름이 겹치는 줄 */
export function evalUse(pd: PdDesign, e: PdEval, items: PriceItem[] = []): PdUse | undefined {
  const uses = pd.uses ?? [];
  if (e.use) return uses.find((u) => pdUseKey(u) === e.use);
  const a = normName(e.item);
  if (!a) return undefined;
  return uses.find((u) => {
    const b = normName(u.label || items.find((i) => i.id === u.itemId)?.name || "");
    return !!b && (a.includes(b) || b.includes(a));
  });
}

/** 평가항목 검체 수 = 대상 마리 × 횟수 × 검체당 수 (가리키는 사용량 줄로). 모르면 null */
export function evalSamples(pd: PdDesign, e: PdEval, items: PriceItem[] = []): number | null {
  const u = evalUse(pd, e, items);
  if (!u || u.who === "none") return null;
  const animals = animalsOf(pd.groups.map((g) => ({ id: g.id, role: g.role, n: g.n })), u.who);
  return Math.round(animals * (u.times || 0) * (u.per || 1));
}

/** 점수 기준표 제목: "질환 활성 점수(DAI)" → "DAI 점수 기준" */
export function scaleTitle(item: string): string {
  const m = item.match(/\(([^)]+)\)\s*$/);
  const base = (m ? m[1] : item).trim();
  return /점수$/.test(base) ? `${base} 기준` : `${base} 점수 기준`;
}
