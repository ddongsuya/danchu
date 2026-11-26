"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { TOAST_LEAVE_MS, toastDuration, toastReducer, type ToastAction, type ToastItem, type ToastTone } from "./toast-queue";

export type ToastOptions = { tone?: ToastTone; action?: ToastAction; undo?: () => void };
export type ShowToast = (message: string, opts?: ToastOptions) => void;

const ToastCtx = createContext<ShowToast | null>(null);

/**
 * 결과 알림 (시안 v7). 화면 아래 가운데에 뜨고, 결과는 2.4초 · 실행 취소나 실패는 5초 뒤 사라진다.
 * 마우스나 키보드 포커스가 토스트 위에 있으면 시간이 멈춘다. 결과는 status, 실패는 alert 로 읽힌다.
 * 포털 셸(Shell·GuestShell·/q)에 한 번만 둔다. 화면에서는 useToast() 로 부른다.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, dispatch] = useReducer(toastReducer, []);
  const [paused, setPaused] = useState(false);
  const seq = useRef(0);

  const show = useCallback<ShowToast>((message, opts = {}) => {
    const action = opts.action ?? (opts.undo ? { label: "실행 취소", onClick: opts.undo } : undefined);
    dispatch({ type: "add", toast: { id: ++seq.current, message, tone: opts.tone ?? "status", action } });
  }, []);

  const dismiss = useCallback((id: number) => {
    dispatch({ type: "leave", id });
    window.setTimeout(() => dispatch({ type: "remove", id }), TOAST_LEAVE_MS);
  }, []);

  const region = (tone: ToastTone) => list.filter((t) => t.tone === tone).map((t) => <ToastRow key={t.id} toast={t} paused={paused} onDismiss={dismiss} />);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        className="ix-toasts"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
      >
        {/* 읽기 영역은 처음부터 있어야 화면 읽기 프로그램이 새 알림을 읽는다 */}
        <div role="status" aria-live="polite" className="ix-toasts__region">{region("status")}</div>
        <div role="alert" aria-live="assertive" className="ix-toasts__region">{region("error")}</div>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastRow({ toast, paused, onDismiss }: { toast: ToastItem; paused: boolean; onDismiss: (id: number) => void }) {
  const left = useRef(toastDuration(toast));
  useEffect(() => {
    if (paused || toast.leaving) return;
    const start = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), left.current);
    return () => { window.clearTimeout(timer); left.current = Math.max(0, left.current - (Date.now() - start)); };
  }, [paused, toast.leaving, toast.id, onDismiss]);

  return (
    <div className="ix-toast" data-tone={toast.tone} data-leaving={toast.leaving ? "" : undefined}>
      <span className="ix-toast__msg">{toast.message}</span>
      {toast.action && (
        <button type="button" className="ix-toast__act" onClick={() => { toast.action?.onClick(); onDismiss(toast.id); }}>{toast.action.label}</button>
      )}
      <button type="button" className="ix-toast__x" aria-label="알림 닫기" onClick={() => onDismiss(toast.id)}><X size={16} aria-hidden="true" /></button>
    </div>
  );
}

/** 포털 화면에서 결과·실패 알림을 띄운다. ToastProvider 밖에서 부르면 바로 알 수 있게 오류를 낸다 */
export function useToast(): ShowToast {
  const show = useContext(ToastCtx);
  if (!show) throw new Error("useToast: ToastProvider 안에서만 쓸 수 있습니다 (components/ui/UiProvider).");
  return show;
}
