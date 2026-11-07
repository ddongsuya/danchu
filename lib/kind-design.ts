/**
 * 갈래별 시험 설계 (2026-11-07). 견적 요청의 네 갈래(Tox·PD·PK·Other)에 맞춰
 * 시험 목록(카탈로그)·견적서·회신이 같은 칸을 쓴다.
 *
 * - 독성(Tox): 기존 군 구성(대조·시험, 암수 각, 회복군)과 추가 비용 단가. 여기서는 따로 두지 않는다
 * - 효력(PD): 질환 모델, 역할별 군(정상·부형제·양성대조·시험), 주 단위 일정, 비용 다섯 칸
 * - 약동학(PK): 시험 종류, 용량군, 채혈 시점, 검체, 분석법, 파라미터. 검체 수 × 검체당 단가
 * - 개별 분석(Other): 검체 수 × 검체당 단가 + 시료 접수·보고서
 *
 * 시험 목록에는 cro_catalog.extra.kd 에, 견적서에는 DocTest.kd 에 같은 모양으로 저장한다 (DB 변경 없음).
 * 숫자 기본값은 두지 않는다. 기관이 적은 값만 쓴다.
 * 이 파일은 DB·화면을 모른다.
 */
import { kindOfCategory, type Kind } from "./study-kinds";

export { kindOfCategory, type Kind };

/* ── 효력 ───────────────────────────────────────────── */

export type PdRole = "normal" | "vehicle" | "positive" | "test";
export const PD_ROLE: Record<PdRole, string> = { normal: "정상", vehicle: "대조", positive: "양성대조", test: "시험" };
export type PdGroup = { id: string; label: string; role: PdRole; treat: string; n: number; dose: string };

/** 비용 다섯 칸. 키는 회신 design.extra 의 cost_* 와 같다 (lib/efficacy.ts COST_PARTS) */
export type CostKey = "cost_animal" | "cost_dosing" | "cost_eval" | "cost_path" | "cost_report";
export const COST_KEYS: CostKey[] = ["cost_animal", "cost_dosing", "cost_eval", "cost_path", "cost_report"];
export const COST_LABEL: Record<CostKey, [string, string]> = {
  cost_animal: ["동물·모델 유발", "동물, 순화, 질환 유발"],
  cost_dosing: ["투여·관찰", "조제, 투여, 관찰, 사육"],
  cost_eval: ["평가·분석", "기능 평가, 생화학, 영상"],
  cost_path: ["병리", "부검, 조직 처리, 판독"],
  cost_report: ["보고서·통계", "통계, 보고서, 원자료"],
};
export type Money5 = Record<CostKey, number | null>;
export const EMPTY5: Money5 = { cost_animal: null, cost_dosing: null, cost_eval: null, cost_path: null, cost_report: null };

/** 주 단위 일정 한 줄. start 는 0부터, point 는 그 주의 한 시점(평가·부검) */
export type Lane = { id: string; name: string; start: number; weeks: number; point?: boolean };

export type PdDesign = {
  model: string;
  induction: string;
  groups: PdGroup[];
  lanes: Lane[];
  endpoints: string[];
  /** 표준 설계(시험 목록의 군 수) 그대로일 때 비용 */
  costs: Money5;
  /** 군이 하나 늘거나 줄 때 칸마다 더하거나 빼는 금액 */
  perGroup: Money5;
  /** 동물 한 마리가 늘거나 줄 때 (동물·모델 유발 칸에 더한다) */
  perAnimal: number | null;
  /** 견적서에서 칸 금액을 직접 고친 값 (계산값 대신) */
  override?: Partial<Money5>;
};

/* ── 약동학 ─────────────────────────────────────────── */

export const PK_TYPES = ["단회 PK", "반복 PK", "조직분포", "생체이용률(BA)", "배설"];
export const PK_TIMES = ["5분", "15분", "30분", "1시간", "2시간", "4시간", "6시간", "8시간", "12시간", "24시간", "48시간"];
export const PK_MATRIX = ["혈장", "혈청", "전혈", "뇨", "분변", "조직"];
export const PK_PARAMS = ["Cmax", "Tmax", "AUC", "T½", "CL", "Vd", "F(%)"];
export type PkGroup = { id: string; label: string; route: string; dose: string; n: number };
export type PkDesign = {
  types: string[];
  groups: PkGroup[];
  times: string[];
  matrix: string[];
  /** have: 의뢰자 분석법 있음, dev: 분석법 개발 필요 */
  method: "have" | "dev" | "";
  params: string[];
  /** 동물 실험(투여·채혈) 금액 */
  animal: number | null;
  /** 검체당 분석 단가 */
  perSample: number | null;
  /** 분석법 개발 금액 */
  dev: number | null;
  /** 파라미터 분석·보고서 */
  report: number | null;
};

/* ── 개별 분석 ──────────────────────────────────────── */

export type OtherDesign = {
  /** 시료 설명 (예: 랫드 간·신장) */
  sample: string;
  n: number;
  perSample: number | null;
  /** 시료 접수·보관 */
  setup: number | null;
  report: number | null;
};

export type KindDesign = { pd?: PdDesign; pk?: PkDesign; other?: OtherDesign };

/** 의뢰자 원안 (받은 요청에서 만든 견적서). 표시와 달라진 칸 비교에 쓴다 */
export type Orig = {
  /** [칸 이름, 의뢰자가 적은 값] */
  lines: [string, string][];
  groups?: number;
  perGroup?: number;
  times?: number;
  samples?: number;
};

/* ── 기본 설계 (숫자는 비워 둔다) ──────────────────── */

let seq = 0;
const id = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;

/** 시험 목록 기존 칸(군 수·마릿수·유발 방법)에서 효력 설계 틀을 만든다 */
export function pdFrom(c: { groups_ctrl: number | null; groups_test: number | null; per_sex: number | null; method: string | null; dosing: string | null; weeks: number | null; extra: Record<string, unknown> }): PdDesign {
  const ex = (k: string) => (typeof c.extra[k] === "string" ? (c.extra[k] as string) : "");
  const induction = ex("induction");
  const pos = ex("positiveControl");
  const n = c.per_sex ?? 0;
  const tests = Math.max(1, c.groups_test ?? 1);
  const by = induction ? `${induction.split(/[ ,]/)[0]} 유발 후` : "유발 후";
  const groups: PdGroup[] = [
    { id: "g1", label: "정상군", role: "normal", treat: "유발 없음", n, dose: "" },
    { id: "g2", label: "부형제군", role: "vehicle", treat: `${by} 부형제`, n, dose: "" },
    ...(pos ? [{ id: "g3", label: "양성대조군", role: "positive" as PdRole, treat: `${by} ${pos}`, n, dose: "" }] : []),
    ...Array.from({ length: tests }, (_, i) => ({
      id: `g${(pos ? 4 : 3) + i}`, label: tests === 1 ? "시험물질군" : `시험물질군 ${["저", "중", "고"][i] ?? i + 1}`, role: "test" as PdRole, treat: `${by} 시험물질`, n, dose: "",
    })),
  ];
  const costs = { ...EMPTY5 };
  for (const k of COST_KEYS) { const v = ex(k); if (/^\d+$/.test(v)) costs[k] = Number(v); }
  return {
    model: c.method ?? "", induction, groups, lanes: [], endpoints: ex("endpoints").split(/[,·]/).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    costs, perGroup: { ...EMPTY5 }, perAnimal: null,
  };
}

export function emptyPk(): PkDesign {
  return { types: [], groups: [], times: [], matrix: [], method: "", params: [], animal: null, perSample: null, dev: null, report: null };
}
export function emptyOther(perSample: number | null = null): OtherDesign {
  return { sample: "", n: 0, perSample, setup: null, report: null };
}

/** 효력 일정 기본 줄 이름 (주 수는 비워 둔다) */
export function pdLanes(): Lane[] {
  return [
    { id: "l1", name: "순화", start: 0, weeks: 1 },
    { id: "l2", name: "유발", start: 1, weeks: 1 },
    { id: "l3", name: "투여", start: 1, weeks: 2 },
    { id: "l4", name: "부검", start: 3, weeks: 1, point: true },
  ];
}

export const newPdGroup = (role: PdRole, n: number): PdGroup => ({ id: id("g"), label: role === "test" ? "시험물질군" : `${PD_ROLE[role]}군`, role, treat: "", n, dose: "" });
export const newPkGroup = (n: number): PkGroup => ({ id: id("g"), label: "투여군", route: "", dose: "", n });

/* ── 금액 ───────────────────────────────────────────── */

const v0 = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const animals = (gs: { n: number }[]) => gs.reduce((a, g) => a + v0(g.n), 0);

export type Part = { key: CostKey; label: string; desc: string; base: number | null; adj: string; calc: number; amount: number; changed: boolean };

/**
 * 효력 비용 다섯 칸. 기준가(시험 목록) + 군 수 차이 × 군당 금액 (+ 동물 수 차이 × 마리당 금액, 동물 칸).
 * 견적서에서 칸 금액을 직접 고쳤으면 그 금액
 */
export function pdParts(cur: PdDesign, std: PdDesign | undefined): Part[] {
  const s = std ?? cur;
  const dg = cur.groups.length - s.groups.length;
  const stdPer = s.groups[0]?.n ?? 0;
  // 표준에 있던 군은 그 군의 마릿수, 새 군은 표준 군당 마릿수와 비교한다 (빠진 군은 군당 금액으로 뺀다)
  const stdById = new Map(s.groups.map((g) => [g.id, g]));
  const da = cur.groups.reduce((a, g) => a + v0(g.n) - (stdById.get(g.id)?.n ?? stdPer), 0);
  return COST_KEYS.map((key) => {
    const base = s.costs[key];
    let calc = v0(base) + dg * v0(s.perGroup[key]);
    const bits: string[] = [];
    if (dg && s.perGroup[key]) bits.push(`${s.groups.length}군 → ${cur.groups.length}군`);
    if (key === "cost_animal" && da && s.perAnimal) { calc += da * s.perAnimal; bits.push(`동물 ${da > 0 ? "+" : ""}${da}마리`); }
    const o = cur.override?.[key];
    const amount = typeof o === "number" ? o : Math.max(0, calc);
    return { key, label: COST_LABEL[key][0], desc: COST_LABEL[key][1], base, adj: typeof o === "number" ? "직접 고침" : bits.join(", "), calc: Math.max(0, calc), amount, changed: amount !== v0(base) };
  });
}

/** 약동학 검체 수 = 군 마릿수 합 × 시점 수 × 검체 종류 수 */
export function pkSamples(p: PkDesign): number {
  return animals(p.groups) * p.times.length * Math.max(1, p.matrix.length);
}

/** 표준가 자리에 들어갈 금액 (견적서 "표준가 없음" 판단·목록 표시용). 칸이 하나도 없으면 null */
export function kindStdPrice(kind: Kind, kd: KindDesign | undefined): number | null {
  if (kind === "pd" && kd?.pd) { const c = kd.pd.costs; return COST_KEYS.some((k) => c[k] != null) ? COST_KEYS.reduce((a, k) => a + v0(c[k]), 0) : null; }
  if (kind === "pk" && kd?.pk) return kd.pk.perSample == null && kd.pk.animal == null ? null : v0(kd.pk.animal) + v0(kd.pk.report);
  if (kind === "other" && kd?.other) return kd.other.perSample == null ? null : v0(kd.other.setup) + v0(kd.other.report);
  return null;
}

/* ── 저장 값 정리 ───────────────────────────────────── */

const MAX = 99_999_999_999;
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const won = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,13}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= MAX ? Math.round(n) : null;
};
const cnt = (v: unknown, max = 999) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0; };
const list = (v: unknown, n: number, len = 60) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, n).map((x) => x.trim().slice(0, len)) : []);
const m5 = (v: unknown): Money5 => { const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>; const out = { ...EMPTY5 }; for (const k of COST_KEYS) out[k] = won(o[k]); return out; };
const ROLES: PdRole[] = ["normal", "vehicle", "positive", "test"];

function cleanPd(v: unknown): PdDesign | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const ov = o.override && typeof o.override === "object" ? (o.override as Record<string, unknown>) : null;
  const override: Partial<Money5> = {};
  if (ov) for (const k of COST_KEYS) { const x = won(ov[k]); if (x != null) override[k] = x; }
  return {
    model: s(o.model, 120), induction: s(o.induction, 160),
    groups: (Array.isArray(o.groups) ? o.groups : []).slice(0, 16).filter((g) => g && typeof g === "object").map((g, i) => {
      const x = g as Record<string, unknown>;
      return { id: s(x.id, 40) || `g${i + 1}`, label: s(x.label, 40) || `G${i + 1}`, role: ROLES.includes(x.role as PdRole) ? (x.role as PdRole) : "test", treat: s(x.treat, 80), n: cnt(x.n), dose: s(x.dose, 40) };
    }),
    lanes: (Array.isArray(o.lanes) ? o.lanes : []).slice(0, 8).filter((l) => l && typeof l === "object").map((l, i) => {
      const x = l as Record<string, unknown>;
      return { id: s(x.id, 40) || `l${i + 1}`, name: s(x.name, 30) || "단계", start: cnt(x.start, 104), weeks: Math.max(1, cnt(x.weeks, 104)), ...(x.point === true ? { point: true } : {}) };
    }),
    endpoints: list(o.endpoints, 20, 80),
    costs: m5(o.costs), perGroup: m5(o.perGroup), perAnimal: won(o.perAnimal),
    ...(Object.keys(override).length ? { override } : {}),
  };
}

function cleanPk(v: unknown): PkDesign | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return {
    types: list(o.types, 8), times: list(o.times, 24, 20), matrix: list(o.matrix, 8), params: list(o.params, 12, 20),
    groups: (Array.isArray(o.groups) ? o.groups : []).slice(0, 12).filter((g) => g && typeof g === "object").map((g, i) => {
      const x = g as Record<string, unknown>;
      return { id: s(x.id, 40) || `g${i + 1}`, label: s(x.label, 40) || `G${i + 1}`, route: s(x.route, 40), dose: s(x.dose, 40), n: cnt(x.n) };
    }),
    method: o.method === "have" || o.method === "dev" ? o.method : "",
    animal: won(o.animal), perSample: won(o.perSample), dev: won(o.dev), report: won(o.report),
  };
}

function cleanOther(v: unknown): OtherDesign | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return { sample: s(o.sample, 120), n: cnt(o.n, 99999), perSample: won(o.perSample), setup: won(o.setup), report: won(o.report) };
}

export function cleanKd(v: unknown): KindDesign | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out: KindDesign = {};
  const pd = cleanPd(o.pd), pk = cleanPk(o.pk), other = cleanOther(o.other);
  if (pd) out.pd = pd;
  if (pk) out.pk = pk;
  if (other) out.other = other;
  return Object.keys(out).length ? out : undefined;
}

export function cleanOrig(v: unknown): Orig | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const lines = (Array.isArray(o.lines) ? o.lines : []).slice(0, 12).flatMap((l) => (Array.isArray(l) && typeof l[0] === "string" && typeof l[1] === "string" && l[1].trim() ? [[l[0].slice(0, 40), l[1].trim().slice(0, 300)] as [string, string]] : []));
  const num = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x > 0 && x < 100000 ? x : undefined);
  const out: Orig = { lines };
  for (const k of ["groups", "perGroup", "times", "samples"] as const) { const x = num(o[k]); if (x) out[k] = x; }
  return lines.length || out.groups || out.samples ? out : undefined;
}

/* ── 의뢰자 원안 읽기 (요청서 글 → 숫자) ────────────── */

/** "5군, 군당 8마리" → { groups: 5, perGroup: 8 } */
export function parseGroups(t: string): { groups?: number; perGroup?: number } {
  const g = t.match(/(\d{1,2})\s*군/);
  const p = t.match(/군당\s*(\d{1,3})/) ?? t.match(/(\d{1,3})\s*마리/);
  return { ...(g ? { groups: Number(g[1]) } : {}), ...(p ? { perGroup: Number(p[1]) } : {}) };
}
/** "0.5, 1, 2, 4, 8, 24h · 총 6회" → 6 */
export function parseTimes(t: string): number | undefined {
  const total = t.match(/총\s*(\d{1,2})\s*(회|시점)/);
  if (total) return Number(total[1]);
  const nums = t.replace(/총.*$/, "").match(/\d+(\.\d+)?/g);
  return nums && nums.length >= 2 ? nums.length : undefined;
}
/** "랫드 혈청, 40개" → 40 */
export function parseCount(t: string): number | undefined {
  const m = t.match(/(\d{1,5})\s*(개|건|검체|샘플|시료|마리)/);
  return m ? Number(m[1]) : undefined;
}
