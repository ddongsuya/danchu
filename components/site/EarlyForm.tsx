"use client";

import { useState } from "react";

/**
 * 사전예약 양식 (시안). 의뢰자·기관 두 갈래.
 * 저장 API(예약 테이블)는 시안 승인 뒤에 만든다. 지금은 입력 확인까지만 하고 "시안" 안내를 보여 준다.
 */
type Role = "req" | "cro";

const KINDS = ["Tox", "PD", "PK", "Other"] as const;
const KIND_LABEL: Record<(typeof KINDS)[number], string> = { Tox: "독성", PD: "효력", PK: "약동학", Other: "개별 분석" };
const ORG_TYPES = ["제약", "바이오텍", "화장품", "건강기능식품", "의료기기", "화학·농약", "연구소·대학", "기타"];
const WHEN = ["3개월 안", "6개월 안", "1년 안", "아직 미정"];
const GLP = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "없음"];
const INTENT = ["오픈 전에 먼저 등록할게요", "요청서를 한번 받아보고 정할게요", "오픈 소식만 받을게요", "아직 잘 모르겠어요"];

export function EarlyForm({ role, id }: { role: Role; id: string }) {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    // 첫 번째 문제 칸으로 포커스를 옮기고 그 내용을 알린다
    const fail = (name: string, msg: string) => { setErr(msg); (form.querySelector(`[name="${name}"]`) as HTMLElement | null)?.focus(); };
    const email = String(f.get("email") || "").trim();
    if (role === "cro" && !String(f.get("org") || "").trim()) return fail("org", "기관명을 적어 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("email", "이메일 주소를 확인해 주세요. 예: name@company.com");
    if (f.getAll("kind").length === 0) return fail("kind", role === "req" ? "맡길 시험을 하나 이상 골라 주세요." : "수행 분야를 하나 이상 골라 주세요.");
    if (role === "cro" && !f.get("intent")) return fail("intent", "참여 생각을 골라 주세요.");
    if (!f.get("agree")) return fail("agree", "개인정보 수집·이용에 동의해 주세요.");
    setErr("");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="ef-done" role="status">
        <b>예약을 받았어요.</b>
        <p>오픈 전에 이메일로 먼저 알려드릴게요. (시안이라 아직 저장하지 않아요)</p>
      </div>
    );
  }

  return (
    <form className="ef" onSubmit={onSubmit} noValidate aria-describedby={err ? `${id}-err` : undefined}>
      {role === "cro" && (
        <div className="ef-f">
          <label htmlFor={`${id}-org`}>기관명</label>
          <input id={`${id}-org`} name="org" autoComplete="organization" required />
        </div>
      )}
      <div className="ef-f">
        <label htmlFor={`${id}-email`}>{role === "req" ? "이메일" : "담당자 이메일"}</label>
        <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required />
      </div>
      {role === "req" && (
        <div className="ef-f">
          <label htmlFor={`${id}-type`}>회사 유형</label>
          <select id={`${id}-type`} name="orgType" defaultValue="">
            <option value="" disabled>골라 주세요</option>
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      )}
      <fieldset className="ef-f">
        <legend>{role === "req" ? "맡길 시험" : "수행 분야"}</legend>
        <div className="ef-chips">
          {KINDS.map((k) => (
            <label key={k}><input type="checkbox" name="kind" value={k} /><span>{KIND_LABEL[k]} <b>{k}</b></span></label>
          ))}
        </div>
      </fieldset>
      {role === "req" ? (
        <fieldset className="ef-f">
          <legend>예정 시기</legend>
          <div className="ef-chips">
            {WHEN.map((w) => (
              <label key={w}><input type="radio" name="when" value={w} /><span>{w}</span></label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <fieldset className="ef-f">
            <legend>보유 GLP 인증</legend>
            <div className="ef-chips">
              {GLP.map((g) => (
                <label key={g}><input type="checkbox" name="glp" value={g} /><span>{g}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset className="ef-f">
            <legend>참여 생각</legend>
            <div className="ef-list">
              {INTENT.map((t) => (
                <label key={t}><input type="radio" name="intent" value={t} /><span>{t}</span></label>
              ))}
            </div>
          </fieldset>
          <div className="ef-f">
            <label htmlFor={`${id}-ask`}>참여 전에 확인하고 싶은 점 <small>선택</small></label>
            <textarea id={`${id}-ask`} name="ask" rows={1} autoComplete="off" />
          </div>
        </>
      )}
      <label className="ef-agree">
        <input type="checkbox" name="agree" />
        <span>오픈 안내를 위해 이메일{role === "cro" ? "·기관명" : ""}을 모으고, 오픈 6개월 뒤 지워요. 동의합니다.</span>
      </label>
      {err && <p className="ef-err" id={`${id}-err`} role="alert">{err}</p>}
      <button className="btn solid ef-go" type="submit">{role === "req" ? "예약하기" : "참여 예약하기"}</button>
    </form>
  );
}
