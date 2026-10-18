"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function DeclineForm({ token, backHref, afterHref }: { token: string; backHref: string; afterHref: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="card card--pad stack" style={{ gap: 14, maxWidth: 560 }}>
      <div className="fld">
        <label className="fld__lab" htmlFor="reason">사유 (선택)</label>
        <textarea id="reason" className="ta" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 해당 시험 항목 미수행, 일정 불가, 시설 점검 중" />
        <span className="fld__help">사유는 단추 운영자에게만 전달되며, 다음 배포 대상 선정에 참고합니다.</span>
      </div>
      {error && <p className="note note--err" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="b1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await fetch(`/api/quote/${token}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
              const d = (await res.json().catch(() => ({}))) as { error?: string };
              if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
              router.push(afterHref);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
              setBusy(false);
            }
          }}
        >
          {busy ? "처리 중…" : "회신하지 않음으로 처리"}
        </button>
        <Link href={backHref} className="b2">돌아가기</Link>
      </div>
    </div>
  );
}

/** "회신하지 않음"을 되돌린다. 회신 마감 전, 비교표가 열리기 전에만 보인다 */
export function UndoDecline({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="btxt"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch(`/api/quote/${token}/decline`, { method: "DELETE" });
            const d = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) throw new Error(d.error || "되돌리지 못했습니다.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "되돌리지 못했습니다.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "되돌리는 중…" : "되돌리고 회신하기"}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
