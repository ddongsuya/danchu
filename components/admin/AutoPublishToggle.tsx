"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 요청별 비교표 자동 공개 스위치. 켜 두면 회신 기한 다음 날 cron 이 공개하고 아직 내지 않은 기관의 회신을 닫는다.
 * 운영자가 기관 PDF 를 모아 대신 입력하는 요청은 꺼 두고, 다 모은 뒤 직접 공개한다.
 */
export function AutoPublishToggle({ no, on: initial, disabled }: { no: string; on: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setOn(next);
    try {
      const r = await fetch(`/api/admin/rfqs/${no}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autoPublish: next }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "저장하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "저장했습니다." });
      router.refresh();
    } catch (e) {
      setOn(!next);
      setMsg({ ok: false, text: e instanceof Error ? e.message : "저장하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
        <input type="checkbox" checked={on} disabled={busy || disabled} onChange={(e) => change(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "var(--brand)" }} />
        <span>
          기한 뒤 비교표 자동 공개
          <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
            켜 두면 회신 기한 다음 날 아침에 비교표를 공개하고 아직 내지 않은 기관의 회신을 닫습니다. 기관 PDF를 모아 대신 입력하는 요청은 끄고, 다 모은 뒤 &ldquo;비교표 공개&rdquo;를 눌러 주세요.
          </span>
        </span>
      </label>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status" style={{ fontSize: 13 }}>{msg.text}</p>}
    </div>
  );
}
