"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretDown, FileText, PaperPlaneRight, PencilSimple, X } from "@phosphor-icons/react";
import "./chat-request.css";

/**
 * 대화형 작업 화면의 틀 (상세 견적 요청, 2차 회신). 빠른 견적 요청(ChatRequest)과 같은 모양이다.
 * 한 번에 한 질문만 묻는다. 휴대폰은 한 화면(100dvh), PC는 오른쪽에 문서 미리보기.
 */

export type Said = { q: string; a: string; onEdit?: () => void };

export function ChatShell({
  title,
  closeHref,
  prog,
  said,
  q,
  hint,
  body,
  ans,
  doc,
  docLabel,
}: {
  title: string;
  closeHref: string;
  prog: number;
  said: Said[];
  q: string;
  hint?: string;
  body?: React.ReactNode;
  ans: React.ReactNode;
  doc: React.ReactNode;
  docLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const qRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    qRef.current?.focus({ preventScroll: true });
  }, [q]);
  const last = said[said.length - 1];
  const earlier = said.slice(0, -1);

  return (
    <div className="cr" role="dialog" aria-modal="true" aria-label={title}>
      <header className="cr-bar">
        <Link href={closeHref} className="cr-x" aria-label="닫기">
          <X size={20} />
        </Link>
        <b className="cr-title">{title}</b>
        <button type="button" className="cr-docbtn" onClick={() => setSheet(true)}>
          <FileText size={18} aria-hidden />
          {docLabel}
        </button>
      </header>
      <div className="cr-prog" aria-hidden>
        {[1, 2, 3, 4].map((n) => <i key={n} className={n <= prog ? "on" : ""} />)}
      </div>
      <div className="cr-main">
        <section className="cr-chat">
          <div className="cr-th">
            {earlier.length > 0 && (
              <div className="cr-foldwrap">
                <button type="button" className="cr-fold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  앞의 답 {earlier.length}개
                  <CaretDown size={14} aria-hidden />
                </button>
                {open && (
                  <ul className="cr-past">
                    {earlier.map((s) => (
                      <li key={s.q}>
                        <span>{s.q}</span>
                        {s.onEdit ? (
                          <button type="button" onClick={() => { setOpen(false); s.onEdit?.(); }}>
                            {s.a}
                            <PencilSimple size={14} aria-label="고치기" />
                          </button>
                        ) : (
                          <b>{s.a}</b>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {last &&
              (last.onEdit ? (
                <button type="button" className="cr-me" onClick={last.onEdit} aria-label={`${last.a}, 고치기`}>
                  {last.a}
                  <PencilSimple size={14} aria-hidden />
                </button>
              ) : (
                <span className="cr-me">{last.a}</span>
              ))}
            <p className="cr-q" tabIndex={-1} ref={qRef}>{q}</p>
            {hint && <p className="cr-hint">{hint}</p>}
            {body}
          </div>
          <div className="cr-ans">{ans}</div>
        </section>
        <aside className="cr-pv" aria-label={docLabel}>
          <p className="cr-pv__t">{docLabel}</p>
          <div className="cr-pv__paper">{doc}</div>
        </aside>
      </div>
      {sheet && (
        <div className="cr-sheet" role="dialog" aria-modal="true" aria-label={docLabel}>
          <button type="button" className="cr-dim" aria-label="닫기" onClick={() => setSheet(false)} />
          <div className="cr-sheet__in">
            <div className="cr-sheet__hd">
              <b>{docLabel}</b>
              <button type="button" onClick={() => setSheet(false)} aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="cr-sheet__bd">{doc}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 큰 답 버튼 */
export function Opt({ label, onClick, sm, pri, arrow, disabled }: { label: string; onClick: () => void; sm?: string; pri?: boolean; arrow?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`cr-o${pri ? " cr-o--pri" : ""}`} onClick={onClick} disabled={disabled}>
      {label}
      {sm && <small>{sm}</small>}
      {arrow && <ArrowRight size={20} className="cr-end" />}
    </button>
  );
}

/** 직접 적는 답. 보내면 칸을 비운다 */
export function Composer({ placeholder, label, onSend, big, inputMode, initial = "" }: { placeholder: string; label: string; onSend: (v: string) => void; big?: boolean; inputMode?: "numeric" | "text"; initial?: string }) {
  const [text, setText] = useState(initial);
  return (
    <form
      className={`cr-comp${big ? "" : " cr-comp--sm"}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text.trim());
        setText("");
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label} inputMode={inputMode} />
      <button type="submit" aria-label="보내기" disabled={!text.trim()}>
        <PaperPlaneRight size={big ? 20 : 18} />
      </button>
    </form>
  );
}
