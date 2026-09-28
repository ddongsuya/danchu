"use client";

import { useMemo, useState } from "react";
import { Caret } from "@/components/app/ui";
import { ADVISOR_DISCLAIMER, advise, toRequestValues, visibleQuestions, type Answers, type Question } from "@/lib/advisor";
import type { Values } from "@/lib/rfq-schema";

const STEP_TITLES = ["무엇을, 어느 단계에", "임상 계획", "이미 가진 자료"];

const answered = (a: Answers, q: Question) => {
  const v = a[q.id];
  return Array.isArray(v) ? v.length > 0 : !!v;
};

/**
 * 상황을 묻고 시험 구성을 제안한다.
 * 질문 3단계 → 제안 화면. 제안은 미리 체크된 선택일 뿐이며 의뢰자가 빼거나 더한다.
 */
export function Advisor({ onApply, onManual }: { onApply: (v: Values) => void; onManual: () => void }) {
  const [a, setA] = useState<Answers>({});
  const [step, setStep] = useState(1);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());

  const qs = visibleQuestions(a);
  const advice = useMemo(() => (step === 4 ? advise(a) : null), [step, a]);

  const pick = (q: Question, o: string) => {
    if (!q.multi) return setA({ ...a, [q.id]: o });
    const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
    // "없음"은 다른 선택과 함께 둘 수 없다
    const next = o === "없음" ? (cur.includes(o) ? [] : [o]) : cur.includes(o) ? cur.filter((x) => x !== o) : [...cur.filter((x) => x !== "없음"), o];
    setA({ ...a, [q.id]: next });
  };
  /** 질문이 없는 단계는 건너뛴다 (제품 유형에 따라 단계가 비는 경우) */
  const move = (n: number) => {
    const dir = n >= step ? 1 : -1;
    let to = n;
    while (to >= 1 && to <= 3 && !qs.some((q) => q.step === to)) to += dir;
    if (to < 1) to = 1;
    setStep(to);
    window.scrollTo(0, 0);
  };

  /* ── 제안 화면 ── */
  if (step === 4 && advice) {
    if (!advice.supported) {
      return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <button type="button" className="crumb" style={{ background: "none", border: 0, padding: 0 }} onClick={() => move(1)}><Caret size={14} /> 이전</button>
          <div className="ph"><div><h1>이 유형의 제안은 준비 중입니다</h1><p>{advice.message}</p></div></div>
          <div className="cta"><button type="button" className="b1 blg bfull" onClick={onManual}>직접 고르기</button></div>
        </div>
      );
    }
    const isOn = (k: string, def: boolean) => (def ? !off.has(k) : on.has(k));
    const toggle = (k: string, def: boolean) => {
      const s = new Set(def ? off : on);
      if (s.has(k)) s.delete(k); else s.add(k);
      if (def) setOff(s); else setOn(s);
    };
    const selected = new Set(advice.tests.filter((t) => isOn(t.key, t.on)).map((t) => t.key));
    const cats = [...new Set(advice.tests.map((t) => t.category))];
    const sec = (title: string, sub?: string) => (
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
        {sub && <p className="dcard__desc">{sub}</p>}
      </div>
    );
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button type="button" className="crumb" style={{ background: "none", border: 0, padding: 0 }} onClick={() => move(3)}><Caret size={14} /> 답변 수정</button>
        <div className="ph">
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>제안</p>
            <h1 style={{ textWrap: "balance" }}>답하신 상황에 필요한 시험입니다</h1>
            <p>가이드라인 근거와 함께 보여드립니다. 체크를 풀어 빼거나, 다음 단계에서 더할 수 있습니다.</p>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <section className="dcard">
            {sec(`필요한 시험 ${selected.size}`, "체크된 항목이 요청서에 들어갑니다.")}
            {cats.map((c) => (
              <div key={c} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>{c}</span>
                {advice.tests.filter((t) => t.category === c).map((t) => {
                  const checked = isOn(t.key, t.on);
                  return (
                    <label key={t.key} htmlFor={`adv-${t.key}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: checked ? "var(--tint)" : "var(--sf)", cursor: "pointer" }}>
                      <input id={`adv-${t.key}`} type="checkbox" checked={checked} onChange={() => toggle(t.key, t.on)} style={{ marginTop: 3, accentColor: "var(--brand)", flex: "none" }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <b style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{t.label}</b>
                        <span style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>{t.reason}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>근거 · {t.basis}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </section>

          {advice.owned.length > 0 && (
            <section className="dcard">
              {sec("이미 가진 시험", "제안에서 제외했습니다. 제출용으로 쓸 수 있는지는 GLP 여부와 시험 조건에 달려 있습니다.")}
              <div className="chips">{advice.owned.map((o) => <span key={o} className="tag">{o}</span>)}</div>
            </section>
          )}

          {advice.notes.length > 0 && (
            <section className="dcard">
              {sec(`확인할 점 ${advice.notes.length}`, "분야를 눌러 펼쳐 보세요.")}
              {[...new Set(advice.notes.map((n) => n.topic ?? "기타"))].map((topic, i) => {
                const list = advice.notes.filter((n) => (n.topic ?? "기타") === topic);
                return (
                  <details key={topic} open={i === 0} style={{ borderTop: i ? "1px solid var(--track)" : undefined, paddingTop: i ? 10 : 0 }}>
                    <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{topic} <span style={{ fontWeight: 400, color: "var(--muted)" }}>{list.length}</span></summary>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--body)", lineHeight: 1.55 }}>
                      {list.map((n) => (
                        <li key={n.text}>{n.text}{n.basis && <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>근거 · {n.basis}</span>}</li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </section>
          )}

          {advice.prereq.length > 0 && (
            <section className="dcard">
              {sec("일정상 먼저 끝나야 하는 것", "독성시험 착수일을 잡을 때 이 기간을 함께 보세요.")}
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "var(--body)" }}>
                {advice.prereq.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </section>
          )}

          {advice.askCro.length > 0 && (
            <section className="dcard">
              {sec("기관마다 다른 부분", "가이드라인이 정하지 않아 기관의 방식이 서로 다릅니다. 단추가 기준을 정하지 않고, 기관에 설명을 요청해 비교표에 나란히 보여드립니다.")}
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "var(--body)" }}>
                {advice.askCro.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </section>
          )}

          {advice.later.length > 0 && (
            <section className="dcard">
              {sec("나중 단계에 필요한 시험", "지금 요청서에는 넣지 않았습니다.")}
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--body)" }}>
                {advice.later.map((l) => (
                  <li key={l.label}><b style={{ color: "var(--ink)", fontWeight: 600 }}>{l.label}</b> — {l.when}<span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>근거 · {l.basis}</span></li>
                ))}
              </ul>
            </section>
          )}

          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{ADVISOR_DISCLAIMER}</p>

          <div className="cta">
            <button type="button" className="b1 blg bfull" disabled={selected.size === 0} onClick={() => onApply(toRequestValues(a, advice, selected))}>
              이 구성으로 요청서 만들기
            </button>
            <p className="cta__note">다음 단계에서 시험물질명, 일정, 세부 조건을 입력합니다</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── 질문 ── */
  const cur = qs.filter((q) => q.step === step);
  const ok = cur.every((q) => !q.required || answered(a, q));
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button type="button" className="crumb" style={{ background: "none", border: 0, padding: 0, margin: 0 }} onClick={() => (step === 1 ? onManual() : move(step - 1))}>
          <Caret size={14} /> {step === 1 ? "직접 고르기" : "이전"}
        </button>
        <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }}>{step} / 3</span>
      </div>
      <div style={{ height: 3, background: "var(--track)", borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: 3, background: "var(--brand)", borderRadius: 2, width: `${((step - 1) / 3) * 100}%`, transition: "width .3s ease" }} />
      </div>
      <div className="ph" style={{ marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>상황 확인</p>
          <h1>{STEP_TITLES[step - 1]}</h1>
          <p>모르는 것은 미정으로 두세요. 답에 따라 필요한 시험을 근거와 함께 제안합니다.</p>
        </div>
      </div>

      <div key={step} className="rise-in stack" style={{ gap: 14 }}>
        {cur.map((q) => {
          const v = a[q.id];
          const sel = (o: string) => (Array.isArray(v) ? v.includes(o) : v === o);
          return (
            <section key={q.id} className="dcard" role="group" aria-label={q.q}>
              <div>
                <h2 style={{ fontSize: 15.5 }}>{q.q}{!q.required && <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 13 }}> (선택)</span>}</h2>
                {q.sub && <p className="dcard__desc">{q.sub}</p>}
              </div>
              <div className="chips">
                {q.options.map((o) => (
                  <button key={o} type="button" className="chip" aria-pressed={sel(o)} onClick={() => pick(q, o)}>{o}</button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="cta">
        <button type="button" className="b1 blg bfull" disabled={!ok} onClick={() => move(step + 1)}>{step === 3 ? "제안 보기" : "다음"}</button>
      </div>
    </div>
  );
}
