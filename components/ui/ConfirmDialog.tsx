"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  /** 공손한 질문 한 줄. 예: "이 견적서를 삭제하시겠습니까?" */
  title: string;
  /** 무엇이 바뀌는지, 되돌릴 수 있는지 */
  body?: React.ReactNode;
  /** 동작 이름. 예: "삭제", "승인". 기본 "확인" */
  confirmLabel?: string;
  cancelLabel?: string;
  /** 지우기·취소처럼 되돌리기 어려운 동작. 버튼이 위험 모양이 되고 처음 포커스는 "취소"에 간다 */
  danger?: boolean;
  /**
   * 확인을 누르면 창 안에서 실행할 일 (시안 검토판: 처리 중 · 창 안 실패 · 다시).
   * 실행 중에는 버튼과 Esc·바깥 누르기를 잠그고, 실패하면 창을 닫지 않고 오류 문구와 "다시 …" 버튼을 보여 준다.
   * 던진 Error 의 message 를 그대로 보여 주므로 화면에 맞는 문장으로 던진다.
   */
  action?: () => Promise<void>;
  /** 실행 중 버튼 글자. 예: "선정하는 중" */
  pendingLabel?: string;
};

type Props = ConfirmOptions & { open: boolean; onResult: (ok: boolean) => void };

// 키보드로 연 창은 움직이지 않는다 (CLAUDE.md 4절). 마지막 입력이 키였는지 기억한다
let lastInputKeyboard = false;
let listening = false;
function trackInput() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("keydown", () => { lastInputKeyboard = true; }, true);
  window.addEventListener("pointerdown", () => { lastInputKeyboard = false; }, true);
}

/**
 * 확인 창 (시안 v7). 네이티브 dialog 의 showModal 로 포커스를 창 안에 가두고, Esc·바깥 누르기·취소는 모두 "아니요"다.
 * 닫히면 브라우저가 연 버튼으로 포커스를 돌려준다. 넓은 화면은 가운데 창(0.24초), 휴대폰은 아래 시트(0.28초).
 * 보통은 useConfirm() 으로 쓰고, 직접 상태를 들고 싶을 때만 이 컴포넌트를 쓴다.
 */
export function ConfirmDialog({ open, title, body, confirmLabel = "확인", cancelLabel = "취소", danger = false, action, pendingLabel, onResult }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(trackInput, []);
  // 실행 중에는 닫히지 않는다. 결과는 실행이 끝난 뒤에만 정한다
  const answer = (ok: boolean) => {
    if (busy) return;
    if (!ok || !action) { onResult(ok); return; }
    setBusy(true);
    setErr(null);
    action().then(
      () => { setBusy(false); onResult(true); },
      (e: unknown) => { setBusy(false); setErr(e instanceof Error && e.message ? e.message : "처리하지 못했어요. 다시 시도해 주세요."); },
    );
  };
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setErr(null);
      setBusy(false);
      d.toggleAttribute("data-instant", lastInputKeyboard);
      d.returnValue = "";
      d.showModal();
      // 위험한 동작은 "취소"에, 나머지는 동작 버튼에 처음 포커스
      d.querySelector<HTMLButtonElement>(danger ? 'button[value="cancel"]' : 'button[value="ok"]')?.focus();
    } else if (!open && d.open) d.close();
  }, [open, danger]);

  return (
    <dialog
      ref={ref}
      className="ix-dialog"
      aria-labelledby="ix-dialog-title"
      // 결과는 누른 버튼·Esc·바깥 누르기에서 바로 정한다. close 이벤트는 브라우저에 따라 늦게 오거나 오지 않아 보조로만 쓴다
      onCancel={(e) => { e.preventDefault(); answer(false); }}
      onClose={(e) => { if (open && !busy) onResult(e.currentTarget.returnValue === "ok" && !action); }}
      onClick={(e) => { if (e.target === e.currentTarget) answer(false); }}
      aria-busy={busy || undefined}
    >
      <form
        method="dialog"
        className="ix-dialog__in"
        onSubmit={(e) => { e.preventDefault(); answer((e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "ok"); }}
      >
        <h2 id="ix-dialog-title" className="ix-dialog__title">{title}</h2>
        {body && <div className="ix-dialog__body">{body}</div>}
        {err && <p className="ix-dialog__err" role="alert">{err}</p>}
        <div className="ix-dialog__acts">
          <button type="submit" value="cancel" className="b2" disabled={busy}>{cancelLabel}</button>
          <button type="submit" value="ok" className={danger ? "b1 b1--danger" : "b1"} disabled={busy} aria-busy={busy || undefined}>
            {busy ? (pendingLabel ?? confirmLabel) : err ? `다시 ${confirmLabel}` : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<Confirm | null>(null);

/** 확인 창 하나를 셸에 두고, 화면에서는 `if (!(await confirm({...}))) return;` 으로 쓴다 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; open: boolean }>({ opts: { title: "" }, open: false });
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((opts) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // 이미 떠 있던 질문은 "아니요"로 끝낸다
    resolver.current = resolve;
    setState({ opts, open: true });
  }), []);

  const onResult = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <ConfirmDialog {...state.opts} open={state.open} onResult={onResult} />
    </ConfirmCtx.Provider>
  );
}

/** ConfirmProvider 가 없는 화면(셸 밖 미리보기 등)에서는 브라우저 확인 창으로 대신한다 */
export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmCtx);
  return ctx ?? (async (o) => window.confirm(o.body && typeof o.body === "string" ? `${o.title}\n\n${o.body}` : o.title));
}
