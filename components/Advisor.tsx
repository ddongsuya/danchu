"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Caret } from "@/components/app/ui";
import { ADVISOR_DISCLAIMER, advise, toRequestValues, visibleQuestions, type Answers, type Question } from "@/lib/advisor";
import type { Values } from "@/lib/rfq-schema";
import "./advisor.css";

const STEP_TITLES = ["무엇을, 어느 단계에", "임상 계획", "이미 가진 자료"];

const answered = (a: Answers, q: Question) => {
  const v = a[q.id];
  return Array.isArray(v) ? v.length > 0 : !!v;
};

/**
 * 상황을 묻고 시험 구성을 제안한다.
 * 한 질문씩 답변 → 제안 화면. 이전 답변은 접어두고 수정할 수 있다.
 */
export function Advisor({ onApply, onManual }: { onApply: (v: Values) => void; onManual: () => void }) {
  const [a, setA] = useState<Answers>({});
  const [step, setStep] = useState(1);
  const [activeId, setActiveId] = useState("product");
  const [done, setDone] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());

  const qs = visibleQuestions(a).sort((x, y) => x.step - y.step);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [activeId, step]);
  const advice = useMemo(() => (step === 4 ? advise(a) : null), [step, a]);

  const ordered = (answers: Answers) => visibleQuestions(answers).sort((x, y) => x.step - y.step);
  const clean = (answers: Answers) => {
    const next = { ...answers };
    // Remove answers whose conditions no longer apply, including dependent branches.
    let removed = true;
    while (removed) {
      removed = false;
      const visible = new Set(ordered(next).map((q) => q.id));
      for (const id of Object.keys(next)) if (!visible.has(id)) { delete next[id]; removed = true; }
    }
    return next;
  };
  const advance = (answers: Answers, id: string) => {
    const visible = ordered(answers);
    const completed = [...new Set([...done, id])].filter((key) => visible.some((q) => q.id === key));
    setDone(completed);
    const next = visible.find((q) => !completed.includes(q.id));
    if (next) { setActiveId(next.id); setStep(1); }
    else setStep(4);
  };
  const pick = (q: Question, o: string) => {
    const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
    const value = !q.multi ? o : o === "없음" ? (cur.includes(o) ? [] : [o]) : cur.includes(o) ? cur.filter((x) => x !== o) : [...cur.filter((x) => x !== "없음"), o];
    const next = clean({ ...a, [q.id]: value });
    setA(next);
    setOff(new Set()); setOn(new Set());
    if (!q.multi) advance(next, q.id);
  };
  const edit = (id: string) => { setActiveId(id); setStep(1); };
  const move = (_n: number) => edit(qs[0].id);
  const summary = (questions: Question[]) => <div className="advisor__answers" aria-label="이전 답변">
    {questions.map((q) => <div className="advisor__answer" key={q.id}>
      <div><span>{q.q}</span><b>{Array.isArray(a[q.id]) ? (a[q.id] as string[]).join(" · ") : a[q.id] || "건너뜀"}</b></div>
      <button className="btxt" type="button" onClick={() => edit(q.id)} aria-label={`${q.q} 수정`}>수정</button>
    </div>)}
  </div>;

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
            <h1 ref={heading} tabIndex={-1} style={{ textWrap: "balance", scrollMarginTop: 24 }}>답하신 상황에 필요한 시험입니다</h1>
            <p>가이드라인 근거와 함께 보여드립니다. 체크를 풀어 빼거나, 다음 단계에서 더할 수 있습니다.</p>
          </div>
        </div>

        <details className="advisor__review"><summary>답변 확인 · 수정</summary>{summary(qs)}</details>
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

  /* One current question; completed answers remain compact and editable. */
  const current = qs.find((q) => q.id === activeId) ?? qs.find((q) => !done.includes(q.id)) ?? qs[0];
  const index = qs.findIndex((q) => q.id === current.id);
  const previous = qs.filter((q) => done.includes(q.id) && q.id !== current.id);
  const value = a[current.id];
  const selected = (o: string) => Array.isArray(value) ? value.includes(o) : value === o;
  return <div className="advisor" style={{ maxWidth: 640, margin: "0 auto" }}>
    <div className="advisor__top">
      <button type="button" className="crumb" onClick={onManual}><Caret size={14} /> 직접 고르기</button>
      <span className="tnum">{STEP_TITLES[current.step - 1]} · {index + 1} / {qs.length}</span>
    </div>
    <div className="advisor__progress" aria-hidden="true"><div style={{ width: `${done.filter((id) => qs.some((q) => q.id === id)).length / qs.length * 100}%` }} /></div>
    <div className="ph"><div><h1>필요한 시험 찾기</h1><p>한 질문씩 답해 주세요. 이전 답변은 언제든 수정할 수 있습니다.</p></div></div>
    {summary(previous)}
    <section key={current.id} className="dcard advisor__question" role="group" aria-labelledby="advisor-question">
      <div>
        <p className="advisor__eyebrow">{current.multi ? "복수 선택" : "하나 선택"}{!current.required && " · 선택 질문"}</p>
        <h2 id="advisor-question" ref={heading} tabIndex={-1}>{current.q}</h2>
        {current.sub && <p className="dcard__desc">{current.sub}</p>}
      </div>
      <div className="chips">{current.options.map((o) => <button key={o} type="button" className="chip" aria-pressed={selected(o)} onClick={() => pick(current, o)}>{o}</button>)}</div>
      {(current.multi || !current.required) && <div className="advisor__actions">
        {!current.required && <button className="b2" type="button" onClick={() => { const next = clean({ ...a, [current.id]: undefined }); setA(next); setOff(new Set()); setOn(new Set()); advance(next, current.id); }}>건너뛰기</button>}
        {current.multi && <button className="b1" type="button" disabled={current.required && !answered(a, current)} onClick={() => advance(a, current.id)}>다음</button>}
      </div>}
    </section>
    {index > 0 && <button type="button" className="btxt advisor__back" onClick={() => edit(qs[index - 1].id)}><Caret size={14} /> 이전 질문</button>}
    <p className="advisor__hint">{current.multi ? "여러 답을 고른 뒤 ‘다음’을 눌러 주세요." : "답을 선택하면 다음 질문으로 이동합니다."}</p>
  </div>;
}
