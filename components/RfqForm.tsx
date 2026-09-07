"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CONTACT,
  WIZ,
  STEP2,
  DETAILS,
  DEFAULT_VALUES,
  TOTAL_STEPS,
  filled,
  validateRequired,
  type Cat,
  type Values,
} from "@/lib/rfq-schema";
import { RfqField } from "./RfqField";
import { Chevron } from "./Chevron";
import { LogoMark } from "./Logo";
import { uploadToSigned, type UploadTicket } from "@/lib/upload";

type Phase = "contact" | "wizard" | "detail";

export function RfqForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("contact");
  /** 담당자 정보에서 지금까지 노출된 필드 수 (1~6) */
  const [revealed, setRevealed] = useState(1);
  /** 위자드 질문 인덱스 (0~11) */
  const [q, setQ] = useState(0);
  const [values, setValues] = useState<Values>(DEFAULT_VALUES);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (id: string, v: string | string[] | boolean) => {
    setValues((s) => ({ ...s, [id]: v }));
    setError("");
  };

  const isContact = phase === "contact";
  const isWizard = phase === "wizard";
  const isDetail = phase === "detail";
  const lastWiz = isWizard && q === WIZ.length - 1;
  const cur = isWizard ? WIZ[q] : null;
  const contactLast = CONTACT[revealed - 1];

  /** 현재 화면의 필수 입력이 채워졌는지 */
  const ok = (() => {
    if (isContact) return !contactLast.required || filled(values, contactLast.id);
    if (isWizard) return WIZ[q].fields.every((f) => !f.required || filled(values, f.id));
    return true;
  })();

  const step = isContact ? revealed : isWizard ? CONTACT.length + q + 1 : TOTAL_STEPS;
  const pct = isDetail ? 100 : Math.round(((step - 1) / TOTAL_STEPS) * 100);

  const advance = () => {
    if (!ok) return;
    if (isContact) {
      if (revealed < CONTACT.length) setRevealed(revealed + 1);
      else {
        setPhase("wizard");
        setQ(0);
        window.scrollTo(0, 0);
      }
    } else if (isWizard && q < WIZ.length - 1) {
      setQ(q + 1);
      window.scrollTo(0, 0);
    }
  };

  const back = () => {
    if (isContact) setRevealed(Math.max(1, revealed - 1));
    else if (isWizard) {
      if (q === 0) {
        setPhase("contact");
        setRevealed(CONTACT.length);
      } else setQ(q - 1);
    } else {
      setPhase("wizard");
      setQ(WIZ.length - 1);
    }
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    const err = validateRequired(values);
    if (err) return setError(err);
    setBusy(true);
    setError("");
    try {
      // 1) 접수 (JSON) — 파일은 메타만 보내고 서명 URL을 받는다
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { ...values, submittedStep: isDetail ? 2 : 1 },
          files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { rfqNo?: string; error?: string; uploads?: UploadTicket[] };
      if (!res.ok || !data.rfqNo) throw new Error(data.error || "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");

      // 2) 첨부는 브라우저가 Storage로 직접 업로드 (서버 본문 한도 회피)
      let failed = 0;
      const tickets = data.uploads ?? [];
      await Promise.all(
        files.map(async (f, i) => {
          const t = tickets[i];
          if (!t || t.name !== f.name || !(await uploadToSigned(t, f))) failed++;
        }),
      );
      const q = new URLSearchParams({ no: data.rfqNo });
      if (files.length && failed) q.set("upfail", String(failed));
      router.push(`/rfq/complete?${q}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  const cats = (Array.isArray(values.categories) ? values.categories : []) as Cat[];
  const details = cats.filter((c) => DETAILS[c]);

  /** 선택 항목만 남은 화면에서는 "건너뛰기"로 표시 */
  const nextLabel = (() => {
    if (isContact) {
      if (revealed < CONTACT.length && !contactLast.required && !filled(values, contactLast.id)) return "건너뛰기";
      return "다음";
    }
    if (cur && !cur.fields.some((f) => f.required) && !cur.fields.some((f) => filled(values, f.id))) return "건너뛰기";
    return "다음";
  })();

  return (
    <div className="fm">
      <header className="fm__head">
        <div className="fm__head-in">
          <Link href="/" className="logo" aria-label="단추 홈">
            <LogoMark size={28} />
            <span className="logo__name">단추</span>
          </Link>
          <span className="fm__step">{isDetail ? "상세 조건 (선택)" : `${step} / ${TOTAL_STEPS}`}</span>
        </div>
        <div className="fm__track">
          <div className="fm__fill" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="fm__main">
        <div className="fm__wrap">
          {!(isContact && revealed === 1) && (
            <button type="button" className="fm__back" onClick={back} disabled={busy}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              이전
            </button>
          )}

          <div className="fm__q">
            <p className="fm__eyebrow">{isContact ? "담당자 정보" : isDetail ? "상세 조건 (선택)" : cur!.eyebrow}</p>
            <h1 className="fm__heading">
              {isContact ? "견적을 받을 담당자 정보를 알려주세요" : isDetail ? "알고 있는 조건만 입력하세요" : cur!.q}
            </h1>
            <p className="fm__sub">
              {isContact
                ? "입력을 마치면 다음 항목이 아래에 나타납니다."
                : isDetail
                  ? "비워 두면 CRO가 표준 설계로 견적합니다. 앞에서 고른 시험 항목의 세부 조건은 아래에 있습니다."
                  : cur!.sub || ""}
            </p>
          </div>

          {/* 허니팟 — 사람은 보지 못하고 자동화 도구만 채우는 칸. 값이 있으면 서버가 조용히 버린다 */}
          <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={typeof values.website === "string" ? values.website : ""}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>

          {/* 담당자 정보 — 순차 노출 */}
          {isContact && (
            <div className="fm__stack">
              {CONTACT.slice(0, revealed).map((f, i) => (
                <div key={f.id} className="rise">
                  <RfqField
                    field={f}
                    id={f.id}
                    values={values}
                    onChange={set}
                    autoFocus={i === revealed - 1}
                    onCommit={() => {
                      if (i === revealed - 1 && filled(values, f.id)) advance();
                    }}
                    onEnter={advance}
                  />
                </div>
              ))}
            </div>
          )}

          {/* 위자드 — 한 화면 한 질문 */}
          {isWizard && (
            <div className="fm__stack fm__stack--tight rise" key={`q${q}`}>
              {cur!.fields.map((f, i) => (
                <RfqField
                  key={f.id}
                  field={f}
                  id={f.id}
                  values={values}
                  onChange={set}
                  big
                  autoFocus={i === 0 && ["text", "email", "tel", "date"].includes(f.type)}
                  onEnter={advance}
                />
              ))}
            </div>
          )}

          {/* 상세 조건 */}
          {isDetail && (
            <div className="fm__stack fm__stack--tight">
              {STEP2.map((g) => (
                <section key={g.title} className="dcard">
                  <div>
                    <h2>{g.title}</h2>
                    {g.desc && <p className="dcard__desc">{g.desc}</p>}
                  </div>
                  <div className="dcard__fields">
                    {g.fields.map((f) => (
                      <RfqField
                        key={f.id}
                        field={f}
                        id={f.id}
                        values={values}
                        onChange={set}
                        files={files}
                        onFiles={setFiles}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {details.length === 0 && <div className="dempty">선택한 시험 항목이 없어 세부 조건이 없습니다.</div>}

              {details.map((cat) => (
                <details key={cat} open className="acc">
                  <summary>
                    <span>{cat}</span>
                    <Chevron />
                  </summary>
                  <div className="acc__fields">
                    {DETAILS[cat].map((f) => (
                      <RfqField key={f.id} field={f} id={`${cat}.${f.id}`} values={values} onChange={set} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>

      <div className="fm__foot">
        <div className="fm__foot-in">
          {(isContact || isWizard) && !lastWiz && (
            <button type="button" className="btn--next" onClick={advance} disabled={!ok || busy}>
              {nextLabel}
            </button>
          )}
          {(lastWiz || isDetail) && (
            <>
              <button type="button" className="btn--next" onClick={submit} disabled={!ok || busy}>
                {busy ? "접수 중…" : "제출"}
              </button>
              {lastWiz && (
                <button
                  type="button"
                  className="btn--ghost"
                  onClick={() => {
                    if (!ok) return;
                    setPhase("detail");
                    window.scrollTo(0, 0);
                  }}
                  disabled={!ok || busy}
                >
                  더 정확한 견적을 위해 상세 입력 →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
