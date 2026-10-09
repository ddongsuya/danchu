"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  WIZ,
  STEP2,
  DETAILS,
  DEFAULT_VALUES,
  filled,
  validateRequired,
  labelMap,
  type Cat,
  type Field,
  type Values,
} from "@/lib/rfq-schema";
import { RfqField } from "@/components/RfqField";
import { Advisor } from "@/components/Advisor";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type Draft,
} from "@/components/app/AppState";
import { retryAttachment } from "@/components/app/AttachmentRetry";
import { PRESETS, presetItems } from "@/lib/presets";
import { DesignHints } from "@/components/guide/DesignHints";
import { requestChecks } from "@/lib/design-guide";
import { needsCda } from "@/lib/request-policy";
import "./request.css";

type Contact = {
  company: string;
  name: string;
  dept: string;
  email: string;
  phone: string;
  orgType: string;
};
type FileMeta = { name: string; size: number };
const STEPS = [
  "시험과 물질",
  "일정과 요청 조건",
  "자료와 정보 공개",
  "확인하고 보내기",
];
const FIELD_LABELS: Record<string, string> = {
  purpose: "의뢰 목적",
  intent: "요청 성격",
  devField: "개발 분야",
  authority: "자료 제출처",
  substance: "시험물질명 또는 코드명",
  start: "희망 착수 시기",
  replyBy: "견적 회신 희망일",
  budget: "예산 범위",
  croCount: "요청할 기관 수",
  confid: "정보 공개 방식",
  categories: "시험 항목",
  notes: "추가 설명",
};
const sameFile = (a: FileMeta, b: FileMeta) =>
  a.name === b.name && a.size === b.size;
const initial = (): Values => ({ ...DEFAULT_VALUES });

export function NewRequest({
  contact,
  userId,
  preview = false,
}: {
  contact: Contact;
  userId: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"start" | "advisor" | "edit">("start");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [missingFiles, setMissingFiles] = useState<FileMeta[]>([]);
  const [resume, setResume] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingNo, setPendingNo] = useState<string>();
  const [preset, setPreset] = useState("");
  const [undo, setUndo] = useState<Values | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setResume(loadDraft(userId));
    setReady(true);
  }, [userId]);
  useEffect(() => {
    if (!ready || phase !== "edit") return;
    const ok = saveDraft(userId, {
      version: 2,
      q: step,
      phase: step === 3 ? "review" : "edit",
      values,
      files: [
        ...missingFiles,
        ...files.map(({ name, size }) => ({ name, size })),
      ],
      pendingNo,
      updatedAt: new Date().toISOString(),
    });
    setSaveState(
      ok
        ? "이 브라우저에 임시 저장됨"
        : "임시 저장하지 못했습니다. 이 화면을 닫지 말고 다시 시도해 주세요.",
    );
  }, [userId, ready, phase, step, values, files, missingFiles, pendingNo]);
  useEffect(() => {
    if (phase === "edit") title.current?.focus();
  }, [phase, step]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (busy || saveState.startsWith("임시 저장하지")) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, saveState]);
  const set = (id: string, value: string | string[] | boolean) => {
    setValues((old) => ({ ...old, [id]: value }));
    setError("");
  };
  const cats = (
    Array.isArray(values.categories) ? values.categories : []
  ) as Cat[];
  const go = (n: number) => {
    setStep(n);
    setError("");
    window.scrollTo(0, 0);
  };
  const editSection = (n: number) => {
    setEditingReview(true);
    go(n);
  };
  const applyPreset = (key: string, replace = false) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    if (
      replace &&
      cats.length &&
      !window.confirm(
        "시험 항목과 항목별 상세 조건을 이 구성으로 바꿀까요? 일정·물질·첨부는 유지됩니다.",
      )
    )
      return;
    setUndo(values);
    const next = { ...values };
    if (replace) {
      next.categories = [];
      Object.keys(next)
        .filter((k) => k.includes("."))
        .forEach((k) => delete next[k]);
    }
    const add = (k: string, a: string[]) => {
      next[k] = [
        ...new Set([
          ...(Array.isArray(next[k]) ? (next[k] as string[]) : []),
          ...a,
        ]),
      ];
    };
    for (const it of presetItems(p)) {
      add("categories", [it.category]);
      const f = DETAILS[it.category as Cat]?.find(
        (x) => x.id === "items" || x.id === "segment",
      );
      if (f && it.item !== it.category)
        add(`${it.category}.${f.id}`, [it.item]);
      if (it.requestSpecies?.length)
        add(`${it.category}.species`, it.requestSpecies);
      if (
        it.method &&
        DETAILS[it.category as Cat]?.some((x) => x.id === "method")
      )
        add(`${it.category}.method`, [
          it.method.replace(/\(관찰 14일\)/, "").trim(),
        ]);
    }
    next.presetKey = p.key;
    setValues(next);
    setError("");
  };
  const start = () => {
    setValues(initial());
    setFiles([]);
    setMissingFiles([]);
    setPendingNo(undefined);
    setResume(null);
    setPhase("edit");
    go(0);
    const key = new URLSearchParams(window.location.search).get("preset");
    if (key) {
      setPreset(key);
      applyPreset(key);
    }
  };
  const field = (f: Field, id = f.id) => (
    <RfqField
      key={id}
      id={id}
      field={{ ...f, label: f.label || FIELD_LABELS[f.id] || f.id }}
      values={values}
      onChange={set}
      files={files}
      onFiles={(next) => {
        setFiles(next);
        setMissingFiles((old) =>
          old.filter((m) => !next.some((f) => sameFile(m, f))),
        );
      }}
    />
  );
  const baseFields = (ids: string[]) =>
    ids.map((id) => {
      const wiz = WIZ.find((w) => w.fields.some((f) => f.id === id))!;
      const f = wiz.fields.find((f) => f.id === id)!;
      return field({ ...f, help: f.help || wiz.sub });
    });
  const contactOk = !!(contact.company && contact.name && contact.email);
  const checks = requestChecks(values);
  const submit = async () => {
    if (busy || preview) return;
    const payload = {
      ...contact,
      ...values,
      source: "app",
      submittedStep: "2",
    };
    const invalid = validateRequired(payload);
    if (invalid) {
      const missing = WIZ.flatMap((w) => w.fields).find(
        (f) => f.required && !filled(values, f.id),
      );
      if (missing)
        setStep(
          ["purpose", "intent", "categories", "substance"].includes(missing.id)
            ? 0
            : missing.id === "croCount"
              ? 1
              : missing.id === "confid"
                ? 2
                : 3,
        );
      setError(invalid);
      return;
    }
    if (missingFiles.length) {
      setError("저장된 첨부파일을 다시 선택하거나 목록에서 제외해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let no = pendingNo;
      if (!no) {
        const r = await fetch("/api/rfq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload, files: [] }),
        });
        const d = await r.json();
        if (!r.ok || !d.rfqNo)
          throw new Error(
            d.error || "접수하지 못했습니다. 다시 시도해 주세요.",
          );
        no = d.rfqNo as string;
        setPendingNo(no);
        saveDraft(userId, {
          version: 2,
          q: 3,
          phase: "review",
          values,
          files: files.map(({ name, size }) => ({ name, size })),
          pendingNo: no,
          updatedAt: new Date().toISOString(),
        });
      }
      const failed: string[] = [];
      for (const f of files) {
        try {
          if (!(await retryAttachment(no, f))) failed.push(f.name);
        } catch {
          failed.push(f.name);
        }
      }
      if (failed.length)
        throw new Error(
          `요청 ${no}는 접수됐습니다. 업로드 실패: ${failed.join(", ")}. 아래 버튼으로 파일만 다시 올릴 수 있습니다.`,
        );
      clearDraft(userId);
      router.push(`/app/new/done?no=${encodeURIComponent(no)}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "처리하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!ready) return <p role="status">작성 중인 요청을 확인하고 있습니다.</p>;
  if (phase === "advisor")
    return (
      <div className="request">
        <p className="fld__help">
          시험 찾기의 답변은 화면을 닫으면 사라집니다. 선택한 시험을 요청서에
          담으면 임시 저장됩니다.
        </p>
        <Advisor
          onManual={() => {
            setPhase("edit");
            go(0);
          }}
          onApply={(patch) => {
            setValues((old) => ({ ...old, ...patch }));
            setPhase("edit");
            go(0);
          }}
        />
      </div>
    );
  if (phase === "start")
    return (
      <div className="request">
        <Link className="crumb" href="/app">
          내 견적 요청
        </Link>
        <h1>새 견적 요청</h1>
        <p className="request__lead">
          필요한 시험을 선택하고, 알고 있는 조건만 입력하세요.
        </p>
        {resume && (
          <section className="request__resume">
            <h2>작성 중인 요청이 있습니다</h2>
            <p>
              {String(resume.values.substance || "시험물질명 미입력")} ·{" "}
              {STEPS[resume.q]}
            </p>
            <p className="fld__help">
              이 브라우저에 저장된 내용입니다. 첨부파일은 다시 선택해야 합니다.
            </p>
            <div className="request__actions">
              <button
                className="b1"
                onClick={() => {
                  setValues(resume.values);
                  setStep(resume.q);
                  setPendingNo(resume.pendingNo);
                  setMissingFiles(resume.files);
                  setPhase("edit");
                }}
              >
                이어서 작성
              </button>
              <button
                className="b2"
                onClick={() => {
                  if (
                    window.confirm(
                      "저장된 초안을 지우고 새로 작성할까요? 이미 접수된 요청은 삭제되지 않습니다.",
                    )
                  ) {
                    clearDraft(userId);
                    start();
                  }
                }}
              >
                새로 작성
              </button>
            </div>
          </section>
        )}
        {!resume && (
          <div className="request__paths">
            <button onClick={() => setPhase("advisor")}>
              <b>필요한 시험 찾기</b>
              <span>
                개발 상황을 답하면 가이드라인 근거와 함께 시험을 제안합니다.
              </span>
            </button>
            <button onClick={start}>
              <b>시험 항목 직접 선택</b>
              <span>필요한 시험을 알고 있다면 바로 요청서를 작성하세요.</span>
            </button>
          </div>
        )}
      </div>
    );
  const labels = labelMap();
  return (
    <div className="request">
      <div className="request__top">
        <Link className="crumb" href="/app">
          닫기
        </Link>
        <span role="status" className="fld__help">
          {saveState}
        </span>
      </div>
      <nav className="request__steps" aria-label="견적 요청 작성 단계">
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s}
            aria-current={step === i ? "step" : undefined}
            disabled={busy || (!!pendingNo && i !== 3)}
            onClick={() => go(i)}
          >
            <span>{i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      <h1 ref={title} tabIndex={-1}>
        {STEPS[step]}
      </h1>
      <p className="request__lead">
        {step === 0
          ? "시험을 먼저 고르고, 세부 조건은 아는 만큼만 입력하세요."
          : step === 1
            ? "미정인 조건은 비워 둘 수 있습니다."
            : step === 2
              ? "요청 내용이 공개되는 범위를 확인하세요."
              : "입력한 내용과 첨부 상태를 확인한 뒤 요청을 보내세요."}
      </p>
      {pendingNo && (
        <div className="note note--tint">
          요청 {pendingNo}는 이미 접수됐습니다. 첨부파일만 다시 올립니다.{" "}
          <Link href={`/app/r/${pendingNo}`}>접수된 요청 보기</Link>
        </div>
      )}
      <fieldset disabled={busy || !!pendingNo} className="request__fieldset">
        {step === 0 && (
          <>
            <section className="request__section">
              <div className="request__section-head">
                <h2>시험 항목</h2>
                <button
                  type="button"
                  className="btxt"
                  onClick={() => setPhase("advisor")}
                >
                  시험 선택 도움받기
                </button>
              </div>
              {baseFields(["categories"])}
              <details className="request__details">
                <summary>시험 구성으로 한 번에 선택</summary>
                <label className="fld">
                  <span>시험 구성</span>
                  <select
                    className="sel"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                  >
                    <option value="">구성 선택</option>
                    {PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="fld__help">
                  {PRESETS.find((p) => p.key === preset)?.desc}
                </p>
                <div className="request__actions">
                  <button
                    type="button"
                    className="b2"
                    disabled={!preset}
                    onClick={() => applyPreset(preset)}
                  >
                    현재 선택에 추가
                  </button>
                  <button
                    type="button"
                    className="b2"
                    disabled={!preset}
                    onClick={() => applyPreset(preset, true)}
                  >
                    이 구성으로 바꾸기
                  </button>
                  {undo && (
                    <button
                      className="btxt"
                      type="button"
                      onClick={() => {
                        setValues(undo);
                        setUndo(null);
                      }}
                    >
                      구성 적용 되돌리기
                    </button>
                  )}
                </div>
              </details>
            </section>
            <section className="request__section">
              <h2>물질과 의뢰 목적</h2>
              <div className="request__fields">
                {baseFields(["substance", "purpose", "intent", "devField", "authority"])}
              </div>
            </section>
            {cats
              .filter((c) => DETAILS[c])
              .map((c) => (
                <details className="request__details" key={c}>
                  <summary>
                    {c} 상세 조건 <span>선택 입력</span>
                  </summary>
                  <div className="request__fields">
                    {c === "일반독성" && (
                      <DesignHints
                        values={values}
                        onFill={(patch) =>
                          setValues((old) => ({ ...old, ...patch }))
                        }
                      />
                    )}
                    {DETAILS[c].map((f) => field(f, `${c}.${f.id}`))}
                  </div>
                </details>
              ))}
            {STEP2.map((g) => (
              <details className="request__details" key={g.title}>
                <summary>
                  {g.title} <span>선택 입력</span>
                </summary>
                <p className="fld__help">
                  비워 둔 조건은 기관이 회신에서 제안합니다.
                </p>
                <div className="request__fields">
                  {g.fields
                    .filter((f) => f.type !== "file")
                    .map((f) => field(f))}
                </div>
              </details>
            ))}
          </>
        )}
        {step === 1 && (
          <section className="request__section request__fields">
            {baseFields(["start", "replyBy", "budget", "croCount"])}
            <p className="fld__help">
              승인된 기관 중 시험 분야가 맞는 곳에 순차적으로 전달합니다. 기관이
              부족하면 선택한 수보다 적게 전달될 수 있습니다.
            </p>
          </section>
        )}
        {step === 2 && (
          <section className="request__section request__fields">
            {baseFields(["confid"])}
            <div className="note note--tint">
              {needsCda(values.confid)
                ? "초대받은 기관에는 시험 개요를 먼저 전달합니다. 회사명과 담당자 연락처는 선정한 기관에만, 첨부파일은 해당 기관의 CDA 체결을 운영자가 확인한 뒤 공개합니다. 비공개 정보는 물질명·추가 설명에 적지 마세요."
                : "요청 내용과 첨부는 견적에 참여하는 기관에 전달됩니다. 회사명과 담당자 연락처는 어떤 기관에도 미리 공개되지 않고, 비교표에서 선정한 기관에만 전달됩니다. 선정 전에는 첨부 파일명도 가려지지만, 파일 내용 안의 회사명은 가려지지 않으니 확인해 주세요."}
            </div>
            {STEP2.flatMap((g) => g.fields)
              .filter((f) => f.type === "file")
              .map((f) => field(f))}
            {baseFields(["notes"])}
          </section>
        )}
        {step === 3 && (
          <>
            <section className="request__section">
              <h2>담당자</h2>
              <p>
                {contact.company} · {contact.name}
              </p>
              <p>{contact.email}</p>
              {preview ? <p>체험 화면에서는 예시 담당자 정보가 표시됩니다.</p> : <Link href="/app/profile">담당자 정보 수정</Link>}
              {!contactOk && (
                <p role="alert">
                  회사·기관명과 성명을 프로필에서 입력해 주세요.
                </p>
              )}
            </section>
            {[0, 1, 2].map((section) => {
              const ids =
                section === 0
                  ? [
                      "categories",
                      "substance",
                      "purpose",
                      "intent",
                      "devField",
                      "authority",
                    ]
                  : section === 1
                    ? ["start", "replyBy", "budget", "croCount"]
                    : ["confid", "notes"];
              return (
                <section className="request__section" key={section}>
                  <div className="request__section-head">
                    <h2>{STEPS[section]}</h2>
                    <button
                      className="btxt"
                      type="button"
                      onClick={() => editSection(section)}
                    >
                      수정
                    </button>
                  </div>
                  <dl className="request__summary">
                    {ids.map((id) => (
                      <div key={id}>
                        <dt>{FIELD_LABELS[id]}</dt>
                        <dd>
                          {Array.isArray(values[id])
                            ? (values[id] as string[]).join(", ") || "미선택"
                            : String(values[id] || "입력하지 않음")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
            <details className="request__details">
              <summary>입력한 상세 조건 확인</summary>
              <dl className="request__summary">
                {Object.entries(values)
                  .filter(
                    ([id, v]) =>
                      !FIELD_LABELS[id] &&
                      !id.startsWith("agree") &&
                      !id.startsWith("advisor") &&
                      id !== "presetKey" &&
                      filled(values, id) &&
                      labels[id],
                  )
                  .map(([id, v]) => (
                    <div key={id}>
                      <dt>{labels[id]}</dt>
                      <dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </details>
            {Array.isArray(values.advisorAsk) &&
              values.advisorAsk.length > 0 && (
                <details className="request__details">
                  <summary>
                    기관에 확인할 사항 {values.advisorAsk.length}개
                  </summary>
                  <ul>
                    {values.advisorAsk.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
            <section className="request__section">
              <h2>첨부파일 {files.length + missingFiles.length}개</h2>
              {files.length ? (
                <ul>
                  {files.map((f) => (
                    <li key={`${f.name}-${f.size}`}>{f.name} · 선택됨</li>
                  ))}
                </ul>
              ) : (
                <p className="fld__help">선택된 파일이 없습니다.</p>
              )}
              <button
                type="button"
                className="btxt"
                onClick={() => editSection(2)}
              >
                첨부 수정
              </button>
            </section>
            {checks.length > 0 && (
              <details className="request__details">
                <summary>보내기 전에 확인할 사항</summary>
                <ul>
                  {checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <p className="fld__help">
                  참고 안내입니다. 입력한 내용으로 요청할 수 있습니다.
                </p>
              </details>
            )}
            <section className="request__section request__fields">
              {WIZ[WIZ.length - 1].fields.map((f) => field(f))}
            </section>
          </>
        )}
      </fieldset>
      {missingFiles.length > 0 && (
        <section className="note note--warn request__missing">
          <b>다시 선택해야 하는 첨부파일</b>
          <p>
            파일 내용은 브라우저에 저장하지 않습니다. 같은 파일을 선택하거나
            요청에서 제외해 주세요.
          </p>
          {missingFiles.map((f) => (
            <div key={`${f.name}-${f.size}`}>
              <span>{f.name}</span>
              <button
                type="button"
                className="btxt"
                disabled={busy}
                onClick={() =>
                  setMissingFiles((old) => old.filter((x) => x !== f))
                }
              >
                제외
              </button>
            </div>
          ))}
          <label>
            파일 다시 선택
            <input
              type="file"
              multiple
              disabled={busy}
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                const matching = selected.filter((f) =>
                  missingFiles.some((m) => sameFile(f, m)),
                );
                setFiles((old) => [
                  ...old.filter((f) => !matching.some((m) => sameFile(f, m))),
                  ...matching,
                ]);
                setMissingFiles((old) =>
                  old.filter((m) => !matching.some((f) => sameFile(m, f))),
                );
                e.target.value = "";
              }}
            />
          </label>
        </section>
      )}
      {error && (
        <p className="note note--err" role="alert">
          {error}
        </p>
      )}
      <div className="request__footer">
        {step > 0 && !pendingNo && (
          <button className="b2" disabled={busy} onClick={() => go(step - 1)}>
            이전
          </button>
        )}
        {step < 3 ? (
          <button
            className="b1"
            disabled={busy}
            onClick={() => {
              if (editingReview) {
                setEditingReview(false);
                go(3);
              } else go(step + 1);
            }}
          >
            {editingReview ? "수정 완료" : `다음: ${STEPS[step + 1]}`}
          </button>
        ) : (
          <button
            className="b1"
            disabled={busy || !contactOk || preview}
            onClick={submit}
          >
            {preview
              ? "검토용 화면 · 제출 불가"
              : busy
                ? "접수·첨부 처리 중…"
                : pendingNo
                  ? "첨부파일 다시 올리기"
                  : "견적 요청 보내기"}
          </button>
        )}
      </div>
    </div>
  );
}
