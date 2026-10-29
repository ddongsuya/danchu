import { scaleWeeks, weekMonday, type SchedulePlan, type ScheduleRow } from "@/lib/schedule";

/**
 * 견적 회신의 전체 일정 (경로형 간트, 2026-10-28 시안 B).
 * - 흑연 단색. 최종보고서 주를 정하는 순서(critical)만 진하게, 나머지는 옅게
 * - 형광 노랑은 "차이"에만: 가장 빠른 기관의 최종보고서 주(bestFinal)부터 이 일정의 최종보고서 주까지
 * - 값은 모두 기관이 회신에 적은 것. 단추는 순서나 기간을 정하지 않는다
 * 훅이 없어 서버 화면(의뢰자 상세)과 회신 화면 미리보기에서 함께 쓴다
 */

type Line = { study: ScheduleRow; report?: ScheduleRow; translation?: ScheduleRow };

function linesOf(plan: SchedulePlan): Line[] {
  const map = new Map<string, Line>();
  for (const r of plan.rows) if (r.kind === "study") map.set(r.id, { study: r });
  for (const r of plan.rows) {
    if (r.kind === "study" || !r.parentId) continue;
    const l = map.get(r.parentId);
    if (l) l[r.kind] = r;
  }
  return [...map.values()].sort((a, b) => a.study.start - b.study.start || a.study.end - b.study.end);
}

const pct = (w: number, scale: number) => `${((w / scale) * 100).toFixed(3)}%`;

/** 축 눈금: 착수일이 있으면 달이 바뀌는 주, 없으면 5주마다 */
type Tick = { week: number; label: string; strong: boolean; minor?: boolean };
/**
 * 글자를 다는 눈금은 maxLabels 개 이하로 (좁은 칸에서 "26.10월 11월 12월"이 겹쳐 읽히지 않던 문제).
 * 선은 달마다 긋고, 글자는 k 번째 달마다. 해가 바뀌면 그다음 글자에 연도를 붙인다.
 * minor: 글자 단 눈금 중 하나 건너 하나. 휴대폰 폭에서는 CSS 가 이 글자를 숨긴다
 */
function ticksOf(scale: number, startDate: string | null | undefined, maxLabels: number): Tick[] {
  if (startDate && weekMonday(startDate, 0)) {
    const months: { week: number; ym: string; strong: boolean }[] = [];
    for (let w = 0; w <= scale; w++) {
      const d = weekMonday(startDate, w)!;
      const ym = d.slice(0, 7);
      const prev = months.at(-1)?.ym;
      if (ym === prev) continue;
      months.push({ week: w, ym, strong: !!prev && prev.slice(0, 4) !== ym.slice(0, 4) });
    }
    const k = Math.max(1, Math.ceil(months.length / maxLabels));
    let lastYear = "";
    let n = 0;
    return months.map((m, i) => {
      if (i % k !== 0) return { week: m.week, label: "", strong: m.strong };
      const year = m.ym.slice(0, 4);
      const label = year !== lastYear ? `${m.ym.slice(2, 4)}.${Number(m.ym.slice(5, 7))}월` : `${Number(m.ym.slice(5, 7))}월`;
      lastYear = year;
      return { week: m.week, label, strong: m.strong, minor: n++ % 2 === 1 };
    });
  }
  const step = Math.max(5, Math.ceil(scale / maxLabels / 5) * 5);
  const out: Tick[] = [];
  for (let w = 0, n = 0; w <= scale; w += step, n++) out.push({ week: w, label: `${w}주`, strong: false, minor: n % 2 === 1 });
  return out;
}

const range = (l: Line) => {
  const end = l.translation?.end ?? l.report?.end ?? l.study.end;
  return `${l.study.start}~${l.study.end}주${end !== l.study.end ? ` · 최종 ${end}주` : ""}`;
};

export function ScheduleGantt({
  plan,
  name,
  startDate,
  bestFinal,
  scale: fixedScale,
  compact = false,
}: {
  plan: SchedulePlan;
  /** 기관명 등 머리 글 */
  name?: string;
  /** 착수 가능일 (YYYY-MM-DD). 있으면 달 눈금과 날짜를 단다 */
  startDate?: string | null;
  /** 같은 요청에서 가장 빠른 기관의 최종보고서 주 (번역 포함). 노란 차이 띠의 시작 */
  bestFinal?: number | null;
  /** 여러 기관을 같은 축으로 볼 때 */
  scale?: number;
  /** 회신 화면 미리보기: 머리 숫자를 작게, 경로 줄 생략 */
  compact?: boolean;
}) {
  const lines = linesOf(plan);
  if (!lines.length || plan.finalWeek == null) {
    return (
      <div className="sg sg--empty">
        <p>{plan.incomplete.length ? "기간이 적힌 시험이 없어 일정을 그리지 못했습니다." : "일정 정보가 없습니다."}</p>
      </div>
    );
  }
  const final = plan.finalWeek;
  const ko = plan.finalReportWeek ?? final;
  const scale = fixedScale ?? scaleWeeks(final, bestFinal);
  const late = bestFinal != null && final > bestFinal ? final - bestFinal : 0;
  const ticks = ticksOf(scale, startDate, compact ? 4 : 7);
  const chain = lines.filter((l) => l.study.critical).map((l) => l.study.name);
  const dateOf = (w: number) => { const d = startDate ? weekMonday(startDate, w) : null; return d ? d.replaceAll("-", ".") : null; };
  const hasTrans = final > ko;

  return (
    <div className={`sg${compact ? " sg--compact" : ""}`}>
      <div className="sg-head">
        <div className="sg-big">
          <span className="sg-cap">{name ? `${name} · ` : ""}국문 최종보고서</span>
          <span className="sg-num tnum">{ko}주차</span>
          {dateOf(ko) && <span className="sg-cap tnum">예상 {dateOf(ko)} 주</span>}
        </div>
        {(hasTrans || late > 0) && (
          <p className="sg-sub">
            {hasTrans && <>번역 포함 <b className="tnum">{final}주차</b>{dateOf(final) ? ` · 예상 ${dateOf(final)} 주` : ""}</>}
            {late > 0 && <mark className="sg-late">가장 빠른 기관보다 +{late}주</mark>}
          </p>
        )}
      </div>

      {!compact && chain.length > 1 && (
        <ol className="sg-chain" aria-label="최종보고서 시점을 정하는 순서">
          {chain.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}
        </ol>
      )}

      <div className="sg-grid" role="table" aria-label="시험별 예상 일정">
        <div className="sg-row sg-row--axis" role="row" aria-hidden="true">
          <span className="sg-name" />
          <div className="sg-track">
            {ticks.map((t) => (
              <span key={t.week} className={`sg-tick${t.strong ? " sg-tick--year" : ""}${t.minor ? " sg-tick--minor" : ""}`} style={{ left: pct(t.week, scale) }}>{t.label}</span>
            ))}
          </div>
          <span className="sg-range" />
        </div>
        {lines.map((l) => {
          const c = l.study.critical;
          return (
            <div key={l.study.id} className={`sg-row${c ? " sg-row--crit" : ""}`} role="row">
              <span className="sg-name" role="cell">{l.study.name}</span>
              <div className="sg-track" role="cell" aria-label={range(l)}>
                {late > 0 && <span className="sg-band" style={{ left: pct(bestFinal!, scale), width: pct(late, scale) }} />}
                <span className="sg-bar" style={{ left: pct(l.study.start, scale), width: pct(l.study.weeks, scale) }} />
                {l.report && <span className={`sg-rep${l.report.critical ? " is-crit" : ""}`} style={{ left: pct(l.report.start, scale), width: pct(l.report.weeks, scale) }} />}
                {l.translation && <span className={`sg-tr${l.translation.critical ? " is-crit" : ""}`} style={{ left: pct(l.translation.start, scale), width: pct(l.translation.weeks, scale) }} />}
              </div>
              <span className="sg-range tnum" role="cell">{range(l)}</span>
            </div>
          );
        })}
      </div>

      <ul className="sg-legend">
        <li><i className="sg-key sg-key--crit" />최종보고서 시점을 정하는 순서</li>
        <li><i className="sg-key" />함께 진행</li>
        <li><i className="sg-key sg-key--rep" />초안 뒤 최종보고서{hasTrans ? " · 번역" : ""}</li>
        {late > 0 && <li><i className="sg-key sg-key--late" />가장 빠른 기관과의 차이</li>}
      </ul>
      {plan.incomplete.length > 0 && <p className="sg-note">기간이 비어 일정에 넣지 못한 항목이 {plan.incomplete.length}개 있습니다.</p>}
    </div>
  );
}
