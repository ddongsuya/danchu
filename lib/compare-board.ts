/**
 * 비교견적표의 계산 (2026-11-27 시안 검토판 r-compare). 화면(CompareBoard·CompareView)과 보고서 머리(CompareReport)가 같은 숫자를 쓰도록
 * 브라우저·서버 양쪽에서 부르는 순수 함수만 둔다. 단추는 순위를 매기지 않으므로 기본 순서는 회신 도착 순이다.
 */
import { INCL_KEYS } from "./cro-data";
import { comma, md, payTerms, won } from "./format";
import { quoteKindLabel } from "./concierge";
import { compareIncl, oddOnes } from "./compare-incl";
import type { DetailReplyItem, DetailStatus } from "./detail-quote";

export type CompareCol = {
  id: string;
  name: string;
  total: number;
  /** 0029 이전 견적: 항목 기간 중 가장 긴 값 */
  weeks: number;
  /** 0029: 모든 보고서(번역 포함)가 끝나는 주. 기관이 적은 기간·순서로 계산. 없으면 null */
  final?: number | null;
  /** 0029: 국문 최종보고서 주 */
  finalReport?: number | null;
  start: string | null;
  valid: string | null;
  pay: string | null;
  includes: string[];
  note: string | null;
  glpOk: boolean;
  glpMissing: string[];
  glp: string[];
  unavailable: string[];
  conditional: number;
  items: {
    seq: number;
    avail: string;
    amount: number | null;
    weeks: number | null;
    design?: string;
    note?: string;
    explain?: [string, string][];
    /** 이 시험 견적에 들어간 평가·분석 항목 (기관이 견적서에서 켠 것). 없으면 예전 견적 */
    includes?: string[];
  }[];
  hasPdf: boolean;
  /** 기관이 단추 견적서 툴로 만든 견적서가 제출한 견적과 같다 (/app/r/[no]/q/[id]/doc) */
  hasDoc?: boolean;
  selected: boolean;
  /** 카탈로그 기준 자동 제출된 예비 견적 */
  auto: boolean;
  /** 운영자가 기관 PDF 를 보고 옮겨 적은 견적 (기준 문서는 PDF 원본) */
  operator?: boolean;
  /** 이 기관에 질의 (0045). 질의할 수 있을 때만 */
  askHref?: string | null;
  /** 처음 제출한 때 (회신 도착 순의 기준) */
  arrivedAt?: string | null;
  /** 이 화면이 보여 준 견적 판 (0022). 선정 확인창이 이 판으로 선정하고, 그 사이 바뀌었으면 서버가 409 로 막는다 */
  revision?: number;
  /** 선정할 수 있는 견적인지 (lib/quote-policy quoteSelectable). 아니면 이유 한 줄 */
  blocked?: string | null;
  /** 2차 상세 견적 (0042). 상세 견적을 요청한 기관만 */
  detail?: { status: DetailStatus; total: number | null; weeks: number | null; note: string | null; items: DetailReplyItem[]; at?: string | null } | null;
};
export type CompareRowDef = { seq: number; name: string; category: string };

export type SortKey = "default" | "total" | "final" | "start";
export const SORTS: [SortKey, string][] = [
  ["default", "회신 도착 순"],
  ["final", "최종보고서 빠른 순"],
  ["total", "금액 낮은 순"],
  ["start", "착수 빠른 순"],
];
export type View = "all" | "diff";

/** 주소 상태: ?sort=total&view=diff#q-<견적 id>(/doc). 알 수 없는 값은 기본값으로 */
export type BoardUrl = { sort: SortKey; view: View; quote: string | null; doc: boolean };
export function readBoardUrl(search: string, hash: string): BoardUrl {
  const p = new URLSearchParams(search);
  const s = p.get("sort");
  const m = /^#q-([0-9A-Za-z_-]+)(\/doc)?$/.exec(hash);
  return { sort: SORTS.some(([k]) => k === s) ? (s as SortKey) : "default", view: p.get("view") === "diff" ? "diff" : "all", quote: m ? m[1] : null, doc: !!m?.[2] };
}
/** 지금 주소(search)에 보드 상태를 덮어쓴 search + hash. 기본값은 주소에서 뺀다 */
export function writeBoardUrl(search: string, u: BoardUrl): string {
  const p = new URLSearchParams(search);
  if (u.sort === "default") p.delete("sort"); else p.set("sort", u.sort);
  if (u.view === "all") p.delete("view"); else p.set("view", u.view);
  const q = p.toString();
  return `${q ? `?${q}` : ""}${u.quote ? `#q-${u.quote}${u.doc ? "/doc" : ""}` : ""}`;
}
export const sortLabel = (k: SortKey) => SORTS.find(([s]) => s === k)?.[1] ?? SORTS[0][1];

/** 표 칸에 쓰는 짧은 금액. 만 원 단위로 떨어지면 "2억 700만", 아니면 원 단위 그대로 */
export const short = (n: number | null | undefined) => (n == null ? "미입력" : n % 10000 === 0 && n > 0 ? won(n).replace(/만 원$/, "만").trim() : comma(n));
/** 최종보고서 순 정렬 값: 일정이 있으면 최종 주, 예전 견적은 가장 긴 항목 기간, 둘 다 없으면 맨 뒤 */
const finalOf = (c: CompareCol) => c.final ?? (c.weeks || Infinity);
export const second = (c: CompareCol) => (c.detail?.status === "submitted" ? c.detail : null);
/** 지금 기준 총액과 기간: 2차 견적이 왔으면 그 값 */
export const totalOf = (c: CompareCol) => second(c)?.total ?? c.total;
export const weeksOf = (c: CompareCol) => second(c)?.weeks ?? c.final ?? c.weeks;

export function sortCols(cols: CompareCol[], by: SortKey): CompareCol[] {
  if (by === "default") return cols;
  const money = (c: CompareCol) => totalOf(c) || Infinity;
  return [...cols].sort((a, b) =>
    by === "total" ? money(a) - money(b) : by === "final" ? finalOf(a) - finalOf(b) || money(a) - money(b) : (a.start || "9999").localeCompare(b.start || "9999"),
  );
}

type Cond = { label: string; val: (c: CompareCol) => string; sub?: (c: CompareCol) => string | null };
export const CONDS: Cond[] = [
  { label: "수행 범위", val: (c) => (c.unavailable.length ? `일부 불가 ${c.unavailable.length}건` : "전체 수행"), sub: (c) => [c.unavailable.join(", "), c.conditional ? `조건부 ${c.conditional}건` : ""].filter(Boolean).join(", ") || null },
  { label: "견적 구분", val: (c) => quoteKindLabel({ auto: c.auto, entry_source: c.operator ? "operator" : "cro" }) },
  { label: "착수 가능", val: (c) => (c.start ? md(c.start) : "기관 확인") },
  { label: "최종보고서 제출", val: (c) => (c.final != null ? `${c.finalReport ?? c.final}주차` : c.weeks ? `${c.weeks}주` : "미입력"), sub: (c) => (c.final != null && c.finalReport != null && c.final > c.finalReport ? `번역 포함 ${c.final}주차` : null) },
  { label: "별도 비용", val: (c) => c.note?.trim() || "기재 없음" },
  ...INCL_KEYS.map((k): Cond => ({ label: k, val: (c) => (c.includes.includes(k) ? "포함" : "미포함") })),
  { label: "GLP", val: (c) => c.glp.join(", ") || "등록 정보 없음", sub: (c) => (c.glpMissing.length ? `확인 필요 ${c.glpMissing.join(", ")}` : null) },
  { label: "결제 조건", val: (c) => payTerms(c.pay) || "기재 없음" },
  { label: "견적 유효기간", val: (c) => (c.valid ? md(c.valid) : "기관 확인") },
];

export type CondRow = { label: string; vals: string[]; subs: (string | null)[]; odd: boolean[]; same: boolean };
export function condRows(cols: CompareCol[]): CondRow[] {
  return CONDS.map((r) => {
    const vals = cols.map(r.val);
    return { label: r.label, vals, subs: cols.map((c) => r.sub?.(c) ?? null), odd: oddOnes(vals), same: new Set(vals).size <= 1 };
  });
}

/** 시험별 금액 칸 */
export function itemOf(c: CompareCol, seq: number): { main: string; sub: string; num: boolean } {
  const it = c.items.find((i) => i.seq === seq);
  if (!it) return { main: "회신 없음", sub: "", num: false };
  const s2 = second(c)?.items.find((i) => i.seq === seq);
  if (it.avail === "불가" && !s2) return { main: "수행 불가", sub: "", num: false };
  const amount = s2 ? s2.amount : it.amount;
  const weeks = s2?.weeks ?? it.weeks;
  const sub = [
    weeks ? `${weeks}주` : "",
    it.avail === "조건부 가능" ? "조건부" : "",
    s2 && s2.amount !== it.amount ? `1차 ${short(it.amount)}` : "",
    s2?.mode === "assumed" ? "기관 가정 조건" : "",
  ].filter(Boolean).join(", ");
  return { main: short(amount), sub, num: amount != null };
}

/** 시험 줄이 기관끼리 갈리는지: 금액은 늘 다르므로, 금액이 없는 칸(수행 불가·회신 없음)이 섞일 때만 차이로 본다 */
export const testDiffers = (cols: CompareCol[], seq: number) => {
  const nums = cols.map((c) => itemOf(c, seq).num);
  return nums.some(Boolean) && nums.some((x) => !x);
};

/** 시험 하나의 포함 항목 (불가 줄은 견주지 않는다) */
export function testIncludes(cols: CompareCol[], seq: number) {
  return compareIncl(cols.map((c) => { const it = c.items.find((i) => i.seq === seq); return it && it.avail !== "불가" ? it.includes ?? null : null; }));
}

/** "차이 항목" 수: 기관끼리 답이 다른 조건 줄 + 수행 여부가 갈리는 시험 줄. 기관이 하나면 0 */
export function boardDiffCount(cols: CompareCol[], rows: CompareRowDef[]): number {
  if (cols.length < 2) return 0;
  return condRows(cols).filter((r) => !r.same).length + rows.filter((r) => testDiffers(cols, r.seq)).length;
}
