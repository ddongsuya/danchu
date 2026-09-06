"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WIZ, type Values } from "@/lib/rfq-schema";
import { clearDraft, loadDraft, saveDraft } from "@/components/app/AppState";
import { CheckDisc, CheckMark, Caret, Lock } from "@/components/app/ui";
import { ME } from "@/lib/app-data";

const DEFAULTS: Values = { croCount: "5곳", confid: "CDA 필요 (단추 표준 CDA)", categories: [] };

/** 요약 화면에 세울 행 — [라벨, 값 키, 문항 번호, 필수 여부] */
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

export default function NewRequest() {
  const router = useRouter();
  const [phase, setPhase] = useState<"wizard" | "summary">("wizard");
  const [q, setQ] = useState(0);
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 이어서 작성 — 마지막으로 보던 문항으로 복귀
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setValues({ ...DEFAULTS, ...d.values });
      setQ(Math.min(d.q, WIZ.length - 1));
    }
    setReady(true);
  }, []);

  const set = (id: string, v: string | string[] | boolean) => {
    const next = { ...values, [id]: v };
    setValues(next);
    saveDraft({ q, values: next as Draftable });
  };

  const step = WIZ[q];
  const field = step.fields[0];
  const isCheck = step.fields.every((f) => f.type === "checkbox");
  const isList = ["radio", "select", "segmented", "chips"].includes(field.type);
  const multi = field.type === "chips";
  const raw = values[field.id];
  const arr = Array.isArray(raw) ? raw : [];

  const filled = isCheck
    ? step.fields.every((f) => values[f.id] === true)
    : multi
      ? arr.length > 0
      : typeof raw === "string" && raw.length > 0;
  const required = step.fields.some((f) => f.required);
  const canNext = !required || filled;
  const last = q === WIZ.length - 1;
  const nextLabel = last ? "요약 확인" : required || filled ? "다음" : "건너뛰기";

  const go = (n: number) => {
    setQ(n);
    saveDraft({ q: n, values: values as Draftable });
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append(
        "payload",
        JSON.stringify({
          // 담당자 정보는 계정에서 채운다
          company: ME.company, name: ME.name, dept: ME.dept, email: ME.email, phone: ME.phone, orgType: ME.orgType,
          ...values,
          submittedStep: 1,
          source: "app",
        }),
      );
      const res = await fetch("/api/rfq", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { rfqNo?: string; error?: string };
      if (!res.ok || !data.rfqNo) throw new Error(data.error || "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      clearDraft();
      router.push(`/app/new/done?no=${encodeURIComponent(data.rfqNo)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  if (!ready) return <div className="scr scr--wh" />;

  /* ── 04 요약 ─────────────────────────────────── */
  if (phase === "summary") {
    const show = (key: string) => {
      const v = values[key];
      if (Array.isArray(v)) return v.length ? v.join(", ") : "";
      return typeof v === "string" ? v : "";
    };
    return (
      <div className="scr scr--wh">
        <div className="hd">
          <div className="hd__bar">
            <button type="button" className="hd__back" onClick={() => setPhase("wizard")}>
              <Caret />
              이전
            </button>
            <span className="hd__ttl">견적 요청</span>
            <span className="hd__act">확인</span>
          </div>
        </div>

        <div className="pad" style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>마지막 확인</p>
          <h1 style={{ fontSize: 26, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.02em" }}>
            이 내용으로 CRO {String(values.croCount ?? "5곳")}에 전달합니다
          </h1>
          <p style={{ fontSize: 15, color: "var(--muted)" }}>항목을 누르면 해당 질문으로 돌아가 수정할 수 있어요.</p>
        </div>

        <div className="pad" style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>담당자</div>
            {[["회사", ME.company], ["담당자", `${ME.name} · ${ME.dept}`], ["이메일", ME.email]].map(([k, v]) => (
              <div key={k} className="kv" style={{ padding: "10px 0", borderTop: "1px solid var(--track)" }}>
                <span className="kv__k">{k}</span>
                <span className="kv__v">{v}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "6px 18px" }}>
            <div style={{ padding: "12px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>의뢰 내용</div>
            {ROWS.map(([label, key, idx, req]) => {
              const v = show(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPhase("wizard");
                    go(idx);
                  }}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
                    width: "100%", padding: "11px 0", border: 0, borderTop: "1px solid var(--track)",
                    background: "none", textAlign: "left", fontSize: 15, color: "var(--ink)",
                  }}
                >
                  <span style={{ color: "var(--muted)", flex: "none", width: 96 }}>{label}</span>
                  <span
                    style={{
                      fontWeight: v ? 600 : 400, textAlign: "right",
                      color: v ? "var(--ink)" : req ? "var(--err)" : "var(--ph)",
                    }}
                  >
                    {v || (req ? "미입력" : "건너뜀")}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "14px 16px", background: "var(--tint)", border: "1px solid var(--bline)", borderRadius: 12, fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>
            <Lock />
            <span>
              기밀 등급 <b style={{ fontWeight: 600 }}>{String(values.confid ?? "CDA 필요")}</b> — 비밀유지계약을 체결한 CRO에만 요청서가 전달되고, 회사명은 체결 전까지 마스킹됩니다.
            </span>
          </div>

          {error && (
            <p role="alert" style={{ padding: "12px 16px", borderRadius: 10, background: "var(--err-bg)", color: "var(--err)", fontSize: 14 }}>
              {error}
            </p>
          )}
        </div>

        <div className="cta cta--wh">
          <button type="button" className="b1" onClick={submit} disabled={busy}>
            {busy ? "접수 중…" : "제출"}
          </button>
          <Link href="/rfq" className="b2">더 정확한 견적을 위해 상세 입력 →</Link>
        </div>
      </div>
    );
  }

  /* ── 03 위자드 ───────────────────────────────── */
  return (
    <div className="scr scr--wh">
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--wh)", paddingTop: "calc(var(--top) + 6px)" }}>
        <div className="hd__bar" style={{ padding: "0 20px" }}>
          <Link href="/app" className="hd__back" style={{ minWidth: 44 }}>닫기</Link>
          <span className="hd__ttl">견적 요청</span>
          <span className="tnum" style={{ fontSize: 13, color: "var(--muted)", minWidth: 44, textAlign: "right" }}>
            {q + 1} / {WIZ.length}
          </span>
        </div>
        <div style={{ height: 3, background: "var(--track)" }}>
          <div style={{ height: 3, background: "var(--brand)", width: `${(q / WIZ.length) * 100}%`, transition: "width .3s ease" }} />
        </div>
      </div>

      <div className="pad" style={{ flex: 1, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        {q > 0 && (
          <button type="button" className="hd__back" style={{ alignSelf: "flex-start", margin: "-8px 0 -8px -8px" }} onClick={() => go(q - 1)}>
            <Caret />
            이전
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>{step.eyebrow}</p>
          <h1 style={{ fontSize: 26, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.02em", textWrap: "balance" }}>{step.q}</h1>
          {step.sub && <p style={{ fontSize: 15, color: "var(--muted)" }}>{step.sub}</p>}
        </div>

        {isList && (
          <div key={q} className="rise-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(field.options ?? []).map((o) => {
              const on = multi ? arr.includes(o) : raw === o;
              return (
                <button
                  key={o}
                  type="button"
                  className="optcard"
                  aria-pressed={on}
                  onClick={() => set(field.id, multi ? (on ? arr.filter((x) => x !== o) : [...arr, o]) : o)}
                >
                  <span>{o}</span>
                  <CheckDisc />
                </button>
              );
            })}
          </div>
        )}

        {["text", "date"].includes(field.type) && (
          <input
            key={q}
            className="inp"
            type={field.type}
            value={typeof raw === "string" ? raw : ""}
            onChange={(e) => set(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        )}

        {field.type === "textarea" && (
          <textarea
            key={q}
            className="ta"
            rows={6}
            value={typeof raw === "string" ? raw : ""}
            onChange={(e) => set(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        )}

        {isCheck && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {step.fields.map((f) => {
              const on = values[f.id] === true;
              return (
                <button key={f.id} type="button" className="chkcard" aria-pressed={on} onClick={() => set(f.id, !on)}>
                  <span className="chkcard__box">
                    <CheckMark />
                  </span>
                  {/* 카드 전체가 토글이라 라벨 안에는 링크를 두지 않는다 (약관은 하단 안내로) */}
                  <span>
                    {f.label}
                    <span className="req">*</span>
                  </span>
                </button>
              );
            })}
            <p style={{ fontSize: 13, color: "var(--muted)", padding: "2px 2px 0" }}>
              <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link> 전문 보기
            </p>
          </div>
        )}
      </div>

      <div className="cta cta--wh">
        <button
          type="button"
          className="b1"
          disabled={!canNext}
          onClick={() => (last ? setPhase("summary") : go(q + 1))}
        >
          {nextLabel}
        </button>
        <p className="cta__note">자동 저장됨 · 언제든 닫고 이어서 작성할 수 있어요</p>
      </div>
    </div>
  );
}

type Draftable = Record<string, string | string[] | boolean>;
