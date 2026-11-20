/**
 * 에이전트 견적서 도구 (2026-11-20 설계안 D2: 에이전트가 단추 견적서 툴을 직접 쓴다).
 *
 * 금액은 단추 견적서 툴(lib/quote-doc.ts testLines·docTotals)만 계산한다. 이 파일의 함수는 금액 칸을 받지 않는다.
 *   - applyDocEdits: 군 구성·조건·기간·옵션·설명처럼 금액을 만드는 "설계"만 바꾸고, 바꾸기 전·후 금액을 코드로 계산한다.
 *   - setManualAmount: 시험 목록·단가표에 금액이 없는 줄에만, 사람이 앱 입력란에 넣은 금액을 적는다(비서 도구에는 없다).
 *   - replyFromDoc: 견적서 금액을 회신 줄로 옮긴다. 할인은 줄마다 나눠 반영하고, 가능 여부는 바꾸지 않는다.
 *   - applyReplyFields: 회신의 금액 아닌 칸(가능 여부·사유·기간·공통 조건)만 고친다.
 * 순수 함수만 둔다(테스트 대상). DB 읽기·쓰기는 lib/agent-actions.ts.
 */
import { docTotals, replyExtra, testKind, testLines, type DocData, type DocHead, type DocTest, type TestCond } from "./quote-doc";
import type { ReplyCommon, ReplyItem } from "./cro-data";
import { REPORT_LANGS } from "./cro-data";

export type DocLineView = {
  uid: string;
  rfqSeq: number | null;
  title: string;
  kind: string;
  cond: TestCond;
  groups: { id: string; label: string; m: number; f: number; rm: number; rf: number }[];
  options: { name: string; on: boolean }[];
  weeks: number | null;
  /** 표준가(시험 목록·단가표). null 이면 사람이 금액을 넣어야 하는 줄 */
  base: number | null;
  total: number;
  changes: number;
  source: "catalog" | "manual";
  why: string;
  asks: string[];
};

export type DocView = {
  head: Pick<DocHead, "id" | "docNo" | "rfqNo" | "updatedAt" | "validUntil">;
  tests: DocLineView[];
  totals: { sum: number; discount: number; supply: number; vat: number; grand: number };
  terms: DocData["terms"];
  /** 금액이 없는 줄(시험 목록·단가표에 맞는 항목이 없음). 비서는 담당자에게 알린다 */
  manualNeeded: string[];
};

/** 금액이 시험 목록·단가표에서 나오는 줄인지 */
export function hasCatalogPrice(t: DocTest): boolean {
  if (t.prices) return true;
  if (testKind(t) !== "tox" && t.kd) return testLines(t).base > 0;
  return typeof t.std.price === "number" && t.std.price > 0;
}

export function docView(head: DocHead, data: DocData): DocView {
  const totals = docTotals(data);
  const tests = data.tests.map((t): DocLineView => {
    const l = testLines(t);
    const catalog = hasCatalogPrice(t);
    return {
      uid: t.uid,
      rfqSeq: typeof t.rfqSeq === "number" ? t.rfqSeq : null,
      title: t.title,
      kind: testKind(t),
      cond: t.cond,
      groups: t.groups.map((g) => ({ id: g.id, label: g.label, m: g.m, f: g.f, rm: g.rm, rf: g.rf })),
      options: t.evals.filter((e) => !e.base).map((e) => ({ name: e.name, on: e.on })),
      weeks: t.weeks,
      base: catalog ? l.base : null,
      total: l.total,
      changes: l.changes,
      source: catalog ? "catalog" : "manual",
      why: t.why ?? "",
      asks: t.asks ?? [],
    };
  });
  return {
    head: { id: head.id, docNo: head.docNo, rfqNo: head.rfqNo, updatedAt: head.updatedAt, validUntil: head.validUntil },
    tests,
    totals: { sum: totals.sum, discount: totals.discount, supply: totals.supply, vat: totals.vat, grand: totals.grand },
    terms: data.terms,
    manualNeeded: tests.filter((t) => t.source === "manual" && t.total === 0).map((t) => t.title),
  };
}

/* ── 설계 고치기 ── */

export type TestEdit = {
  uid: string;
  cond?: Partial<TestCond>;
  groups?: { id: string; m?: number; f?: number; rm?: number; rf?: number }[];
  options?: { name: string; on: boolean }[];
  qty?: Record<string, number>;
  weeks?: number | null;
  why?: string;
  asks?: string[];
};
export type DocEdits = { tests?: TestEdit[]; terms?: Partial<DocData["terms"]> };
export type EditError = "bad_request" | "amount_not_allowed" | "not_found";

const COND_KEYS: (keyof TestCond)[] = ["species", "route", "dosing", "recovery", "glp", "guideline"];
/** 금액은 금액 칸으로만. 글 칸에 금액을 적으면 받지 않는다("유전독성 3종 별도 3,330만 원"이 비고에서 지워지던 문제) */
const MONEY = /\d[\d,.]*\s*(원|만\s*원|만원|천\s*원|억)|₩\s*\d|\bKRW\b/i;
const AMOUNT_KEYS = /amount|price|won|discount|extras|std|rates|prices/i;

const cnt = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 500 ? v : null);
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

/** 입력 모양 검사 + 금액 칸 거르기. 통과하면 정리된 편집 */
export function parseDocEdits(raw: unknown): DocEdits | EditError {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "bad_request";
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (AMOUNT_KEYS.test(k)) return "amount_not_allowed";
  const out: DocEdits = {};
  if (o.tests !== undefined) {
    if (!Array.isArray(o.tests) || o.tests.length > 30) return "bad_request";
    const tests: TestEdit[] = [];
    for (const x of o.tests) {
      if (!x || typeof x !== "object") return "bad_request";
      const e = x as Record<string, unknown>;
      for (const k of Object.keys(e)) if (AMOUNT_KEYS.test(k)) return "amount_not_allowed";
      if (typeof e.uid !== "string") return "bad_request";
      const t: TestEdit = { uid: e.uid };
      if (e.cond !== undefined) {
        if (!e.cond || typeof e.cond !== "object") return "bad_request";
        t.cond = {};
        for (const [k, v] of Object.entries(e.cond)) {
          if (!COND_KEYS.includes(k as keyof TestCond) || typeof v !== "string") return "bad_request";
          t.cond[k as keyof TestCond] = v.slice(0, 80);
        }
      }
      if (e.groups !== undefined) {
        if (!Array.isArray(e.groups)) return "bad_request";
        t.groups = [];
        for (const g of e.groups) {
          const gg = g as Record<string, unknown>;
          if (!gg || typeof gg.id !== "string") return "bad_request";
          const one: NonNullable<TestEdit["groups"]>[number] = { id: gg.id };
          for (const k of ["m", "f", "rm", "rf"] as const) {
            if (gg[k] === undefined) continue;
            const n = cnt(gg[k]);
            if (n === null) return "bad_request";
            one[k] = n;
          }
          t.groups.push(one);
        }
      }
      if (e.options !== undefined) {
        if (!Array.isArray(e.options)) return "bad_request";
        t.options = [];
        for (const p of e.options) {
          const pp = p as Record<string, unknown>;
          if (!pp || typeof pp.name !== "string" || typeof pp.on !== "boolean") return "bad_request";
          t.options.push({ name: pp.name, on: pp.on });
        }
      }
      if (e.qty !== undefined) {
        if (!e.qty || typeof e.qty !== "object" || Array.isArray(e.qty)) return "bad_request";
        t.qty = {};
        for (const [k, v] of Object.entries(e.qty)) {
          if (typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > 10000) return "bad_request";
          t.qty[k] = v;
        }
      }
      if (e.weeks !== undefined) {
        if (e.weeks !== null && (typeof e.weeks !== "number" || !Number.isInteger(e.weeks) || e.weeks < 0 || e.weeks > 520)) return "bad_request";
        t.weeks = e.weeks as number | null;
      }
      if (e.why !== undefined) {
        const w = txt(e.why, 300);
        if (w === null) return "bad_request";
        if (MONEY.test(w)) return "amount_not_allowed";
        t.why = w;
      }
      if (e.asks !== undefined) {
        if (!Array.isArray(e.asks) || e.asks.length > 5 || e.asks.some((a) => typeof a !== "string")) return "bad_request";
        if ((e.asks as string[]).some((a) => MONEY.test(a))) return "amount_not_allowed";
        t.asks = (e.asks as string[]).map((a) => a.slice(0, 200));
      }
      tests.push(t);
    }
    out.tests = tests;
  }
  if (o.terms !== undefined) {
    if (!o.terms || typeof o.terms !== "object") return "bad_request";
    out.terms = {};
    for (const [k, v] of Object.entries(o.terms)) {
      if (!["pay", "extra", "note"].includes(k) || typeof v !== "string") return "bad_request";
      if (k !== "pay" && MONEY.test(v)) return "amount_not_allowed";
      out.terms[k as "pay" | "extra" | "note"] = v.slice(0, 2000);
    }
  }
  return out;
}

export type EditDiff = { uid: string; title: string; before: number; after: number; fields: string[] };

/** 편집을 적용한다. 금액은 바꾸기 전·후 모두 testLines 로 계산 */
export function applyDocEdits(data: DocData, edits: DocEdits): { data: DocData; diffs: EditDiff[]; before: number; after: number } | EditError {
  const next: DocData = structuredClone(data);
  const diffs: EditDiff[] = [];
  for (const e of edits.tests ?? []) {
    const t = next.tests.find((x) => x.uid === e.uid);
    if (!t) return "not_found";
    const before = testLines(t).total;
    const fields: string[] = [];
    if (e.cond) {
      for (const [k, v] of Object.entries(e.cond)) if (t.cond[k as keyof TestCond] !== v) { t.cond[k as keyof TestCond] = v as string; fields.push(`cond.${k}`); }
    }
    for (const g of e.groups ?? []) {
      const tg = t.groups.find((x) => x.id === g.id);
      if (!tg) return "not_found";
      for (const k of ["m", "f", "rm", "rf"] as const) if (g[k] !== undefined && tg[k] !== g[k]) { tg[k] = g[k]!; fields.push(`groups.${g.id}.${k}`); }
    }
    for (const p of e.options ?? []) {
      // 같은 이름이 기본 포함 항목과 옵션에 함께 있을 수 있다. 옵션(base 아님)만 켜고 끈다
      const ev = t.evals.find((x) => x.name === p.name && !x.base);
      if (!ev) return "not_found";
      if (ev.on !== p.on) { ev.on = p.on; fields.push(`options.${p.name}`); }
    }
    if (e.qty) {
      const ids = new Set(t.rates.map((r) => r.id));
      for (const [k, v] of Object.entries(e.qty)) {
        if (!ids.has(k)) return "not_found";
        if ((t.qty[k] ?? 0) !== v) { t.qty[k] = v; fields.push(`qty.${k}`); }
      }
    }
    if (e.weeks !== undefined && t.weeks !== e.weeks) { t.weeks = e.weeks; fields.push("weeks"); }
    if (e.why !== undefined && (t.why ?? "") !== e.why) { t.why = e.why; fields.push("why"); }
    if (e.asks !== undefined) { t.asks = e.asks; fields.push("asks"); }
    if (fields.length) diffs.push({ uid: t.uid, title: t.title, before, after: testLines(t).total, fields });
  }
  if (edits.terms) next.terms = { ...next.terms, ...edits.terms };
  return { data: next, diffs, before: docTotals(data).supply, after: docTotals(next).supply };
}

/* ── 사람이 넣는 금액 ── */

export const MANUAL_LINE = "manual";
const MAX_WON = 100_000_000_000;

/**
 * 시험 목록·단가표에 금액이 없는 줄에만 금액을 적는다(직접 적는 금액 줄 하나로). 0이면 지운다.
 * 할인(discount)도 사람이 넣은 값만 받는다.
 */
export function setManualAmount(data: DocData, input: { uid?: unknown; amount?: unknown; label?: unknown; discount?: unknown }): DocData | EditError {
  const next: DocData = structuredClone(data);
  if (input.discount !== undefined) {
    if (typeof input.discount !== "number" || !Number.isInteger(input.discount) || input.discount < 0 || input.discount > MAX_WON) return "bad_request";
    next.discount = input.discount;
  }
  if (input.uid !== undefined) {
    if (typeof input.uid !== "string" || typeof input.amount !== "number" || !Number.isInteger(input.amount) || input.amount < 0 || input.amount > MAX_WON) return "bad_request";
    const t = next.tests.find((x) => x.uid === input.uid);
    if (!t) return "not_found";
    if (hasCatalogPrice(t)) return "amount_not_allowed";
    const label = typeof input.label === "string" && input.label.trim() ? input.label.trim().slice(0, 80) : "시험 금액";
    t.extras = t.extras.filter((x) => x.id !== MANUAL_LINE);
    if (input.amount > 0) t.extras.push({ id: MANUAL_LINE, label, amount: input.amount });
  }
  if (input.uid === undefined && input.discount === undefined) return "bad_request";
  return next;
}

/* ── 견적서 → 회신 ── */

/**
 * 할인을 줄 금액 비율로 나눈다(원 단위 버림, 남는 원은 금액이 가장 큰 줄에). 줄 합계 = 공급가액
 */
export function spreadDiscount(totals: number[], discount: number): number[] {
  const sum = totals.reduce((a, b) => a + b, 0);
  const d = Math.min(sum, Math.max(0, Math.round(discount)));
  if (!d || !sum) return [...totals];
  const cut = totals.map((t) => Math.floor((t * d) / sum));
  let left = d - cut.reduce((a, b) => a + b, 0);
  const order = totals.map((t, i) => [t, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    const i = order[k][1];
    if (totals[i] - cut[i] > 0) { cut[i]++; left--; }
  }
  return totals.map((t, i) => t - cut[i]);
}

/**
 * 견적서의 시험별 금액·기간·설계 설명을 회신 줄에 옮긴다. 가능 여부·사유는 그대로 둔다(일괄 "가능" 표시 안 함).
 * 금액이 0인 줄과 견적서에 없는 줄은 empty 로 알린다.
 */
export function replyFromDoc(data: DocData, items: ReplyItem[]): { items: ReplyItem[]; filled: number[]; empty: number[] } {
  const linked = data.tests.filter((t) => typeof t.rfqSeq === "number");
  const totals = spreadDiscount(linked.map((t) => testLines(t).total), docTotals(data).discount);
  const bySeq = new Map<number, { amount: number; weeks: number | null; extra: Record<string, string> }>();
  linked.forEach((t, i) => {
    const prev = bySeq.get(t.rfqSeq!);
    // 같은 회신 줄에 시험이 둘이면 더한다
    bySeq.set(t.rfqSeq!, { amount: (prev?.amount ?? 0) + totals[i], weeks: Math.max(prev?.weeks ?? 0, t.weeks ?? 0) || null, extra: { ...(prev?.extra ?? {}), ...replyExtra(t) } });
  });
  const filled: number[] = [];
  const empty: number[] = [];
  const next = items.map((it) => {
    const l = bySeq.get(it.seq);
    if (!l || l.amount <= 0) { empty.push(it.seq); return it; }
    filled.push(it.seq);
    const prevExtra = (it.design?.extra && typeof it.design.extra === "object" ? it.design.extra : {}) as Record<string, unknown>;
    return { ...it, amount: String(l.amount), weeks: l.weeks ? String(l.weeks) : it.weeks, unit: "total" as const, unitPrice: "", sampleCount: "", source: "manual" as const, design: { ...(it.design ?? {}), extra: { ...prevExtra, ...l.extra } } };
  });
  return { items: next, filled, empty };
}

/* ── 회신 칸(금액 없음) ── */

const AVAIL = ["가능", "조건부 가능", "불가"] as const;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function applyReplyFields(draft: { items: ReplyItem[]; common: ReplyCommon }, raw: unknown): { items: ReplyItem[]; common: ReplyCommon } | EditError {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "bad_request";
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (AMOUNT_KEYS.test(k)) return "amount_not_allowed";
  const items = draft.items.map((x) => ({ ...x }));
  const common = { ...draft.common };
  if (o.items !== undefined) {
    if (!Array.isArray(o.items)) return "bad_request";
    for (const x of o.items) {
      const e = (x ?? {}) as Record<string, unknown>;
      for (const k of Object.keys(e)) if (AMOUNT_KEYS.test(k) || k === "unitPrice") return "amount_not_allowed";
      const it = items.find((i) => i.seq === e.seq);
      if (!it) return "not_found";
      if (e.avail !== undefined) {
        if (!AVAIL.includes(e.avail as (typeof AVAIL)[number])) return "bad_request";
        it.avail = e.avail as ReplyItem["avail"];
      }
      if (e.reason !== undefined) {
        if (typeof e.reason !== "string") return "bad_request";
        if (MONEY.test(e.reason)) return "amount_not_allowed";
        it.reason = e.reason.slice(0, 300);
      }
      if (e.weeks !== undefined) {
        if (typeof e.weeks !== "number" || !Number.isInteger(e.weeks) || e.weeks < 0 || e.weeks > 520) return "bad_request";
        it.weeks = String(e.weeks);
      }
    }
  }
  if (o.common !== undefined) {
    const c = (o.common ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(c)) {
      if (k === "validUntil" || k === "startDate") {
        if (typeof v !== "string" || (v && !YMD.test(v))) return "bad_request";
        common[k] = v;
      } else if (k === "payTerms" || k === "substanceQty") {
        if (typeof v !== "string") return "bad_request";
        if (k === "payTerms" && MONEY.test(v)) return "amount_not_allowed";
        common[k] = v.slice(0, 200);
      } else if (k === "reportLang") {
        if (typeof v !== "string" || (v && !REPORT_LANGS.includes(v))) return "bad_request";
        common.reportLang = v;
      } else return "bad_request";
    }
  }
  return { items, common };
}

/* ── 제출 금액 (2026-11-20 사용자 결정: 단가표 기준) ── */

/**
 * 에이전트 제출 본문의 금액을 견적서 계산값으로 바꾼다. 본문에 적힌 금액은 쓰지 않는다.
 * - 견적서 금액 = 시험 목록 표준가·추가/차감 단가·효력 단가표로 코드가 계산한 값 + 사람이 넣은 금액(목록에 없는 줄·할인).
 * - 불가 줄은 금액을 비운다. 그 밖의 줄에 견적서 금액이 없으면 amount_missing (사람이 quote_doc_set_amount 로 넣는다).
 * - 요청서와 시험 이름이 달라진 줄은 mismatched 로 막는다.
 */
export function submitFromDoc(data: DocData, items: ReplyItem[], rowNames: Map<number, string>):
  | { ok: true; items: ReplyItem[]; overridden: number[] }
  | { ok: false; error: "amount_missing" | "mismatched"; seqs: number[] } {
  const mismatched = data.tests.filter((t) => typeof t.rfqSeq === "number" && t.item && rowNames.has(t.rfqSeq) && rowNames.get(t.rfqSeq) !== t.item).map((t) => t.rfqSeq as number);
  const live = items.filter((it) => it.avail !== "불가");
  const bad = [...new Set(mismatched)].filter((s) => live.some((it) => it.seq === s));
  if (bad.length) return { ok: false, error: "mismatched", seqs: bad };
  const r = replyFromDoc(data, items);
  const missing = r.empty.filter((s) => live.some((it) => it.seq === s));
  if (missing.length) return { ok: false, error: "amount_missing", seqs: missing };
  const before = new Map(items.map((it) => [it.seq, String(it.amount ?? "")]));
  const next = r.items.map((it) => (it.avail === "불가" ? { ...it, amount: "" } : it));
  const overridden = next.filter((it) => it.avail !== "불가" && (before.get(it.seq) ?? "") !== "" && before.get(it.seq) !== it.amount).map((it) => it.seq);
  return { ok: true, items: next, overridden };
}
