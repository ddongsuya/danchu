/**
 * 견적서 생성 툴 (0036) — 견적서 한 부의 모양과 금액 계산.
 *
 * 금액 = 카탈로그 조건의 표준가 + 표준가 포함 범위와 달라진 곳의 추가 비용.
 * 추가 비용 단가는 기관이 시험마다 정한다 (cro_quote_rates). 견적서는 만들 때의 표준가·단가를 사본으로 담는다.
 * 그래서 카탈로그 단가를 바꿔도 이미 만든 견적서 금액은 그대로다.
 *
 * 이 파일은 DB·화면을 모른다. 편집 화면·PDF·엑셀이 같은 계산을 쓴다.
 */
import type { CatalogRow } from "./catalog";

/* ── 추가 비용 단가 ─────────────────────────────────── */

/**
 * animal   본시험 동물 수 (마리). 군당 마릿수가 표준과 다르면 자동 계산
 * recovery 회복군 동물 (마리). 회복 동물이 표준과 다르면 자동 계산
 * group    투여군 (군). 군 수가 표준과 다르면 자동 계산. 단가는 표준 마릿수 기준 한 군 금액
 * qty      수량을 직접 적는 항목 (예: 조직병리검사 범위 확대 · 군, 채혈 시점 추가 · 시점)
 * flat     평가항목·옵션 추가 (견적서 평가항목에서 켜면 1회 더한다)
 */
export type RateKind = "animal" | "recovery" | "group" | "qty" | "flat";
export type Rate = {
  id: string;
  kind: RateKind;
  /** 항목 이름 (카탈로그 화면) */
  label: string;
  /** 단위 (마리·군·시점·장기·시험) */
  unit: string;
  /** 추가 단가 (원) */
  add: number | null;
  /** 차감 단가 (원, 양수로 적는다). 비우면 줄여도 금액이 줄지 않는다 */
  deduct: number | null;
  /** 견적서 표시명 */
  shown: string;
};

export const RATE_KIND_LABEL: Record<RateKind, string> = {
  animal: "본시험 동물 수",
  recovery: "회복군 동물",
  group: "투여군",
  qty: "수량 항목",
  flat: "평가항목 추가",
};

/** 동물 시험의 기본 단가 줄 (금액은 비워 둔다. 기관이 정한다) */
export function defaultRates(hasGroups: boolean): Rate[] {
  if (!hasGroups) return [];
  return [
    { id: "animal", kind: "animal", label: "본시험 동물 수", unit: "마리", add: null, deduct: null, shown: "동물 수 추가 / 차감" },
    { id: "recovery", kind: "recovery", label: "회복군", unit: "마리", add: null, deduct: null, shown: "회복군 추가 / 제외" },
    { id: "group", kind: "group", label: "투여군", unit: "군", add: null, deduct: null, shown: "투여군 추가 / 제외" },
  ];
}

const KINDS: RateKind[] = ["animal", "recovery", "group", "qty", "flat"];
const int = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d{1,13}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
};
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MAX_WON = 99_999_999_999;

/** 받은 단가 목록을 정리한다 (서버 저장·견적서 사본 공통). 자동 계산 줄(animal·recovery·group)은 하나씩만 둔다 */
export function cleanRates(raw: unknown): Rate[] {
  if (!Array.isArray(raw)) return [];
  const out: Rate[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const kind = KINDS.includes(o.kind as RateKind) ? (o.kind as RateKind) : null;
    if (!kind) continue;
    const auto = kind === "animal" || kind === "recovery" || kind === "group";
    const id = auto ? kind : text(o.id, 40) || `r${out.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const label = text(o.label, 60) || RATE_KIND_LABEL[kind];
    out.push({
      id, kind, label,
      unit: text(o.unit, 12) || (kind === "group" ? "군" : kind === "flat" ? "시험" : "마리"),
      add: int(o.add, MAX_WON),
      deduct: kind === "flat" ? null : int(o.deduct, MAX_WON),
      shown: text(o.shown, 60) || label,
    });
  }
  return out;
}

/* ── 견적서 ─────────────────────────────────────────── */

export type DocGroup = { id: string; label: string; dose: string; m: number; f: number; rm: number; rf: number };
/** 평가항목. base 는 표준가에 포함, rateId 가 있으면 켤 때 그 단가를 더한다 */
export type DocEval = { name: string; on: boolean; base: boolean; rateId?: string };
export type PhaseKind = "run" | "recovery" | "report" | "point";
export type Phase = { id: string; name: string; start: number; weeks: number; kind: PhaseKind };
export type TestCond = { species: string; route: string; dosing: string; recovery: string; glp: string; guideline: string };

export type DocTest = {
  uid: string;
  itemKey: string;
  category: string;
  item: string;
  catalogId: string | null;
  /** 단추 요청의 회신 행 번호 (요청에서 만든 견적서) */
  rfqSeq?: number;
  title: string;
  subtitle: string;
  /** 표준가와 표준 설계 (카탈로그 사본) */
  std: { price: number | null; groups: DocGroup[]; cond: TestCond; evals: string[]; summary: string };
  cond: TestCond;
  groups: DocGroup[];
  evals: DocEval[];
  /** qty 단가 id → 수량 (음수면 차감) */
  qty: Record<string, number>;
  /** 직접 적는 금액 줄 */
  extras: { id: string; label: string; amount: number }[];
  rates: Rate[];
  description: string;
  /** 착수부터 이 시험이 끝날 때까지 (주) */
  weeks: number | null;
  /** 전체 일정에서 이 시험이 시작하는 주 (0부터) */
  startWeek: number;
  phases: Phase[];
};

export type DocVisible = { perTest: boolean; adjust: boolean; formula: boolean };
export type DocTerms = { pay: string; extra: string; note: string };
export type DocData = { tests: DocTest[]; visible: DocVisible; discount: number; terms: DocTerms; glp: string };

export const EMPTY_TERMS: DocTerms = { pay: "", extra: "", note: "" };
export const DEFAULT_VISIBLE: DocVisible = { perTest: true, adjust: true, formula: false };

/** 견적서 목록·편집 공통 머리 정보 (DB 열) */
export type DocHead = {
  id: string;
  docNo: string;
  title: string;
  client: string;
  substance: string;
  issuedOn: string;
  validUntil: string | null;
  inviteId: string | null;
  rfqNo: string | null;
  memo: string;
  updatedAt: string;
};

let uidSeq = 0;
export const uid = (p = "x") => `${p}${Date.now().toString(36)}${(++uidSeq).toString(36)}`;

/** 표준 군 구성 (대조군 + 시험군, 회복 동물은 대조군·최고용량군에. 0004 카탈로그 주석과 같은 규칙) */
export function standardGroups(c: Pick<CatalogRow, "groups_ctrl" | "groups_test" | "per_sex" | "recovery_weeks" | "recovery_per_sex">): DocGroup[] {
  const nc = c.groups_ctrl ?? 0;
  const nt = c.groups_test ?? 0;
  if (nc + nt === 0) return [];
  const per = c.per_sex ?? 0;
  const rec = c.recovery_weeks ? c.recovery_per_sex ?? 0 : 0;
  const testNames = nt === 1 ? ["시험군"] : nt === 2 ? ["저용량군", "고용량군"] : nt === 3 ? ["저용량군", "중용량군", "고용량군"] : Array.from({ length: nt }, (_, i) => `시험군 ${i + 1}`);
  const names = [...Array.from({ length: nc }, (_, i) => (nc === 1 ? "대조군" : `대조군 ${i + 1}`)), ...testNames];
  return names.map((name, i) => {
    const withRec = rec > 0 && (i === 0 || i === names.length - 1);
    return { id: `g${i + 1}`, label: `G${i + 1} ${name}`, dose: i < nc ? "0" : "", m: per, f: per, rm: withRec ? rec : 0, rf: withRec ? rec : 0 };
  });
}

/** "13주, 1일 1회" · "28일" → 투여 주수 */
export function dosingWeeks(dosing: string | null | undefined): number | null {
  if (!dosing) return null;
  const w = dosing.match(/(\d{1,3})\s*주/);
  if (w) return Number(w[1]);
  const d = dosing.match(/(\d{1,3})\s*일(?!\s*\d*\s*회)/);
  if (d && Number(d[1]) > 1) return Math.max(1, Math.ceil(Number(d[1]) / 7));
  return null;
}

/** 시험 기본 일정 단계: 동물 시험은 순화 → 투여 → 회복 → 분석·보고서, 그 밖은 수행 한 줄 */
export function defaultPhases(weeks: number | null, dosing: string | null, recoveryWeeks: number | null, hasGroups: boolean): Phase[] {
  const total = Math.max(1, weeks ?? 1);
  if (!hasGroups) return [{ id: "p1", name: "수행", start: 0, weeks: total, kind: "run" }];
  const dose = Math.min(dosingWeeks(dosing) ?? Math.max(1, Math.round(total / 2)), Math.max(1, total - 1));
  const rec = Math.max(0, recoveryWeeks ?? 0);
  const out: Phase[] = [{ id: "p1", name: "순화", start: 0, weeks: 1, kind: "report" }, { id: "p2", name: `투여 ${dose}주`, start: 1, weeks: dose, kind: "run" }];
  let at = 1 + dose;
  if (rec) { out.push({ id: "p3", name: `회복 ${rec}주`, start: at, weeks: rec, kind: "recovery" }); at += rec; }
  out.push({ id: "p4", name: "분석 · 최종 보고서", start: at, weeks: Math.max(1, total - at), kind: "report" });
  return out;
}

// 시험 하나에 가능한 동물종·경로가 여럿이면 견적서에는 첫 번째(표준가 기준) 하나만 적는다
const condOfRow = (c: CatalogRow): TestCond => ({
  species: c.species[0] ?? "",
  route: c.route ?? "",
  dosing: c.dosing ?? "",
  recovery: c.recovery_weeks ? `${c.recovery_weeks}주` : "없음",
  glp: c.glp === "Non-GLP" ? "Non-GLP" : "GLP",
  guideline: c.method ?? "",
});

/** 카탈로그 조건 하나 + 그 시험의 단가 → 견적서의 새 시험 (표준 그대로) */
export function testFromCatalog(c: CatalogRow, rates: Rate[]): DocTest {
  const groups = standardGroups(c);
  // 카탈로그 "별도 옵션"(이름·금액)도 평가항목 추가로 쓴다. 같은 이름의 단가가 있으면 단가를 쓴다
  const flats = rates.filter((r) => r.kind === "flat");
  const optionRates: Rate[] = c.options
    .filter((o) => o.name && !flats.some((f) => f.label === o.name))
    .map((o, i) => ({ id: `opt${i + 1}`, kind: "flat", label: o.name, unit: "시험", add: o.amount, deduct: null, shown: `${o.name} 추가` }));
  const allRates = [...(rates.length ? rates : defaultRates(groups.length > 0)), ...optionRates];
  const evals: DocEval[] = [
    ...c.includes.map((name) => ({ name, on: true, base: true })),
    ...allRates.filter((r) => r.kind === "flat").map((r) => ({ name: r.label, on: false, base: false, rateId: r.id })),
  ];
  const cond = condOfRow(c);
  const subtitle = [cond.species, cond.route, cond.glp].filter(Boolean).join(" · ");
  const weeks = c.weeks ?? c.last_weeks ?? null;
  return {
    uid: uid("t"),
    itemKey: c.item_key, category: c.category, item: c.item, catalogId: c.id,
    title: c.dosing ? `${c.item} (${c.dosing})` : c.item,
    subtitle,
    std: { price: c.std_price ?? null, groups: groups.map((g) => ({ ...g })), cond: { ...cond }, evals: [...c.includes], summary: stdSummary(groups, c.recovery_weeks) },
    cond, groups, evals, qty: {}, extras: [], rates: allRates,
    description: c.note ?? "",
    weeks, startWeek: 0,
    phases: defaultPhases(weeks, c.dosing, c.recovery_weeks, groups.length > 0),
  };
}

/** 카탈로그에 없는 시험 (직접 적는 시험) */
export function blankTest(name = "새 시험"): DocTest {
  const cond: TestCond = { species: "", route: "", dosing: "", recovery: "없음", glp: "GLP", guideline: "" };
  return {
    uid: uid("t"), itemKey: "", category: "", item: name, catalogId: null,
    title: name, subtitle: "",
    std: { price: null, groups: [], cond: { ...cond }, evals: [], summary: "" },
    cond, groups: [], evals: [], qty: {}, extras: [], rates: [], description: "", weeks: null, startWeek: 0,
    phases: defaultPhases(null, null, null, false),
  };
}

function stdSummary(groups: DocGroup[], recoveryWeeks: number | null): string {
  if (!groups.length) return "";
  const per = groups[0].m;
  const rec = groups.filter((g) => g.rm + g.rf > 0).map((g) => g.label.split(" ")[0]);
  return [`${groups.length}군 · 군당 성별 ${per}마리`, recoveryWeeks && rec.length ? `회복 ${recoveryWeeks}주 · ${rec.join(", ")}` : ""].filter(Boolean).join(", ");
}

/* ── 금액 ───────────────────────────────────────────── */

export type Line = {
  /** 견적서에 보이는 이름 */
  label: string;
  /** 계산식 (금액 장부·"단가와 계산식"을 켰을 때) */
  formula: string;
  amount: number;
  kind: RateKind | "extra";
};

const n0 = (v: number) => (Number.isFinite(v) ? v : 0);
const fmt = (v: number) => v.toLocaleString("ko-KR");
const priced = (diff: number, r: Rate | undefined) => (!r || !diff ? 0 : diff > 0 ? diff * (r.add ?? 0) : r.deduct ? diff * r.deduct : 0);

/** 본시험 동물 합계 */
export const mainAnimals = (gs: DocGroup[]) => gs.reduce((a, g) => a + n0(g.m) + n0(g.f), 0);
export const recoveryAnimals = (gs: DocGroup[]) => gs.reduce((a, g) => a + n0(g.rm) + n0(g.rf), 0);

/**
 * 시험 한 줄의 금액. 표준가 + 달라진 곳의 추가 비용.
 * - 투여군: 군 수 차이 × 투여군 단가 (단가는 표준 마릿수 한 군 금액)
 * - 동물 수: 실제 본시험 동물 − 표준 마릿수로 계산한 동물 (새 군은 표준 군당 마릿수로 본다)
 * - 회복군: 회복 동물 차이 (표준에 있던 군은 표준 회복 마릿수, 새 군은 0 기준)
 */
export function testLines(t: DocTest): { base: number; lines: Line[]; total: number; changes: number } {
  const base = t.std.price ?? 0;
  const lines: Line[] = [];
  const rate = (kind: RateKind) => t.rates.find((r) => r.kind === kind);
  const stdById = new Map(t.std.groups.map((g) => [g.id, g]));
  const perGroupStd = t.std.groups[0] ? t.std.groups[0].m + t.std.groups[0].f : 0;

  if (t.std.groups.length) {
    const dg = t.groups.length - t.std.groups.length;
    const rg = rate("group");
    if (dg !== 0) {
      const amt = priced(dg, rg);
      const unit = dg > 0 ? rg?.add : rg?.deduct;
      lines.push({ label: dg > 0 ? `투여군 추가 · ${dg}군` : `투여군 제외 · ${-dg}군`, formula: `${Math.abs(dg)}군 × ${fmt(unit ?? 0)}`, amount: amt, kind: "group" });
    }

    const expected = t.groups.reduce((a, g) => { const s = stdById.get(g.id); return a + (s ? s.m + s.f : perGroupStd); }, 0);
    const da = mainAnimals(t.groups) - expected;
    if (da !== 0) {
      const ra = rate("animal");
      const unit = da > 0 ? ra?.add : ra?.deduct;
      // 모든 군이 같은 수만큼 바뀌었으면 "+2마리 × 2성 × 4군" 으로 보여 준다
      const per = t.groups.map((g) => { const s = stdById.get(g.id); return [g.m - (s ? s.m : perGroupStd / 2), g.f - (s ? s.f : perGroupStd / 2)]; });
      const flat = per.flat();
      const same = flat.length > 0 && flat.every((x) => x === flat[0]) && flat[0] !== 0;
      const how = same ? `${flat[0] > 0 ? "+" : ""}${flat[0]}마리 × 2성 × ${t.groups.length}군 = ` : "";
      lines.push({
        label: da > 0 ? `동물 수 추가 · ${same ? `군당 성별 ${Math.abs(flat[0])}마리` : `${da}마리`}` : `동물 수 차감 · ${same ? `군당 성별 ${Math.abs(flat[0])}마리` : `${-da}마리`}`,
        formula: `${how}${Math.abs(da)}마리 × ${fmt(unit ?? 0)}`,
        amount: priced(da, ra),
        kind: "animal",
      });
    }

    const recStd = t.groups.reduce((a, g) => { const s = stdById.get(g.id); return a + (s ? s.rm + s.rf : 0); }, 0);
    const dr = recoveryAnimals(t.groups) - recStd;
    if (dr !== 0) {
      const rr = rate("recovery");
      const unit = dr > 0 ? rr?.add : rr?.deduct;
      const changed = t.groups.filter((g) => { const s = stdById.get(g.id); return g.rm + g.rf !== (s ? s.rm + s.rf : 0); }).map((g) => g.label.split(" ")[0]);
      const who = changed.length && changed.length <= 3 ? `${changed.join(", ")} ` : "";
      lines.push({ label: dr > 0 ? `${who}회복군 추가 · ${dr}마리` : `${who}회복군 제외 · ${-dr}마리`, formula: `${Math.abs(dr)}마리 × ${fmt(unit ?? 0)}`, amount: priced(dr, rr), kind: "recovery" });
    }
  }

  for (const r of t.rates.filter((x) => x.kind === "qty")) {
    const q = Math.round(n0(t.qty[r.id] ?? 0));
    if (!q) continue;
    const unit = q > 0 ? r.add : r.deduct;
    lines.push({ label: `${r.shown} · ${Math.abs(q)}${r.unit}`, formula: `${Math.abs(q)}${r.unit} × ${fmt(unit ?? 0)}`, amount: priced(q, r), kind: "qty" });
  }
  for (const e of t.evals) {
    if (!e.on || e.base || !e.rateId) continue;
    const r = t.rates.find((x) => x.id === e.rateId);
    if (!r) continue;
    lines.push({ label: r.shown || `${r.label} 추가`, formula: `1${r.unit} × ${fmt(r.add ?? 0)}`, amount: r.add ?? 0, kind: "flat" });
  }
  for (const x of t.extras) {
    if (!x.label && !x.amount) continue;
    lines.push({ label: x.label || "기타", formula: "직접 입력", amount: Math.round(n0(x.amount)), kind: "extra" });
  }
  const total = Math.max(0, base + lines.reduce((a, l) => a + l.amount, 0));
  return { base, lines, total, changes: lines.length + condChanges(t).length };
}

/** 표준과 다른 시험 조건 칸 이름 */
export function condChanges(t: DocTest): (keyof TestCond)[] {
  return (Object.keys(t.cond) as (keyof TestCond)[]).filter((k) => (t.std.cond[k] ?? "") !== (t.cond[k] ?? "") && t.catalogId);
}

export type DocTotals = { tests: { uid: string; total: number }[]; sum: number; discount: number; supply: number; vat: number; grand: number };

/** 견적서 전체. 공급가액 = 시험 합계 − 할인, 부가세 10% (원 미만 버림) */
export function docTotals(d: DocData): DocTotals {
  const tests = d.tests.map((t) => ({ uid: t.uid, total: testLines(t).total }));
  const sum = tests.reduce((a, t) => a + t.total, 0);
  const discount = Math.min(sum, Math.max(0, Math.round(n0(d.discount))));
  const supply = sum - discount;
  const vat = Math.floor(supply / 10);
  return { tests, sum, discount, supply, vat, grand: supply + vat };
}

/** 전체 일정 길이 (주) */
export function scheduleWeeks(d: DocData): number {
  let max = 0;
  for (const t of d.tests) for (const p of t.phases) max = Math.max(max, t.startWeek + p.start + (p.kind === "point" ? 1 : p.weeks));
  return max;
}

/** 견적서 제목: "13주 반복투여 독성 외 3건" */
export function docTitle(d: DocData): string {
  if (!d.tests.length) return "견적서";
  const first = d.tests[0].title;
  return d.tests.length > 1 ? `${first} 외 ${d.tests.length - 1}건` : first;
}

/* ── 저장 값 정리 ───────────────────────────────────── */

const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt;
};
const PHASE_KINDS: PhaseKind[] = ["run", "recovery", "report", "point"];

function cleanCond(v: unknown): TestCond {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { species: text(o.species, 120), route: text(o.route, 60), dosing: text(o.dosing, 120), recovery: text(o.recovery, 40), glp: text(o.glp, 20), guideline: text(o.guideline, 160) };
}
function cleanGroups(v: unknown): DocGroup[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).filter((g) => g && typeof g === "object").map((g, i) => {
    const o = g as Record<string, unknown>;
    return { id: text(o.id, 40) || `g${i + 1}`, label: text(o.label, 40), dose: text(o.dose, 40), m: num(o.m, 0, 999, 0), f: num(o.f, 0, 999, 0), rm: num(o.rm, 0, 999, 0), rf: num(o.rf, 0, 999, 0) };
  });
}

/** 편집 화면이 보낸 견적서 내용을 정리한다 (서버 저장 전). 잘못된 값은 버리거나 기본값으로 */
export function cleanDocData(raw: unknown): DocData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tests: DocTest[] = (Array.isArray(o.tests) ? o.tests : []).slice(0, 30).filter((t) => t && typeof t === "object").map((t) => {
    const x = t as Record<string, unknown>;
    const std = (x.std && typeof x.std === "object" ? x.std : {}) as Record<string, unknown>;
    const rates = cleanRates(x.rates);
    const qty: Record<string, number> = {};
    if (x.qty && typeof x.qty === "object") for (const [k, v] of Object.entries(x.qty as Record<string, unknown>)) if (rates.some((r) => r.id === k)) qty[k] = num(v, -999, 999, 0);
    return {
      uid: text(x.uid, 40) || uid("t"),
      itemKey: text(x.itemKey, 200), category: text(x.category, 80), item: text(x.item, 120),
      catalogId: typeof x.catalogId === "string" && /^[0-9a-f-]{36}$/.test(x.catalogId) ? x.catalogId : null,
      ...(typeof x.rfqSeq === "number" && Number.isInteger(x.rfqSeq) ? { rfqSeq: x.rfqSeq } : {}),
      title: text(x.title, 160) || "시험", subtitle: text(x.subtitle, 160),
      std: {
        price: int(std.price, MAX_WON),
        groups: cleanGroups(std.groups),
        cond: cleanCond(std.cond),
        evals: Array.isArray(std.evals) ? std.evals.filter((e): e is string => typeof e === "string").slice(0, 40).map((e) => e.slice(0, 80)) : [],
        summary: text(std.summary, 200),
      },
      cond: cleanCond(x.cond),
      groups: cleanGroups(x.groups),
      evals: (Array.isArray(x.evals) ? x.evals : []).slice(0, 40).filter((e) => e && typeof e === "object").map((e) => {
        const v = e as Record<string, unknown>;
        const rateId = typeof v.rateId === "string" && rates.some((r) => r.id === v.rateId) ? v.rateId : undefined;
        return { name: text(v.name, 80), on: v.on === true, base: v.base === true, ...(rateId ? { rateId } : {}) };
      }).filter((e) => e.name),
      qty,
      extras: (Array.isArray(x.extras) ? x.extras : []).slice(0, 20).filter((e) => e && typeof e === "object").map((e, i) => {
        const v = e as Record<string, unknown>;
        return { id: text(v.id, 40) || `e${i + 1}`, label: text(v.label, 80), amount: num(v.amount, -MAX_WON, MAX_WON, 0) };
      }),
      rates,
      description: text(x.description, 3000),
      weeks: x.weeks == null || x.weeks === "" ? null : num(x.weeks, 1, 520, 1),
      startWeek: num(x.startWeek, 0, 520, 0),
      phases: (Array.isArray(x.phases) ? x.phases : []).slice(0, 12).filter((p) => p && typeof p === "object").map((p, i) => {
        const v = p as Record<string, unknown>;
        return { id: text(v.id, 40) || `p${i + 1}`, name: text(v.name, 60) || "단계", start: num(v.start, 0, 520, 0), weeks: num(v.weeks, 1, 520, 1), kind: PHASE_KINDS.includes(v.kind as PhaseKind) ? (v.kind as PhaseKind) : "run" };
      }),
    };
  });
  const vis = (o.visible && typeof o.visible === "object" ? o.visible : {}) as Record<string, unknown>;
  const terms = (o.terms && typeof o.terms === "object" ? o.terms : {}) as Record<string, unknown>;
  return {
    tests,
    visible: { perTest: vis.perTest !== false, adjust: vis.adjust !== false, formula: vis.formula === true },
    discount: num(o.discount, 0, MAX_WON, 0),
    terms: { pay: text(terms.pay, 300), extra: text(terms.extra, 300), note: text(terms.note, 600) },
    glp: text(o.glp, 20),
  };
}

/** 견적번호 Q-YYMM-NNN (기관마다 그 달의 순번) */
export function nextDocNo(issuedOn: string, existing: string[]): string {
  const yymm = `${issuedOn.slice(2, 4)}${issuedOn.slice(5, 7)}`;
  const prefix = `Q-${yymm}-`;
  const max = existing.filter((n) => n.startsWith(prefix)).reduce((a, n) => Math.max(a, Number(n.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** YYYY-MM-DD + n일 */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ── 양식 ───────────────────────────────────────────── */

export type Supplier = { name: string; address: string; contact: string; person: string; email: string };
export type QuoteStyle = { brandColor: string | null; logo: string | null; logoPos: "left" | "right"; supplier: Supplier; terms: DocTerms };
export const EMPTY_SUPPLIER: Supplier = { name: "", address: "", contact: "", person: "", email: "" };

/** 브랜드 색 위 글자색: 밝은 색이면 먹색, 어두운 색이면 종이색 (WCAG 상대 휘도) */
export function inkOn(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#f4f4f0";
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // 종이색(#f4f4f0, L≈0.90)과 먹색(#1b1b19, L≈0.011) 중 대비가 큰 쪽
  return (0.9 + 0.05) / (L + 0.05) >= (L + 0.05) / (0.011 + 0.05) ? "#f4f4f0" : "#1b1b19";
}
