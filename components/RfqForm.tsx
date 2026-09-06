"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STEP1, STEP2, DETAILS, CATS, DEFAULT_VALUES, validateStep1, type Values, type Group, type Field } from "@/lib/rfq-schema";
import { RfqField } from "./RfqField";
import { Chevron } from "./Chevron";

type Cat = (typeof CATS)[number];

export function RfqForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Values>(DEFAULT_VALUES);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (id: string, v: string | string[] | boolean) => {
    setValues((s) => ({ ...s, [id]: v }));
    setError("");
  };

  const cats = (Array.isArray(values.categories) ? values.categories : []) as Cat[];
  const details = cats.filter((c) => DETAILS[c]);

  const goStep2 = () => {
    const err = validateStep1(values);
    if (err) return setError(err);
    setStep(2);
    window.scrollTo(0, 0);
  };
  const goStep1 = () => {
    setStep(1);
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    const err = validateStep1(values);
    if (err) return setError(err);
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ ...values, submittedStep: step }));
      for (const f of files) fd.append("files", f, f.name);
      const res = await fetch("/api/rfq", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { rfqNo?: string; error?: string };
      if (!res.ok || !data.rfqNo) throw new Error(data.error || "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      router.push(`/rfq/complete?no=${encodeURIComponent(data.rfqNo)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <div className="form-wrap">
      <div className="progress">
        <div className="progress__head">
          <h1>{step === 1 ? "기본 정보" : "상세 조건 (선택)"}</h1>
          <span>{step} / 2</span>
        </div>
        <div className="progress__bar" aria-hidden="true">
          <i className="on" />
          <i className={step === 2 ? "on" : ""} />
        </div>
        <p className="progress__desc">
          {step === 1
            ? "이 단계만 제출해도 견적 요청이 완료됩니다. 약 5분 소요."
            : "알고 있는 조건만 입력하세요. 비워 두면 CRO가 표준 설계로 견적합니다."}
        </p>
      </div>

      {(step === 1 ? STEP1 : STEP2).map((g) => (
        <GroupCard key={g.title} group={g} values={values} set={set} files={files} setFiles={setFiles} />
      ))}

      {step === 2 && (
        <div className="details-stack">
          <div className="details-head">
            <h2 className="group__title">시험 항목별 세부 조건</h2>
            <p className="group__desc">1단계에서 선택한 대분류만 표시됩니다. 미정인 항목은 비워 두세요.</p>
          </div>
          {details.length === 0 && (
            <div className="details-empty">1단계에서 시험 항목 대분류를 선택하면 세부 조건이 여기에 표시됩니다.</div>
          )}
          {details.map((cat) => (
            <details key={cat} open className="acc">
              <summary>
                <span>{cat}</span>
                <Chevron />
              </summary>
              <div className="fields">
                {DETAILS[cat].map((f) => (
                  <FieldCell key={f.id} field={f}>
                    <RfqField field={f} id={`${cat}.${f.id}`} values={values} onChange={set} />
                  </FieldCell>
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

      <div className="form-actions">
        {step === 1 ? (
          <>
            <button type="button" className="btn btn--primary btn--form" onClick={submit} disabled={busy}>
              {busy ? "접수 중…" : "제출"}
            </button>
            <button type="button" className="btn btn--outline btn--form-outline" onClick={goStep2} disabled={busy}>
              더 정확한 견적을 위해 상세 입력 →
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--text btn--form" onClick={goStep1} disabled={busy}>
              ← 기본 정보로
            </button>
            <button type="button" className="btn btn--primary btn--form" onClick={submit} disabled={busy}>
              {busy ? "접수 중…" : "제출"}
            </button>
          </>
        )}
      </div>
      <p className="form-note">의뢰자 무료 · 입력 내용은 CDA 체결 후 참여 CRO에만 전달됩니다.</p>
    </div>
  );
}

function FieldCell({ field, children }: { field: Field; children: React.ReactNode }) {
  return <div className={`field-cell${field.full ? " field-cell--full" : ""}`}>{children}</div>;
}

function GroupCard({
  group,
  values,
  set,
  files,
  setFiles,
}: {
  group: Group;
  values: Values;
  set: (id: string, v: string | string[] | boolean) => void;
  files: File[];
  setFiles: (f: File[]) => void;
}) {
  return (
    <section className="group">
      <div>
        <h2 className="group__title">{group.title}</h2>
        {group.desc && <p className="group__desc">{group.desc}</p>}
      </div>
      <div className="fields">
        {group.fields.map((f) => (
          <FieldCell key={f.id} field={f}>
            <RfqField field={f} id={f.id} values={values} onChange={set} files={files} onFiles={setFiles} />
          </FieldCell>
        ))}
      </div>
    </section>
  );
}
