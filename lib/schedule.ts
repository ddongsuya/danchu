/**
 * 기관이 회신에 적은 예상 일정 → 간트차트용 주차 계산.
 *
 * 단추는 순서나 기간을 정하지 않는다. 기관이 항목마다 적은 값(시험 주수, 앞 단계, 보고서 주수)만으로 계산한다.
 * - 주차는 착수 주 = 0 기준. 한 단계는 [start, end) 주를 차지한다 (end 는 다음 단계가 시작할 수 있는 주)
 * - 앞 단계가 있으면 앞 단계가 모두 끝난 주에 시작한다 (겹침 없음). 기관이 고정 시작 주를 적으면 그 주를 따른다
 * - 보고서 행은 그 시험이 끝난 주에 시작하고, 번역 행은 보고서가 끝난 주에 시작한다
 * - 최종보고서 주 = 모든 행 중 가장 늦게 끝나는 주. 비교표 "최종보고서 빠른 순" 의 기준
 */

export type ScheduleTask = {
  /** 회신 행 번호 등, 한 일정 안에서 겹치지 않는 값 */
  id: string;
  name: string;
  /** 시험 주수. 비어 있으면 일정에 그리지 않고 incomplete 로 알린다 */
  weeks: number | null;
  /** 이 단계가 시작하기 전에 끝나야 하는 단계 id */
  after?: string[];
  /** 국문(원문) 보고서 주수. 없으면 보고서 행을 만들지 않는다 */
  reportWeeks?: number | null;
  /** 번역 보고서 주수. 요청에 번역이 있을 때만 */
  translationWeeks?: number | null;
  /** 의뢰자가 날짜를 정한 경우처럼 기관이 시작 주를 고정한 단계 */
  fixedStart?: number | null;
  /** 묶음 제목 (예: 대분류). 그림에서 행을 묶는 데만 쓴다 */
  group?: string;
};

export type ScheduleRowKind = "study" | "report" | "translation";

export type ScheduleRow = {
  id: string;
  /** 보고서·번역 행이면 그 시험의 id */
  parentId: string | null;
  kind: ScheduleRowKind;
  name: string;
  group: string;
  start: number;
  end: number;
  weeks: number;
  /** 최종보고서 주를 정하는 경로 위에 있는가 */
  critical: boolean;
};

export type SchedulePlan = {
  rows: ScheduleRow[];
  /** 최종보고서(번역 포함)가 끝나는 주. 그릴 행이 없으면 null */
  finalWeek: number | null;
  /** 시험(보고서 제외)이 모두 끝나는 주 */
  studyEndWeek: number | null;
  /** 주수가 비어 있어 그리지 못한 단계 */
  incomplete: string[];
  /** 앞 단계로 적었지만 이 일정에 없는 id (무시하고 계산) */
  unknownAfter: { id: string; after: string }[];
  /** 서로를 앞 단계로 적어 순서를 정할 수 없는 단계 (앞 단계를 무시하고 0주에 둔다) */
  cycles: string[];
};

const pos = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

export function planSchedule(tasks: ScheduleTask[]): SchedulePlan {
  const byId = new Map<string, ScheduleTask>();
  for (const t of tasks) if (!byId.has(t.id)) byId.set(t.id, t);
  const incomplete = [...byId.values()].filter((t) => pos(t.weeks) == null).map((t) => t.id);
  const drawn = new Map([...byId].filter(([id]) => !incomplete.includes(id)));

  const unknownAfter: SchedulePlan["unknownAfter"] = [];
  const deps = new Map<string, string[]>();
  for (const [id, t] of drawn) {
    const list: string[] = [];
    for (const a of t.after ?? []) {
      if (a === id) continue;
      if (drawn.has(a)) list.push(a);
      else unknownAfter.push({ id, after: a });
    }
    deps.set(id, [...new Set(list)]);
  }

  // 순환 찾기: 순환에 걸린 단계는 앞 단계를 무시한다
  const cycles = new Set<string>();
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string) => {
    state.set(id, 1);
    stack.push(id);
    for (const d of deps.get(id) ?? []) {
      if (state.get(d) === 1) stack.slice(stack.indexOf(d)).forEach((x) => cycles.add(x));
      else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of drawn.keys()) if (!state.has(id)) visit(id);
  for (const id of cycles) deps.set(id, []);

  // 앞에서부터 시작·종료 주 계산
  const start = new Map<string, number>();
  const end = new Map<string, number>();
  const calc = (id: string): number => {
    const done = end.get(id);
    if (done != null) return done;
    const t = drawn.get(id)!;
    const fixed = t.fixedStart != null && Number.isFinite(t.fixedStart) && t.fixedStart >= 0 ? Math.round(t.fixedStart) : null;
    const s = fixed ?? Math.max(0, ...(deps.get(id) ?? []).map(calc));
    start.set(id, s);
    end.set(id, s + pos(t.weeks)!);
    return end.get(id)!;
  };
  for (const id of drawn.keys()) calc(id);

  const rows: ScheduleRow[] = [];
  for (const [id, t] of drawn) {
    const group = t.group ?? "";
    const s = start.get(id)!;
    const e = end.get(id)!;
    rows.push({ id, parentId: null, kind: "study", name: t.name, group, start: s, end: e, weeks: e - s, critical: false });
    const rw = pos(t.reportWeeks);
    const tw = pos(t.translationWeeks);
    if (rw) rows.push({ id: `${id}:report`, parentId: id, kind: "report", name: "보고서", group, start: e, end: e + rw, weeks: rw, critical: false });
    if (tw) {
      const ts = e + (rw ?? 0);
      rows.push({ id: `${id}:translation`, parentId: id, kind: "translation", name: "번역 보고서", group, start: ts, end: ts + tw, weeks: tw, critical: false });
    }
  }
  if (!rows.length) return { rows, finalWeek: null, studyEndWeek: null, incomplete, unknownAfter, cycles: [...cycles] };

  const finalWeek = Math.max(...rows.map((r) => r.end));
  const studyEndWeek = Math.max(...rows.filter((r) => r.kind === "study").map((r) => r.end));

  // 최종보고서 주를 정하는 경로: 마지막에 끝나는 행에서 거꾸로, 시작 주를 정한 앞 단계를 따라간다
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const mark = (r: ScheduleRow) => {
    if (r.critical) return;
    r.critical = true;
    if (r.kind === "translation") {
      const rep = rowById.get(`${r.parentId}:report`);
      mark(rep && rep.end === r.start ? rep : rowById.get(r.parentId!)!);
      return;
    }
    if (r.kind === "report") return mark(rowById.get(r.parentId!)!);
    const t = drawn.get(r.id)!;
    if (t.fixedStart != null || r.start === 0) return;
    for (const d of deps.get(r.id) ?? []) {
      const dr = rowById.get(d)!;
      if (dr.end === r.start) mark(dr);
    }
  };
  rows.filter((r) => r.end === finalWeek).forEach(mark);

  return { rows, finalWeek, studyEndWeek, incomplete, unknownAfter, cycles: [...cycles] };
}

/* ── 기관별 순서 학습 ──────────────────────────────────────
 * 회신의 "앞 단계"는 행 번호로 적지만, 요청서마다 행 번호가 다르다.
 * 그래서 카탈로그에는 항목 키(대분류::시험 이름)로 저장하고, 다음 요청서에서는 그 요청서의 행 번호로 되돌린다.
 */

/** 회신 행 번호 기준 앞 단계 → 항목 키 기준 앞 단계 (카탈로그 저장용) */
export function orderToKeys(rows: { seq: number; key: string }[], after: Record<number, number[]>): Record<string, string[]> {
  const keyOf = new Map(rows.map((r) => [r.seq, r.key]));
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    const keys = (after[r.seq] ?? []).map((s) => keyOf.get(s)).filter((k): k is string => !!k && k !== r.key);
    if (keys.length) out[r.key] = [...new Set(keys)];
  }
  return out;
}

/**
 * 카탈로그의 항목 키 기준 앞 단계 → 이번 요청서의 행 번호 기준 앞 단계 (초안 채우기용).
 * 이번 요청서에 없는 앞 단계는 버린다. 같은 키가 두 행이면 첫 행으로 본다
 */
export function orderFromKeys(rows: { seq: number; key: string }[], afterKeys: Record<string, string[] | undefined>): Record<number, number[]> {
  const seqOf = new Map<string, number>();
  for (const r of rows) if (!seqOf.has(r.key)) seqOf.set(r.key, r.seq);
  const out: Record<number, number[]> = {};
  for (const r of rows) {
    const seqs = (afterKeys[r.key] ?? []).map((k) => seqOf.get(k)).filter((s): s is number => s != null && s !== r.seq);
    if (seqs.length) out[r.seq] = [...new Set(seqs)];
  }
  return out;
}

/** 착수일(YYYY-MM-DD) + 주차 → 그 주의 월요일 (YYYY-MM-DD). 착수일이 월요일이 아니면 그 주 월요일 기준 */
export function weekMonday(startDate: string, week: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - dow + week * 7);
  return d.toISOString().slice(0, 10);
}
