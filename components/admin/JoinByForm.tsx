"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 참여 결정 기한 연장 (0023). 요청마다 한 번만 늘릴 수 있다. 새 기한은 지금 기한보다 늦고 회신 기한을 넘지 않는다.
 * 늘린 뒤에는 연장 버튼 대신 "1회 연장함"만 보인다
 */
export function JoinByForm({ no, current, min, max, extended }: { no: string; current: string; min: string; max: string | null; extended: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 지금 기한 다음 날부터 고를 수 있다 (오늘보다 이르면 오늘부터)
  const nextDay = new Date(Date.parse(`${current}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const floor = nextDay >= min ? nextDay : min;
  const [joinBy, setJoinBy] = useState(floor);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const invalid = !joinBy || joinBy <= current || joinBy < min || (!!max && joinBy > max);

  const save = async () => {
    if (busy || invalid) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/rfqs/${no}/deadline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinBy }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "늘리지 못했습니다.");
      setMsg({ ok: true, text: d.message || "늘렸습니다." });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "늘리지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  if (extended) return <span className="pill pill--sf">참여 결정 기한 1회 연장함</span>;
  if (!open) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="btxt" style={{ padding: 0, fontSize: 13 }} disabled={!!max && max <= current} onClick={() => setOpen(true)} title={max && max <= current ? "회신 기한이 참여 결정 기한과 같아 더 늘릴 수 없습니다. 회신 기한을 먼저 늘려 주세요." : "요청마다 한 번만 늘릴 수 있습니다."}>
          참여 결정 기한 늘리기 (1회)
        </button>
        {msg && <span role="status" style={{ fontSize: 12, color: msg.ok ? "var(--ok)" : "var(--err)" }}>{msg.text}</span>}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input className="inp" type="date" min={floor} max={max ?? undefined} value={joinBy} onChange={(e) => setJoinBy(e.target.value)} style={{ height: 32, fontSize: 13 }} aria-label="새 참여 결정 기한" aria-invalid={invalid || undefined} />
      <button type="button" className="b1 bsm" disabled={busy || invalid} onClick={save}>{busy ? "늘리는 중…" : "늘리기"}</button>
      <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>취소</button>
      {msg && !msg.ok && <span role="alert" style={{ fontSize: 12, color: "var(--err)" }}>{msg.text}</span>}
      {!msg && <span style={{ fontSize: 12, color: "var(--muted)" }}>한 번만 늘릴 수 있습니다{max ? ` · 회신 기한 ${max}까지` : ""}</span>}
    </span>
  );
}
