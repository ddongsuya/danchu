"use client";

import { useEffect, useRef, useState } from "react";
import {
  EARLY_EMAIL, EARLY_GLP, EARLY_KIND_LABEL, EARLY_KINDS, EARLY_MONTHLY, EARLY_ORG_TYPES, EARLY_QUOTE_COUNT, EARLY_WHEN, EARLY_YEARLY,
  earlyPhone, type EarlyKind, type EarlyRole,
} from "@/lib/early";

/**
 * 사전예약 흐름 (2026-11-06 시안 판 15, Mobbin 참고: Blank Street·Ultrahuman·Acorns).
 * 한 화면에 한 질문. 하나만 고르는 질문은 누르면 다음으로, 여러 개 고르는 질문과 직접 쓰는 칸만 "다음" 버튼.
 * 마지막 질문 화면에 동의와 "사전예약하기"가 붙는다.
 * 휴대폰(860px 이하)에서는 "사전예약하기"를 누르면 화면 전체로 열린다 (스크롤 없이 한 화면씩, danchu-mobile-no-scroll).
 */

type A = {
  name: string; phone: string; email: string; org: string;
  orgType: string; kinds: EarlyKind[]; timing: string; yearly: string; quoteCount: string;
  glp: string; monthly: string; agree: boolean; adAgree: boolean;
};
const EMPTY: A = { name: "", phone: "", email: "", org: "", orgType: "", kinds: [], timing: "", yearly: "", quoteCount: "", glp: "", monthly: "", agree: false, adAgree: false };

type Key = "basic" | "org" | "orgType" | "kinds" | "timing" | "yearly" | "quoteCount" | "glp" | "monthly";
type Q = { key: Key; title: string; note?: string; options?: string[] };

const REQ: Q[] = [
  { key: "basic", title: "사전예약" },
  { key: "orgType", title: "소속을 선택해주세요.", options: EARLY_ORG_TYPES },
  { key: "kinds", title: "어떤 시험의 견적이 필요하세요?", note: "여러 개 골라도 돼요" },
  { key: "timing", title: "첫 의뢰는 언제쯤이세요?", options: EARLY_WHEN },
  { key: "yearly", title: "1년에 몇 건 정도 맡기세요?", options: EARLY_YEARLY },
  { key: "quoteCount", title: "보통 몇 곳에서 견적을 받으세요?", options: EARLY_QUOTE_COUNT },
];
const CRO: Q[] = [
  { key: "basic", title: "사전예약" },
  { key: "org", title: "기관명을 알려주세요." },
  { key: "kinds", title: "어떤 시험의 견적을 보내세요?", note: "여러 개 골라도 돼요" },
  { key: "glp", title: "GLP 인증이 있으세요?", options: EARLY_GLP },
  { key: "monthly", title: "한 달에 견적서를 몇 건 쓰세요?", options: EARLY_MONTHLY },
];

export function EarlyFlow({ role, id }: { role: EarlyRole; id: string }) {
  const req = role === "req";
  const qs = req ? REQ : CRO;
  const [i, setI] = useState(0);
  const [a, setA] = useState<A>(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const q = qs[i];
  const last = i === qs.length - 1;

  // 화면이 바뀌면 질문 제목으로 초점을 옮긴다 (화면 낭독기도 바뀐 것을 안다). 첫 화면은 사용자가 움직이기 전엔 건드리지 않는다
  useEffect(() => {
    if (moved.current) titleRef.current?.focus();
  }, [i, done]);

  // 휴대폰 전체 화면일 때 뒤 페이지가 스크롤되지 않게
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const set = <K extends keyof A>(k: K, v: A[K]) => setA((p) => ({ ...p, [k]: v }));
  function go(n: number) { moved.current = true; setErr(""); setI(n); }

  /** 지금 화면의 답이 됐는지. 문제가 있으면 문장 */
  function check(k: Key, x: A = a): string {
    if (k === "basic") {
      if (!x.name.trim()) return "이름을 적어 주세요.";
      if (!earlyPhone(x.phone)) return "휴대폰 번호를 확인해 주세요. 예: 010-1234-5678";
      if (!EARLY_EMAIL.test(x.email.trim())) return "이메일 주소를 확인해 주세요. 예: name@company.com";
      return "";
    }
    if (k === "org") return x.org.trim() ? "" : "기관명을 적어 주세요.";
    if (k === "kinds") return x.kinds.length ? "" : "하나 이상 골라 주세요.";
    return x[k] ? "" : "하나를 골라 주세요.";
  }

  function next() {
    const e = check(q.key);
    if (e) { setErr(e); return; }
    go(i + 1);
  }

  /** 하나만 고르는 질문: 고르면 잠깐 보여 주고 다음 화면으로 */
  function choose(k: Key, v: string) {
    setA((p) => ({ ...p, [k]: v }));
    setErr("");
    if (!last) window.setTimeout(() => go(i + 1), 160);
  }

  async function submit() {
    for (let n = 0; n < qs.length; n++) {
      const e = check(qs[n].key);
      if (e) { go(n); setErr(e); return; }
    }
    if (!a.agree) { setErr("[필수] 개인정보 수집·이용에 동의해 주세요."); return; }
    setBusy(true);
    setErr("");
    const sp = new URLSearchParams(window.location.search);
    const source = (sp.get("utm_source") || sp.get("from") || (document.referrer ? new URL(document.referrer).hostname : "")).slice(0, 120);
    try {
      const res = await fetch("/api/early", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, ...a, kinds: a.kinds, source }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(j.error || "예약을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."); return; }
      moved.current = true;
      setDone(true);
    } catch {
      setErr("연결이 끊겼어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const allAgreed = a.agree && a.adAgree;
  const errId = `${id}-err`;

  return (
    <>
      <button type="button" className="btn solid ef2-start" onClick={() => { moved.current = true; setOpen(true); }}>사전예약하기</button>
      <div className="ef2" data-open={open || undefined} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-labelledby={`${id}-t`}>
        <div className="ef2-top">
          {i > 0 && !done ? (
            <button type="button" className="ef2-back" onClick={() => go(i - 1)} aria-label="이전 질문">‹</button>
          ) : <span className="ef2-who">{req ? "의뢰자" : "시험 기관"}</span>}
          {!done && <span className="ef2-n mono" aria-label={`${qs.length}개 중 ${i + 1}번째`}>{i + 1}/{qs.length}</span>}
          <button type="button" className="ef2-x" onClick={() => setOpen(false)} aria-label="닫기">×</button>
        </div>

        {done ? (
          <div className="ef2-done" role="status">
            <p className="ef2-who">사전예약 완료</p>
            <h2 id={`${id}-t`} ref={titleRef} tabIndex={-1}>사전예약이<br />완료됐어요.</h2>
            <p>시범 운영 전에 단추를 미리 둘러보세요.</p>
            <a className="btn solid ef2-go" href={req ? "/signup?next=/app" : "/signup/cro"}>단추 둘러보기</a>
          </div>
        ) : (
          <div className="ef2-body">
            {i > 0 && <p className="ef2-who">{req ? "의뢰자" : "시험 기관"}</p>}
            <h2 id={`${id}-t`} ref={titleRef} tabIndex={-1}>{q.title}</h2>
            {q.note && <p className="ef2-note">{q.note}</p>}

            {q.key === "basic" && (
              <div className="ef2-fields">
                <Field id={`${id}-name`} label="이름" value={a.name} onChange={(v) => set("name", v)} auto="name" />
                <Field id={`${id}-phone`} label="휴대폰 번호" value={a.phone} onChange={(v) => set("phone", v)} auto="tel" type="tel" ph="010-0000-0000" />
                <Field id={`${id}-email`} label="이메일" value={a.email} onChange={(v) => set("email", v)} auto="email" type="email" ph="name@company.com" />
              </div>
            )}
            {q.key === "org" && (
              <div className="ef2-fields"><Field id={`${id}-org`} label="기관명" value={a.org} onChange={(v) => set("org", v)} auto="organization" /></div>
            )}
            {q.key === "kinds" && (
              <div className="ef2-opts" role="group" aria-labelledby={`${id}-t`}>
                {EARLY_KINDS.map((k) => {
                  const on = a.kinds.includes(k);
                  return (
                    <button key={k} type="button" className="ef2-opt" data-multi aria-pressed={on} onClick={() => set("kinds", on ? a.kinds.filter((x) => x !== k) : EARLY_KINDS.filter((x) => x === k || a.kinds.includes(x)))}>
                      <span>{EARLY_KIND_LABEL[k]} <small>{k}</small></span><i aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
            {q.options && (
              <div className="ef2-opts" role="group" aria-labelledby={`${id}-t`}>
                {q.options.map((o) => (
                  <button key={o} type="button" className="ef2-opt" aria-pressed={a[q.key as keyof A] === o} onClick={() => choose(q.key, o)}>
                    <span>{o}</span><i aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            {last && (
              <div className="ef2-agree">
                <label className="ef2-all"><input type="checkbox" checked={allAgreed} onChange={(e) => setA((p) => ({ ...p, agree: e.target.checked, adAgree: e.target.checked }))} />전체 동의</label>
                <label><input type="checkbox" checked={a.agree} onChange={(e) => set("agree", e.target.checked)} /><span><b>[필수] 개인정보 수집·이용 동의</b>
                  수집 항목: 이름, 휴대폰 번호, 이메일, {req ? "설문 응답" : "기관명, 설문 응답"}. 이용 목적: 사전예약 확인, 시범 운영 시작 안내, 서비스 준비를 위한 통계 작성. 보유 기간: 2027년 11월 30일까지. 동의를 거부할 수 있으며, 거부하면 사전예약을 할 수 없습니다. <a href="/privacy" target="_blank" rel="noopener">개인정보처리방침</a></span></label>
                <label><input type="checkbox" checked={a.adAgree} onChange={(e) => set("adAgree", e.target.checked)} /><span><b>[선택] 광고성 정보 수신 동의 (문자, 이메일)</b>
                  동의하지 않아도 사전예약을 할 수 있습니다.</span></label>
              </div>
            )}

            {err && <p className="ef2-err" id={errId} role="alert">{err}</p>}

            <div className="ef2-foot">
              {q.key === "basic" || q.key === "org" || q.key === "kinds" ? (
                <button type="button" className="btn solid ef2-go" onClick={next} aria-describedby={err ? errId : undefined}>다음</button>
              ) : last ? (
                <button type="button" className="btn solid ef2-go" onClick={submit} disabled={busy} aria-describedby={err ? errId : undefined}>{busy ? "보내는 중" : "사전예약하기"}</button>
              ) : (
                <p className="ef2-hint">고르면 다음으로 넘어가요</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ id, label, value, onChange, auto, type, ph }: { id: string; label: string; value: string; onChange: (v: string) => void; auto: string; type?: string; ph?: string }) {
  return (
    <div className="ef2-f">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={auto} type={type ?? "text"} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} placeholder={ph} spellCheck={false} />
    </div>
  );
}
