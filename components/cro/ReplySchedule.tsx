"use client";

import { MAX_STEPS, STEP_SEQ_BASE, type ReplyItem, type RfqView, type ScheduleStep } from "@/lib/cro-data";
import { planQuote } from "@/lib/schedule";
import { ScheduleGantt } from "@/components/ScheduleGantt";

const digits = (v: string) => v.replace(/[^\d]/g, "").slice(0, 3);

type Node = { seq: number; name: string };

/** 앞 단계 고르기: 이 단계가 시작하기 전에 끝나야 하는 시험·일정 단계 */
function AfterPicker({ self, value, nodes, disabled, onChange }: { self: number; value: number[]; nodes: Node[]; disabled: boolean; onChange: (v: number[]) => void }) {
  const others = nodes.filter((n) => n.seq !== self);
  if (!others.length) return null;
  const picked = others.filter((n) => value.includes(n.seq));
  return (
    <details className="rs-after">
      <summary>
        <span>앞 단계</span>
        <span className="rs-after__val">{picked.length ? picked.map((n) => n.name).join(", ") : "없음 · 착수 주에 시작"}</span>
      </summary>
      <p className="fld__help" style={{ margin: "6px 0" }}>이 시험보다 먼저 끝나야 하는 것을 고르세요. 고른 것이 모두 끝난 주에 시작합니다.</p>
      <div className="chips">
        {others.map((n) => {
          const on = value.includes(n.seq);
          return (
            <button key={n.seq} type="button" className="chip" aria-pressed={on} disabled={disabled} onClick={() => onChange(on ? value.filter((x) => x !== n.seq) : [...value, n.seq])}>{n.name}</button>
          );
        })}
      </div>
    </details>
  );
}

/** 항목 카드 안: 최종보고서·번역 주수와 앞 단계 */
export function ItemSchedule({ it, rfq, nodes, disabled, onChange }: { it: ReplyItem; rfq: RfqView; nodes: Node[]; disabled: boolean; onChange: (patch: Partial<ReplyItem>) => void }) {
  return (
    <div className="rs-item">
      <div className="rs-item__nums">
        <label className="numin">
          <input type="text" inputMode="numeric" placeholder="초안 뒤 최종보고서까지" disabled={disabled} value={it.reportWeeks ?? ""} onChange={(e) => onChange({ reportWeeks: digits(e.target.value) })} aria-label="초안 뒤 최종보고서까지 주수" />
          <span>주</span>
        </label>
        {rfq.translation && (
          <label className="numin">
            <input type="text" inputMode="numeric" placeholder="번역 보고서" disabled={disabled} value={it.translationWeeks ?? ""} onChange={(e) => onChange({ translationWeeks: digits(e.target.value) })} aria-label="번역 보고서 주수" />
            <span>주</span>
          </label>
        )}
      </div>
      <AfterPicker self={it.seq} value={it.afterSeqs ?? []} nodes={nodes} disabled={disabled} onChange={(v) => onChange({ afterSeqs: v })} />
    </div>
  );
}

/** 오른쪽 열: 일정 단계(조제물 분석, 분석법 검증 등 요청서에 없는 단계)와 전체 일정 미리보기 */
export function ScheduleCard({
  rfq, items, steps, startDate, disabled, learned, onSteps,
}: {
  rfq: RfqView; items: ReplyItem[]; steps: ScheduleStep[]; startDate: string; disabled: boolean; learned: boolean; onSteps: (s: ScheduleStep[]) => void;
}) {
  const plan = planQuote({ rows: rfq.rows, items, steps: steps.filter((s) => s.name.trim()) });
  const nodes: Node[] = [
    ...steps.filter((s) => s.name.trim()).map((s) => ({ seq: s.seq, name: s.name.trim() })),
    ...rfq.rows.filter((r) => items.find((x) => x.seq === r.seq)?.avail !== "불가").map((r) => ({ seq: r.seq, name: r.name })),
  ];
  const nextSeq = () => { for (let s = STEP_SEQ_BASE; s < STEP_SEQ_BASE + 100; s++) if (!steps.some((x) => x.seq === s)) return s; return STEP_SEQ_BASE; };
  const set = (seq: number, patch: Partial<ScheduleStep>) => onSteps(steps.map((s) => (s.seq === seq ? { ...s, ...patch } : s)));
  const remove = (seq: number) => onSteps(steps.filter((s) => s.seq !== seq).map((s) => ({ ...s, after: s.after.filter((a) => a !== seq) })));

  return (
    <div className="card card--pad stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>전체 일정</h2>
        <p className="fld__help" style={{ margin: 0 }}>항목별 기간·앞 단계·보고서 주수로 그립니다. 의뢰자는 이 일정을 최종보고서 시점과 함께 봅니다.{learned ? " 지난 견적에 적은 값으로 채운 칸이 있으니 이번 시험에 맞는지 확인하세요." : ""}</p>
      </div>

      <ScheduleGantt plan={plan} startDate={startDate || null} compact />

      <div className="stack" style={{ gap: 8 }}>
        <span className="fld__lab">일정 단계 <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 요청서에 없지만 순서에 들어가는 단계 (예: 조제물 분석, 분석법 검증)</span></span>
        {steps.map((s) => (
          <div key={s.seq} className="rs-step">
            <div className="rs-step__row">
              <input className="inp" style={{ height: 40, fontSize: 13 }} placeholder="단계 이름" disabled={disabled} value={s.name} onChange={(e) => set(s.seq, { name: e.target.value.slice(0, 60) })} aria-label="일정 단계 이름" />
              <label className="numin" style={{ width: 96, flex: "none" }}>
                <input type="text" inputMode="numeric" placeholder="기간" disabled={disabled} value={s.weeks} onChange={(e) => set(s.seq, { weeks: digits(e.target.value) })} aria-label={`${s.name || "일정 단계"} 기간`} />
                <span>주</span>
              </label>
              <button type="button" className="b2 bsm" disabled={disabled} onClick={() => remove(s.seq)}>빼기</button>
            </div>
            <AfterPicker self={s.seq} value={s.after} nodes={nodes} disabled={disabled} onChange={(v) => set(s.seq, { after: v })} />
          </div>
        ))}
        {steps.length < MAX_STEPS && (
          <button type="button" className="b2" disabled={disabled} onClick={() => onSteps([...steps, { seq: nextSeq(), name: "", weeks: "", after: [] }])}>일정 단계 추가</button>
        )}
      </div>
    </div>
  );
}
