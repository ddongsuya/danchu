"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * 불참(참여 전)과 참여 철회(참여 뒤, 제출 전) 확인 폼 (0023). 사유는 선택이고 단추 운영자에게만 전달된다.
 * 화면이 본 상태(mode)를 함께 보낸다. 그 사이 상태가 바뀌었으면 라우트가 409 로 다시 보게 한다.
 */
const COPY = {
  decline: {
    help: "사유는 단추 운영자에게만 전달됩니다. 불참해도 다음 참여 안내에 영향이 없습니다.",
    placeholder: "예: 해당 시험 항목 미수행, 일정 불가, 시설 점검 중",
    submit: "불참으로 처리",
    operatorSubmit: "기관이 알린 불참 기록",
  },
  withdraw: {
    help: "제출 전에는 언제든 철회할 수 있고, 철회하면 청구하지 않습니다. 작성 중이던 내용은 의뢰자에게 보이지 않습니다. 사유는 단추 운영자에게만 전달됩니다.",
    placeholder: "예: 일정 조정이 어려움, 요청 조건 확인 결과 수행 불가",
    submit: "참여 철회",
    operatorSubmit: "기관이 알린 철회 기록",
  },
} as const;

export function DeclineForm({ token, mode, backHref, onCancel, afterHref, operator = false }: { token: string; mode: "decline" | "withdraw"; backHref?: string; onCancel?: () => void; afterHref: string; operator?: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const c = COPY[mode];
  const id = `reason-${mode}`;
  return (
    <div className="card card--pad stack" style={{ gap: 14, maxWidth: 560 }}>
      <div className="fld">
        <label className="fld__lab" htmlFor={id}>사유 (선택)</label>
        <textarea id={id} className="ta" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={c.placeholder} aria-describedby={`${id}-help`} />
        <span id={`${id}-help`} className="fld__help">{c.help}</span>
      </div>
      {error && <p className="note note--err" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="b1"
          disabled={busy}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await fetch(`/api/quote/${token}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, mode }) });
              const d = (await res.json().catch(() => ({}))) as { error?: string };
              if (!res.ok) throw new Error(d.error || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
              router.push(afterHref);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
              setBusy(false);
            }
          }}
        >
          {busy ? "처리 중…" : operator ? c.operatorSubmit : c.submit}
        </button>
        {onCancel ? (
          <button type="button" className="b2" onClick={onCancel} disabled={busy}>돌아가기</button>
        ) : backHref ? (
          <Link href={backHref} className="b2">돌아가기</Link>
        ) : null}
      </div>
    </div>
  );
}
