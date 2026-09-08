"use client";

import { useState } from "react";

/** 인증 화면 공통 조각 — 입력, 비밀번호(보기 토글), 오류, 완료 표시 */

export function Field({ id, label, required, children, help }: { id: string; label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__req">*</span>}
      </label>
      {children}
      {help && <p className="field__help">{help}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function PasswordInput({ id, value, onChange, placeholder, autoComplete = "new-password" }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        className="input"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "8자 이상"}
        autoComplete={autoComplete}
        style={{ paddingRight: 64 }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
        style={{ position: "absolute", right: 8, top: 0, height: "100%", border: 0, background: "none", color: "var(--muted)", fontSize: 13, padding: "0 8px" }}
      >
        {show ? "숨기기" : "보기"}
      </button>
    </div>
  );
}

export function ErrorBox({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="error" role="alert">
      {children}
    </p>
  );
}

export function Done({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth__ok">
      <svg width="48" height="48" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="20" fill="var(--brand)" />
        <path d="M14 22.5l5.5 5.5L30 17" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="auth__title" style={{ fontSize: 22 }}>{title}</h1>
      {children}
    </div>
  );
}

/** 공통 fetch: JSON 요청 → { ok, data } 또는 오류 문구 throw */
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  return data;
}
