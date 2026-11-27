"use client";

import { useState } from "react";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  /** 밖에서 처리 중을 알려 줄 때. 없으면 onClick 이 돌려준 Promise 가 끝날 때까지 처리 중이다 */
  pending?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
};

/**
 * 처리 중 상태를 가진 버튼 (시안 v7). 처리 중에는 글자 대신 진행 표시가 돌고 너비는 그대로이며, 다시 눌러도 한 번만 처리된다.
 * 모양은 기존 클래스(b1·b2·bsm·btxt)를 그대로 넘긴다. 예: <Button className="b1" onClick={save}>저장</Button>
 */
export function Button({ pending, onClick, className, type = "button", children, ...rest }: Props) {
  const [running, setRunning] = useState(false);
  const busy = pending || running;
  return (
    <button
      {...rest}
      type={type}
      className={busy ? `${className ?? ""} is-loading` : className}
      aria-busy={busy || undefined}
      aria-disabled={busy || rest["aria-disabled"] || undefined}
      onClick={(e) => {
        if (busy) { e.preventDefault(); return; }
        const r = onClick?.(e);
        if (r instanceof Promise) {
          setRunning(true);
          const done = () => setRunning(false);
          r.then(done, done); // 실패 처리는 onClick 쪽 몫. 여기서는 처리 중만 끝낸다
        }
      }}
    >
      {children}
    </button>
  );
}
