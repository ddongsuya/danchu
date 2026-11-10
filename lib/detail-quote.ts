/**
 * 2차 상세 견적 (0042). 화면과 라우트가 같이 쓰는 순수 함수만 둔다 (브라우저에서도 import 한다).
 *
 * 1차는 핵심 조건만으로 빠른 견적을 받고, 비교표가 열린 뒤 의뢰자가 1차를 낸 기관 1~3곳을 골라 상세 조건을 보낸다.
 * 상세 조건(detail)은 요청서 payload 와 같은 키를 쓰고, 1차에 더하거나 바꾼 값만 담는다.
 * 1차 값이 있던 키는 "바뀐 조건", 비어 있던 키는 "새 조건"이다.
 */
import { DETAILS, STEP2, WIZ, type Cat, type Field, type Values } from "./rfq-schema";

export const MAX_DETAIL_TARGETS = 3;

/** 시험물질 조건. 모든 시험에 한 번만 적는다 */
const step2 = (id: string): Field => STEP2.flatMap((g) => g.fields).find((f) => f.id === id)!;
const wiz = (id: string): Field => WIZ.flatMap((w) => w.fields).find((f) => f.id === id)!;

export const SUBSTANCE_FIELDS: Field[] = [
  { id: "detail.appearance", type: "text", label: "성상과 순도", placeholder: "예: 백색 분말, 순도 99.2%" },
  { ...step2("storage"), label: "보관 조건" },
  { ...step2("amount"), label: "보유량" },
  { id: "detail.vehicle", type: "text", label: "조제 방법", placeholder: "예: 0.5% MC 현탁, 최고 100 mg/mL" },
  { ...step2("assayMethod"), label: "함량 분석법" },
];
/** 진행 조건. 예산은 기관에 보내지 않는다 (요청서와 같은 규칙) */
export const PROGRESS_FIELDS: Field[] = [
  { ...step2("standards"), label: "표준품 제공" },
  { ...step2("reportLang"), label: "보고서 언어" },
  { ...wiz("start"), label: "착수 희망 시기" },
  { ...wiz("budget"), label: "예산" },
];
/** 기관에 보내지 않는 키 */
export const PRIVATE_KEYS = ["budget"];

/** 시험마다 1차와 다르게 할 수 있는 핵심 조건 (비교표가 쓰는 조건과 같다) */
const CORE = ["species", "recovery", "tk", "formulation", "histopath", "doseRange", "exposure"];
export function coreFields(cat: Cat): Field[] {
  return (DETAILS[cat] ?? []).filter((f) => CORE.includes(f.id));
}

export const cleanLabel = (label = "") => label.replace(/\s*\(.*\)\s*$/, "").replace(/ 포함$| 병행$/, "");
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" && v ? [v] : []);
export const showValue = (v: unknown) => arr(v).join(", ");

export type DetailLine = { key: string; label: string; group: string; was: string; now: string };

/** 허용하는 키와 그 칸. 그 밖의 키는 받지 않는다 */
export function detailFieldMap(cats: string[]): Map<string, { field: Field; group: string }> {
  const m = new Map<string, { field: Field; group: string }>();
  for (const f of SUBSTANCE_FIELDS) m.set(f.id, { field: f, group: "시험물질" });
  for (const f of PROGRESS_FIELDS) m.set(f.id, { field: f, group: "진행 조건" });
  for (const c of cats) if (c in DETAILS) for (const f of coreFields(c as Cat)) m.set(`${c}.${f.id}`, { field: f, group: c });
  return m;
}

/** 브라우저가 보낸 상세 조건을 허용 키·선택지로 걸러 낸다. 1차와 같은 값은 뺀다 */
export function cleanDetail(raw: unknown, payload: Values, cats: string[]): Values {
  const out: Values = {};
  if (!raw || typeof raw !== "object") return out;
  const map = detailFieldMap(cats);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const def = map.get(k);
    if (!def) continue;
    const f = def.field;
    let val: string | string[] | undefined;
    if (f.type === "chips") {
      const xs = arr(v).filter((x) => !f.options || f.options.includes(x)).slice(0, 20);
      if (xs.length) val = xs;
    } else if (f.options) {
      if (typeof v === "string" && f.options.includes(v)) val = v;
    } else if (typeof v === "string" && v.trim()) {
      val = v.trim().slice(0, 300);
    }
    if (val === undefined) continue;
    if (JSON.stringify(arr(payload[k])) === JSON.stringify(arr(val))) continue;
    out[k] = val;
  }
  return out;
}

/** 상세 조건을 바뀐 조건과 새 조건으로 나눈다. forCro 면 기관에 보내지 않는 키를 뺀다 */
export function detailLines(detail: Values, payload: Values, cats: string[], opts: { forCro?: boolean } = {}): { changed: DetailLine[]; added: DetailLine[] } {
  const map = detailFieldMap(cats);
  const changed: DetailLine[] = [];
  const added: DetailLine[] = [];
  for (const [key, def] of map) {
    if (opts.forCro && PRIVATE_KEYS.includes(key)) continue;
    const now = showValue(detail[key]);
    if (!now) continue;
    const was = showValue(payload[key]);
    const line = { key, label: cleanLabel(def.field.label), group: def.group, was, now };
    // 1차에서 미정으로 둔 값은 새 조건으로 본다
    if (was && was !== "미정" && was !== now) changed.push(line);
    else if (was !== now) added.push(line);
  }
  return { changed, added };
}

/* ── 기관 회신 ── */

export type DetailReplyItem = { seq: number; amount: number | null; weeks: number | null; mode: "as_requested" | "assumed"; reason: string };
export type DetailStatus = "sent" | "submitted" | "kept" | "declined";

export const DETAIL_STATUS_LABEL: Record<DetailStatus, string> = {
  sent: "회신 대기",
  submitted: "2차 견적 도착",
  kept: "1차 그대로",
  declined: "2차 회신 없음",
};

/** 저장된 items jsonb → 고친 줄 */
export function replyItemsOf(raw: unknown): DetailReplyItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DetailReplyItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const seq = Number(o.seq);
    if (!Number.isInteger(seq) || seq < 1) continue;
    const amount = typeof o.amount === "number" && Number.isFinite(o.amount) && o.amount >= 0 ? Math.round(o.amount) : null;
    const weeks = typeof o.weeks === "number" && Number.isInteger(o.weeks) && o.weeks > 0 && o.weeks <= 520 ? o.weeks : null;
    out.push({ seq, amount, weeks, mode: o.mode === "assumed" ? "assumed" : "as_requested", reason: typeof o.reason === "string" ? o.reason.trim().slice(0, 300) : "" });
  }
  return out.slice(0, 200);
}

/** 2차 총액: 1차 총액에 고친 줄의 차이를 더한다 */
export function revisedTotal(firstTotal: number, firstItems: { seq: number; amount: number | null }[], edits: { seq: number; amount: number | null }[]): number {
  let t = firstTotal;
  for (const e of edits) {
    if (e.amount == null) continue;
    const was = firstItems.find((i) => i.seq === e.seq)?.amount ?? 0;
    t += e.amount - was;
  }
  return Math.max(0, t);
}

/** 서울 날짜 기준 2차 회신 기한이 지났는지 (그날 끝까지 받는다) */
export function detailExpired(replyBy: string, now = Date.now()): boolean {
  return now > new Date(`${replyBy.slice(0, 10)}T23:59:59+09:00`).getTime();
}
