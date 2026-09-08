"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WIZ, STEP2, DETAILS, DEFAULT_VALUES, filled, validateRequired, type Cat, type Values } from "@/lib/rfq-schema";
import { RfqField } from "@/components/RfqField";
import { Chevron } from "@/components/Chevron";
import { Caret, Lock } from "@/components/app/ui";
import { clearDraft, loadDraft, saveDraft } from "@/components/app/AppState";
import { uploadToSigned, type UploadTicket } from "@/lib/upload";

type Contact = { company: string; name: string; dept: string; email: string; phone: string; orgType: string };
type Phase = "wizard" | "detail" | "summary";

/** 요약 화면 행 — [라벨, 값 키, 문항 번호, 필수] */
const ROWS: [string, string, number, boolean][] = [
  ["의뢰 목적", "purpose", 0, true],
  ["개발 분야", "devField", 1, false],
  ["제출처", "authority", 2, false],
  ["시험물질", "substance", 3, true],
  ["착수 시기", "start", 4, false],
  ["회신 희망일", "replyBy", 5, false],
  ["예산", "budget", 6, false],
  ["CRO 수", "croCount", 7, true],
  ["기밀 등급", "confid", 8, true],
  ["시험 항목", "categories", 9, true],
  ["추가 내용", "notes", 10, false],
];

/**
 * 로그인 사용자용 견적 요청 위자드.
 * 담당자 정보는 계정에서 채우고, 위자드(12) → 상세 조건(선택) → 요약 → 제출.
 * 문항 단위로 이 기기에 임시 저장한다.
 */
export function NewRequest({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("wizard");
  const [q, setQ] = useState(0);
  const [values, setValues] = useState<Values>({ ...DEFAULT_VALUES, agreePrivacy: true, agreeTerms: true });
  const [files, setFiles] = useState<File[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setValues((v) => ({ ...v, ...d.values }));
      setQ(Math.min(d.q, WIZ.length - 1));
    }
    setReady(true);
  }, []);

  const set = (id: string, v: string | string[] | boolean) => {
    const next = { ...values, [id]: v };
    setValues(next);
    setError("");
    saveDraft({ q, values: next as Record<string, string | string[] | boolean> });
  };
  const go = (n: number) => {
    setQ(n);
    saveDraft({ q: n, values: values as Record<string, string | string[] | boolean> });
    window.scrollTo(0, 0);
  };

  const step = WIZ[q];
  const stepOk = step.fields.every((f) => !f.required || filled(values, f.id));
  const last = q === WIZ.length - 1;
  const required = step.fields.some((f) => f.required);
  const anyFilled = step.fields.some((f) => filled(values, f.id));
  const nextLabel = last ? "요약 확인" : required || anyFilled ? "다음" : "건너뛰기";
  const cats = (Array.isArray(values.categories) ? values.categories : []) as Cat[];
  const details = cats.filter((c) => DETAILS[c]);
  const contactOk = !!(contact.company && contact.name && contact.email);
  const submittedStep = STEP2.some((g) => g.fields.some((f) => filled(values, f.id))) || details.some((c) => DETAILS[c].some((f) => filled(values, `${c}.${f.id}`))) ? 2 : 1;

  const submit = async () => {
    const payload: Values = { ...contact, ...values, submittedStep: String(submittedStep), source: "app" };
    const err = validateRequired(payload);
    if (err) return setError(err);
    if (!contactOk) return setError("프로필의 회사·기관명과 성명을 먼저 채워 주세요.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { rfqNo?: string; error?: string; uploads?: UploadTicket[] };
      if (!res.ok || !data.rfqNo) throw new Error(data.error || "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      let failed = 0;
      const tickets = data.uploads ?? [];
      await Promise.all(files.map(async (f, i) => {
        const t = tickets[i];
        if (!t || t.name !== f.name || !(await uploadToSigned(t, f))) failed++;
      }));
      clearDraft();
      const qs = new URLSearchParams({ no: data.rfqNo });
      if (files.length && failed) qs.set("upfail", String(failed));
      router.push(`/app/new/done?${qs}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  if (!ready) return null;

  /* ── 요약 ── */
  if (phase === "summary") {
    const show = (key: string) => {
      const v = values[key];
      if (Array.isArray(v)) return v.length ? v.join(", ") : "";
      return typeof v === "string" ? v : "";
    };
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button type="button" className="crumb" style={{ background: "none", border: 0, padding: 0 }} onClick={() => setPhase(submittedStep === 2 ? "detail" : "wizard")}>
          <Caret size={14} /> 이전
        </button>
        <div className="ph">
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>마지막 확인</p>
            <h1>이 내용으로 CRO {String(values.croCount ?? "3곳")}에 전달합니다</h1>
            <p>항목을 누르면 해당 질문으로 돌아가 수정할 수 있어요.</p>
          </div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
              <span>담당자 (계정 정보)</span>
              <Link href="/app/profile">수정</Link>
            </div>
            {[["회사", contact.company], ["담당자", [contact.name, contact.dept].filter(Boolean).join(" · ")], ["이메일", contact.email], ["휴대전화", contact.phone]]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="kv" style={{ borderTop: "1px solid var(--track)" }}>
                  <span className="kv__k">{k}</span>
                  <span className="kv__v">{v}</span>
                </div>
              ))}
            {!contactOk && <p className="note note--err" style={{ margin: "8px 0 12px" }}>프로필에 회사·기관명과 성명이 없습니다. 먼저 채워 주세요.</p>}
          </div>

          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>의뢰 내용</div>
            {ROWS.map(([label, key, idx, req]) => {
              const v = show(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setPhase("wizard"); go(idx); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, width: "100%", padding: "11px 0", border: 0, borderTop: "1px solid var(--track)", background: "none", textAlign: "left", fontSize: 15, color: "var(--ink)" }}
                >
                  <span style={{ color: "var(--muted)", flex: "none", width: 96 }}>{label}</span>
                  <span style={{ fontWeight: v ? 600 : 400, textAlign: "right", color: v ? "var(--ink)" : req ? "var(--err)" : "var(--ph)" }}>{v || (req ? "미입력" : "건너뜀")}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => { setPhase("detail"); window.scrollTo(0, 0); }}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, width: "100%", padding: "11px 0", border: 0, borderTop: "1px solid var(--track)", background: "none", textAlign: "left", fontSize: 15, color: "var(--ink)" }}
            >
              <span style={{ color: "var(--muted)", flex: "none", width: 96 }}>상세 조건</span>
              <span style={{ fontWeight: 600, color: submittedStep === 2 ? "var(--ink)" : "var(--brand)" }}>{submittedStep === 2 ? `입력함 · 첨부 ${files.length}개` : "입력하기 (선택)"}</span>
            </button>
          </div>

          <div className="note note--tint">
            <Lock />
            <span>
              기밀 등급 <b style={{ fontWeight: 600 }}>{String(values.confid ?? "일반")}</b>
              {String(values.confid ?? "").startsWith("CDA") ? " — 비밀유지계약을 체결한 CRO에만 요청서가 전달되고, 회사명은 체결 전까지 마스킹됩니다." : " — 요청서는 견적 목적으로 참여 CRO에만 전달됩니다."}
            </span>
          </div>

          {error && <p className="note note--err" role="alert">{error}</p>}
          <button type="button" className="b1 blg" onClick={submit} disabled={busy || !contactOk}>
            {busy ? "접수 중…" : "제출"}
          </button>
        </div>
      </div>
    );
  }

  /* ── 상세 조건 (선택) ── */
  if (phase === "detail") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button type="button" className="crumb" style={{ background: "none", border: 0, padding: 0 }} onClick={() => { setPhase("wizard"); go(WIZ.length - 1); }}>
          <Caret size={14} /> 이전
        </button>
        <div className="ph">
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>상세 조건 (선택)</p>
            <h1>알고 있는 조건만 입력하세요</h1>
            <p>비워 두면 CRO가 표준 설계로 견적합니다. 앞에서 고른 시험 항목의 세부 조건은 아래에 있습니다.</p>
          </div>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          {STEP2.map((g) => (
            <section key={g.title} className="dcard">
              <div>
                <h2>{g.title}</h2>
                {g.desc && <p className="dcard__desc">{g.desc}</p>}
              </div>
              <div className="dcard__fields">
                {g.fields.map((f) => (
                  <RfqField key={f.id} field={f} id={f.id} values={values} onChange={set} files={files} onFiles={setFiles} />
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
          <div className="cta">
            <button type="button" className="b1 blg bfull" onClick={() => { setPhase("summary"); window.scrollTo(0, 0); }}>요약 확인</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 위자드 ── */
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Link href="/app" className="crumb" style={{ margin: 0 }}>닫기</Link>
        <span className="tnum" style={{ fontSize: 13, color: "var(--muted)" }}>{q + 1} / {WIZ.length}</span>
      </div>
      <div style={{ height: 3, background: "var(--track)", borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: 3, background: "var(--brand)", borderRadius: 2, width: `${(q / WIZ.length) * 100}%`, transition: "width .3s ease" }} />
      </div>

      {q > 0 && (
        <button type="button" className="crumb" style={{ background: "none", border: 0, padding: 0 }} onClick={() => go(q - 1)}>
          <Caret size={14} /> 이전
        </button>
      )}
      <div className="ph" style={{ marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>{step.eyebrow}</p>
          <h1 style={{ textWrap: "balance" }}>{step.q}</h1>
          {step.sub && <p>{step.sub}</p>}
        </div>
      </div>

      <div key={q} className="rise-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {step.fields.map((f, i) => (
          <RfqField
            key={f.id}
            field={f}
            id={f.id}
            values={values}
            onChange={set}
            big
            autoFocus={i === 0 && ["text", "email", "tel", "date"].includes(f.type)}
            onEnter={() => stepOk && (last ? setPhase("summary") : go(q + 1))}
          />
        ))}
        {last && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            <Link href="/terms" target="_blank">이용약관</Link> · <Link href="/privacy" target="_blank">개인정보처리방침</Link> 전문 보기
          </p>
        )}
      </div>

      <div className="cta">
        <button type="button" className="b1 blg bfull" disabled={!stepOk} onClick={() => (last ? setPhase("summary") : go(q + 1))}>
          {nextLabel}
        </button>
        <p className="cta__note">자동 저장됨 · 언제든 닫고 이어서 작성할 수 있어요</p>
      </div>
    </div>
  );
}
