"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 청구 월 마감 버튼. 마감하면 그 달 명세를 저장본으로 고정하고 청구 제외 토글을 막는다.
 * 마감한 달은 다시 열 수 없다 (2026-10-20 결정, 0024). 그래서 해제 버튼이 없고, 끝나지 않은 달(이번 달·다음 달 이후)은 마감하지 않는다.
 * 마감한 달이면 아무것도 그리지 않는다 (화면 위 안내가 대신한다)
 */
export function BillingClose({ month, closed, ended }: { month: string; closed: boolean; ended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [arm, setArm] = useState(false);
  const [err, setErr] = useState("");
  if (closed) return null;
  if (!ended) return <span className="billclose__hint">이 달이 끝난 뒤 마감할 수 있습니다</span>;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/billing/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, closed: true }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErr(d.error || "마감하지 못했습니다."); return; }
      setArm(false);
      router.refresh();
    } catch {
      setErr("연결이 끊겨 마감하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (!arm) {
    return (
      <span className="billclose">
        <button type="button" className="b1" onClick={() => setArm(true)}>이 달 청구 마감</button>
        {err && <span role="alert" className="billclose__err">{err}</span>}
      </span>
    );
  }
  return (
    <span className="billclose billclose--arm">
      <span>마감하면 지금 명세를 저장해 고정합니다. 마감한 달은 다시 열 수 없습니다.</span>
      <button type="button" className="b1 bsm" disabled={busy} aria-busy={busy || undefined} onClick={go}>{busy ? "마감하는 중" : "마감"}</button>
      <button type="button" className="b2 bsm" disabled={busy} onClick={() => setArm(false)}>취소</button>
      {err && <span role="alert" className="billclose__err">{err}</span>}
    </span>
  );
}
