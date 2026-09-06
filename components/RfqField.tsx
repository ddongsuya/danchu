"use client";

import { useEffect, useRef, useState } from "react";
import type { Field, Values } from "@/lib/rfq-schema";
import { Chevron } from "./Chevron";

const MAX_FILE_MB = 20;

export interface FieldOpts {
  /** 위자드 화면: 라벨 숨김 + 선택형을 큰 옵션 카드로 */
  big?: boolean;
  autoFocus?: boolean;
  /** blur 시 호출 (담당자 정보 순차 노출용) */
  onCommit?: () => void;
  /** Enter 시 호출 */
  onEnter?: () => void;
}

interface Props extends FieldOpts {
  field: Field;
  /** 값 키 (세부 조건은 `${카테고리}.${id}`) */
  id: string;
  values: Values;
  onChange: (id: string, v: string | string[] | boolean) => void;
  files?: File[];
  onFiles?: (files: File[]) => void;
}

export function RfqField({
  field,
  id,
  values,
  onChange,
  files = [],
  onFiles,
  big = false,
  autoFocus = false,
  onCommit,
  onEnter,
}: Props) {
  const v = values[id];
  const str = typeof v === "string" ? v : "";
  const arr = Array.isArray(v) ? v : [];
  const multi = field.type === "chips";
  /** 위자드에서는 선택형을 목록형 큰 카드로 그린다 */
  const asList = big && ["radio", "segmented", "select", "chips"].includes(field.type);

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.currentTarget.tagName !== "TEXTAREA") {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
      onEnter?.();
    }
  };

  if (field.type === "checkbox") {
    const on = v === true;
    return (
      <label className={`chk${on ? " chk--on" : ""}`}>
        <input type="checkbox" name={id} checked={on} onChange={(e) => onChange(id, e.target.checked)} />
        <span>
          <LabelWithLink label={field.label || ""} link={field.link} />
          {field.required && <span className="field__req">*</span>}
        </span>
      </label>
    );
  }

  return (
    <div className="field">
      {!big && field.label && (
        <label className="field__label" htmlFor={id}>
          {field.label}
          {field.required && <span className="field__req">*</span>}
        </label>
      )}

      {(field.type === "text" || field.type === "email" || field.type === "tel" || field.type === "date") && (
        <input
          id={id}
          name={id}
          type={field.type}
          className={`input${big ? " input--big" : ""}`}
          value={str}
          placeholder={field.placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(id, e.target.value)}
          onBlur={() => onCommit?.()}
          onKeyDown={keyDown}
          autoComplete={field.type === "email" ? "email" : field.type === "tel" ? "tel" : undefined}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          id={id}
          name={id}
          className={`textarea${big ? " textarea--big" : ""}`}
          rows={5}
          value={str}
          placeholder={field.placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(id, e.target.value)}
        />
      )}

      {field.type === "select" && !asList && (
        <div className="select-wrap">
          <select
            id={id}
            name={id}
            className={`select${big ? " select--big" : ""}`}
            value={str}
            onChange={(e) => onChange(id, e.target.value)}
          >
            <option value="">선택</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Chevron size={16} className="" />
        </div>
      )}

      {/* 위자드: 큰 옵션 카드 */}
      {asList && (
        <div className="opts" role="group" aria-label={field.label || undefined}>
          {field.options?.map((o) => {
            const on = multi ? arr.includes(o) : str === o;
            return (
              <button
                key={o}
                type="button"
                className="opt"
                aria-pressed={on}
                onClick={() => onChange(id, multi ? (on ? arr.filter((x) => x !== o) : [...arr, o]) : o)}
              >
                <span>{o}</span>
                <svg className="opt__check" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="11" fill="var(--brand)" />
                  <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {field.type === "radio" && !asList && (
        <div className="radios" role="radiogroup" aria-label={field.label || undefined}>
          {field.options?.map((o) => (
            <label key={o}>
              <input type="radio" name={id} value={o} checked={str === o} onChange={() => onChange(id, o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === "segmented" && !asList && (
        <div className="segmented" role="group" aria-label={field.label || undefined}>
          {field.options?.map((o) => (
            <button key={o} type="button" aria-pressed={str === o} onClick={() => onChange(id, o)}>
              {o}
            </button>
          ))}
        </div>
      )}

      {field.type === "chips" && !asList && (
        <div className="chipset" role="group" aria-label={field.label || undefined}>
          {field.options?.map((o) => {
            const on = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() => onChange(id, on ? arr.filter((x) => x !== o) : [...arr, o])}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      {field.type === "file" && <FileDrop id={id} placeholder={field.placeholder} files={files} onFiles={onFiles} />}

      {field.help && <p className="field__help">{field.help}</p>}
    </div>
  );
}

/** 라벨 안의 특정 문구만 새 탭 링크로 (동의 항목의 약관·처리방침) */
function LabelWithLink({ label, link }: { label: string; link?: Field["link"] }) {
  if (!link) return <>{label}</>;
  const i = label.indexOf(link.text);
  if (i === -1) return <>{label}</>;
  return (
    <>
      {label.slice(0, i)}
      <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {link.text}
      </a>
      {label.slice(i + link.text.length)}
    </>
  );
}

function FileDrop({
  id,
  placeholder,
  files,
  onFiles,
}: {
  id: string;
  placeholder?: string;
  files: File[];
  onFiles?: (files: File[]) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [warn, setWarn] = useState("");

  const add = (list: FileList | null) => {
    if (!list || !onFiles) return;
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    setWarn(tooBig.length ? `${MAX_FILE_MB}MB를 넘는 파일은 제외했습니다: ${tooBig.map((f) => f.name).join(", ")}` : "");
    const ok = incoming.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024);
    const merged = [...files, ...ok].filter(
      (f, i, a) => a.findIndex((x) => x.name === f.name && x.size === f.size) === i
    );
    onFiles(merged);
  };

  return (
    <>
      <label
        className={`file${drag ? " drag" : ""}`}
        htmlFor={`${id}-input`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6F6E6B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V5M7 10l5-5 5 5" />
          <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
        <span className="file__main">파일 선택 또는 여기로 끌어오기</span>
        <span className="file__sub">{placeholder}</span>
        <input
          id={`${id}-input`}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.hwp"
          style={{ display: "none" }}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {warn && <p className="field__help" style={{ color: "var(--error-fg)" }}>{warn}</p>}
      {files.length > 0 && (
        <ul className="file__list">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`}>
              <span>
                {f.name} · {(f.size / 1024 / 1024).toFixed(1)}MB
              </span>
              <button type="button" aria-label={`${f.name} 제거`} onClick={() => onFiles?.(files.filter((x) => x !== f))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
