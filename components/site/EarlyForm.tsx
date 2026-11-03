"use client";

import { useRef, useState } from "react";
import {
  EARLY_EMAIL, EARLY_GLP, EARLY_INTENT, EARLY_KIND_LABEL, EARLY_KINDS, EARLY_ORG_TYPES, EARLY_WHEN, type EarlyRole,
} from "@/lib/early";

/**
 * 사전예약 양식. 의뢰자·기관 두 갈래, 두 단계.
 * 1단계: (기관명) · 이메일 · 분야 → 다음
 * 2단계: 의뢰자는 회사 유형·예정 시기, 기관은 GLP·참여 생각·확인하고 싶은 점 → 동의 → 예약
 * 두 단계 모두 한 form 안에 있고 보이지 않는 단계는 hidden 이라, 보낼 때 모든 값이 함께 간다.
 */
export function EarlyForm({ role, id }: { role: EarlyRole; id: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const req = role === "req";

  /** 첫 번째 문제 칸으로 포커스를 옮기고 그 내용을 알린다 */
  function fail(name: string, msg: string) {
    setErr(msg);
    (formRef.current?.querySelector(`[name="${name}"]`) as HTMLElement | null)?.focus();
  }

  function checkStep1(f: FormData): boolean {
    if (!req && !String(f.get("org") || "").trim()) { fail("org", "기관명을 적어 주세요."); return false; }
    if (!EARLY_EMAIL.test(String(f.get("email") || "").trim())) { fail("email", "이메일 주소를 확인해 주세요. 예: name@company.com"); return false; }
    if (f.getAll("kind").length === 0) { fail("kind", req ? "맡길 시험을 하나 이상 골라 주세요." : "수행 분야를 하나 이상 골라 주세요."); return false; }
    return true;
  }

  function next() {
    if (!formRef.current || !checkStep1(new FormData(formRef.current))) return;
    setErr("");
    setStep(2);
    // 다음 단계의 첫 칸으로 (화면 낭독기도 단계가 바뀐 것을 안다)
    requestAnimationFrame(() => (formRef.current?.querySelector(`#${id}-s2 select, #${id}-s2 input`) as HTMLElement | null)?.focus());
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 1) return next();
    const f = new FormData(e.currentTarget);
    if (!checkStep1(f)) { setStep(1); return; }
    if (!req && !f.get("intent")) return fail("intent", "참여 생각을 골라 주세요.");
    if (!f.get("agree")) return fail("agree", "개인정보 수집·이용에 동의해 주세요.");
    setErr("");
    setBusy(true);
    const q = new URLSearchParams(window.location.search);
    const source = (q.get("utm_source") || q.get("from") || (document.referrer ? new URL(document.referrer).hostname : "")).slice(0, 120);
    try {
      const res = await fetch("/api/early", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          email: f.get("email"),
          org: f.get("org"),
          orgType: f.get("orgType"),
          kinds: f.getAll("kind"),
          timing: f.get("when"),
          glp: f.getAll("glp"),
          intent: f.get("intent"),
          ask: f.get("ask"),
          source,
          agree: true,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErr(j.error || "예약을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."); return; }
      setSent(true);
    } catch {
      setErr("연결이 끊겼어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="ef-done" role="status">
        <b>예약을 받았어요.</b>
        <p>{req ? "오픈 전에 이메일로 먼저 알려드릴게요." : "오픈 전에 이메일로 먼저 연락드릴게요. 궁금한 점은 그때 함께 답해 드려요."}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} className="ef" onSubmit={onSubmit} noValidate aria-describedby={err ? `${id}-err` : undefined}>
      <p className="ef-step mono" aria-live="polite">
        <span aria-hidden="true"><b data-on={step === 1 || undefined} /><b data-on={step === 2 || undefined} /></span>
        {step} / 2 단계
      </p>

      <div className="ef-s" hidden={step !== 1}>
        {!req && (
          <div className="ef-f">
            <label htmlFor={`${id}-org`}>기관명</label>
            <input id={`${id}-org`} name="org" autoComplete="organization" required />
          </div>
        )}
        <div className="ef-f">
          <label htmlFor={`${id}-email`}>{req ? "이메일" : "담당자 이메일"}</label>
          <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required />
        </div>
        <fieldset className="ef-f">
          <legend>{req ? "맡길 시험" : "수행 분야"}</legend>
          <div className="ef-chips">
            {EARLY_KINDS.map((k) => (
              <label key={k}><input type="checkbox" name="kind" value={k} /><span>{EARLY_KIND_LABEL[k]} <b>{k}</b></span></label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="ef-s" id={`${id}-s2`} hidden={step !== 2}>
        {req ? (
          <>
            <div className="ef-f">
              <label htmlFor={`${id}-type`}>회사 유형 <small>선택</small></label>
              <select id={`${id}-type`} name="orgType" defaultValue="">
                <option value="" disabled>골라 주세요</option>
                {EARLY_ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <fieldset className="ef-f">
              <legend>예정 시기 <small>선택</small></legend>
              <div className="ef-chips">
                {EARLY_WHEN.map((w) => (
                  <label key={w}><input type="radio" name="when" value={w} /><span>{w}</span></label>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <fieldset className="ef-f">
              <legend>보유 GLP 인증 <small>선택</small></legend>
              <div className="ef-chips">
                {EARLY_GLP.map((g) => (
                  <label key={g}><input type="checkbox" name="glp" value={g} /><span>{g}</span></label>
                ))}
              </div>
            </fieldset>
            <fieldset className="ef-f">
              <legend>참여 생각</legend>
              <div className="ef-list">
                {EARLY_INTENT.map((t) => (
                  <label key={t}><input type="radio" name="intent" value={t} /><span>{t}</span></label>
                ))}
              </div>
            </fieldset>
            <div className="ef-f">
              <label htmlFor={`${id}-ask`}>참여 전에 확인하고 싶은 점 <small>선택</small></label>
              <textarea id={`${id}-ask`} name="ask" rows={2} maxLength={1000} autoComplete="off" />
            </div>
          </>
        )}
        <label className="ef-agree">
          <input type="checkbox" name="agree" />
          <span>
            오픈 안내를 위해 이메일{req ? "" : "·기관명"}과 고른 항목을 모으고, 오픈 6개월 뒤 지워요. 동의하지 않으면 예약할 수 없어요.{" "}
            <a href="/privacy" target="_blank" rel="noopener">처리방침</a>
          </span>
        </label>
      </div>

      {err && <p className="ef-err" id={`${id}-err`} role="alert">{err}</p>}

      {step === 1 ? (
        <button className="btn solid ef-go" type="submit">다음</button>
      ) : (
        <div className="ef-row">
          <button className="btn ef-back" type="button" onClick={() => { setErr(""); setStep(1); }} disabled={busy}>이전</button>
          <button className="btn solid ef-go" type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? "저장하는 중" : req ? "예약하기" : "참여 예약하기"}
          </button>
        </div>
      )}
    </form>
  );
}
