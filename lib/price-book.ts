/**
 * 효력시험 기관 단가표 (0047). 분류·단위·분류별 칸과 입력 검사, 가져오기 비교.
 * 순수 함수만 둔다 (DB 는 lib/price-book-db.ts). 가격은 기관이 넣고, 단추는 칸과 고르는 목록(lib/price-lists.ts)만 준다.
 */
import type { CostKey } from "./kind-design";

export const PRICE_CATS = ["animal", "housing", "model", "dosing", "observe", "molecular", "pathology", "imaging", "report"] as const;
export type PriceCat = (typeof PRICE_CATS)[number];
export const PRICE_CAT_LABEL: Record<PriceCat, string> = {
  animal: "동물", housing: "사육", model: "모델 유발", dosing: "투여", observe: "관찰·측정",
  molecular: "분자 분석", pathology: "조직병리", imaging: "영상·행동", report: "보고서·기타",
};

export const PRICE_UNITS = ["head", "head_day", "cage_day", "head_time", "head_hour", "sample_item", "sample_panel", "slide", "lot", "each"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];
export const PRICE_UNIT_LABEL: Record<PriceUnit, string> = {
  head: "마리당", head_day: "마리·일", cage_day: "케이지·일", head_time: "마리·회", head_hour: "마리·시간",
  sample_item: "검체·항목", sample_panel: "검체·패널", slide: "장", lot: "1식", each: "개",
};

/** 분류마다 쓰는 칸과 고를 수 있는 단위. 칸 이름은 attrs 의 키 */
export const CAT_FIELDS: Record<PriceCat, { fields: { key: string; label: string }[]; units: PriceUnit[] }> = {
  animal: { fields: [{ key: "species", label: "종" }, { key: "strain", label: "계통" }, { key: "sex", label: "성별" }, { key: "weeks", label: "주령" }], units: ["head"] },
  housing: { fields: [{ key: "species", label: "종" }, { key: "condition", label: "사육 조건" }], units: ["head_day", "cage_day"] },
  model: { fields: [{ key: "model", label: "모델" }, { key: "method", label: "유발 방법" }, { key: "reagent", label: "시약 포함" }], units: ["head", "lot"] },
  dosing: { fields: [{ key: "route", label: "경로" }, { key: "size", label: "동물 크기" }], units: ["head_time", "head_hour", "lot"] },
  observe: { fields: [{ key: "item", label: "항목" }, { key: "method", label: "방법" }], units: ["head_time", "head"] },
  molecular: { fields: [{ key: "method", label: "분석법" }, { key: "matrix", label: "검체" }], units: ["sample_item", "sample_panel", "lot"] },
  pathology: { fields: [{ key: "stain", label: "염색" }, { key: "organs", label: "장기 수" }, { key: "reading", label: "판독 포함" }], units: ["head", "slide", "lot"] },
  imaging: { fields: [{ key: "item", label: "장비·평가" }, { key: "minutes", label: "1회 시간" }], units: ["head_time"] },
  report: { fields: [{ key: "item", label: "항목" }, { key: "lang", label: "언어" }], units: ["lot", "each"] },
};

/** 분류별 기본 비용 묶음 (견적서 비용 내역 다섯 칸). 사용량 규칙에서 항목마다 바꿀 수 있다 */
export const CAT_BUCKET: Record<PriceCat, CostKey> = {
  animal: "cost_animal", housing: "cost_animal", model: "cost_animal",
  dosing: "cost_dosing", observe: "cost_dosing",
  molecular: "cost_eval", imaging: "cost_eval",
  pathology: "cost_path", report: "cost_report",
};

export type PriceItem = {
  id: string; category: PriceCat; name: string; attrs: Record<string, string>;
  unit: PriceUnit; price: number; memo: string; sort: number; archived: boolean;
};

export const isPriceCat = (v: unknown): v is PriceCat => typeof v === "string" && (PRICE_CATS as readonly string[]).includes(v);
export const isPriceUnit = (v: unknown): v is PriceUnit => typeof v === "string" && (PRICE_UNITS as readonly string[]).includes(v);

const MAX_PRICE = 100_000_000_000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/**
 * 금액 읽기. 숫자 또는 "38,000" · "38,000원" 처럼 숫자·쉼표·원만 있는 글자만 받는다.
 * "약 4만", "3.8만", "38000~40000" 같은 글자는 짐작하지 않고 버린다 (null).
 */
export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 && v <= MAX_PRICE ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/원$/, "").trim();
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n <= MAX_PRICE ? n : null;
}

export type ItemInput = Omit<PriceItem, "id" | "sort" | "archived"> & { sort?: number };
export type ParseResult = { ok: true; value: ItemInput } | { ok: false; error: string };

/** 항목 하나 검사. 분류에 없는 칸은 버리고, 단위는 그 분류가 쓰는 것만 받는다 */
export function parseItem(b: Record<string, unknown>): ParseResult {
  if (!isPriceCat(b.category)) return { ok: false, error: "분류를 골라 주세요." };
  const cat = b.category;
  const spec = CAT_FIELDS[cat];
  const name = str(b.name, 120);
  if (!name) return { ok: false, error: "항목 이름을 적어 주세요." };
  if (!isPriceUnit(b.unit) || !spec.units.includes(b.unit)) return { ok: false, error: `${PRICE_CAT_LABEL[cat]} 단위는 ${spec.units.map((u) => PRICE_UNIT_LABEL[u]).join(", ")} 중 하나예요.` };
  const price = parsePrice(b.price);
  if (price === null) return { ok: false, error: "단가는 숫자로 적어 주세요. 예: 38,000" };
  const raw = b.attrs && typeof b.attrs === "object" && !Array.isArray(b.attrs) ? (b.attrs as Record<string, unknown>) : {};
  const attrs: Record<string, string> = {};
  for (const f of spec.fields) {
    const v = str(raw[f.key], 60);
    if (v) attrs[f.key] = v;
  }
  const sort = typeof b.sort === "number" && Number.isInteger(b.sort) ? b.sort : undefined;
  return { ok: true, value: { category: cat, name, attrs, unit: b.unit, price, memo: str(b.memo, 200), ...(sort === undefined ? {} : { sort }) } };
}

/** 같은 항목인지 보는 열쇠: 분류 + 이름 + 분류별 칸 + 단위 (대소문자·공백 무시) */
export function itemKeyOf(i: Pick<PriceItem, "category" | "name" | "attrs" | "unit">): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const a = CAT_FIELDS[i.category].fields.map((f) => norm(i.attrs[f.key] ?? "")).join("|");
  return [i.category, norm(i.name), a, i.unit].join("#");
}

export type ImportRow =
  | { status: "new"; row: number; value: ItemInput }
  | { status: "changed"; row: number; value: ItemInput; id: string; before: number }
  | { status: "same"; row: number; value: ItemInput; id: string }
  | { status: "error"; row: number; error: string };

/**
 * 가져오기 미리보기 (에이전트·엑셀 공통). 들어온 줄을 검사하고 지금 단가표와 견준다.
 * 같은 열쇠가 두 번 오면 뒤 줄을 오류로 둔다. 숨긴 항목과 같은 열쇠는 새 항목으로 본다.
 */
export function previewImport(rows: unknown[], current: PriceItem[]): ImportRow[] {
  const live = new Map(current.filter((c) => !c.archived).map((c) => [itemKeyOf(c), c]));
  const seen = new Set<string>();
  return rows.map((r, i): ImportRow => {
    const row = i + 1;
    if (!r || typeof r !== "object" || Array.isArray(r)) return { status: "error", row, error: "항목 모양이 아니에요." };
    const p = parseItem(r as Record<string, unknown>);
    if (!p.ok) return { status: "error", row, error: p.error };
    const key = itemKeyOf(p.value);
    if (seen.has(key)) return { status: "error", row, error: "같은 항목이 앞에 있어요." };
    seen.add(key);
    const cur = live.get(key);
    if (!cur) return { status: "new", row, value: p.value };
    return cur.price === p.value.price ? { status: "same", row, value: p.value, id: cur.id } : { status: "changed", row, value: p.value, id: cur.id, before: cur.price };
  });
}

export const MAX_IMPORT_ROWS = 500;

/** 관리비·이익 % 검사. 0~300, 소수 둘째 자리까지 */
export function parseMargin(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.trim().replace(/%$/, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 300) return null;
  return Math.round(n * 100) / 100;
}

/** DB 행 → 항목. 모르는 분류·단위는 버린다 */
export function itemFromDb(r: Record<string, unknown>): PriceItem | null {
  if (!isPriceCat(r.category) || !isPriceUnit(r.unit)) return null;
  const a = r.attrs && typeof r.attrs === "object" && !Array.isArray(r.attrs) ? (r.attrs as Record<string, unknown>) : {};
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) if (typeof v === "string") attrs[k] = v;
  return {
    id: String(r.id), category: r.category, name: String(r.name ?? ""), attrs, unit: r.unit,
    price: Number(r.price) || 0, memo: String(r.memo ?? ""), sort: Number(r.sort) || 0, archived: r.archived === true,
  };
}
