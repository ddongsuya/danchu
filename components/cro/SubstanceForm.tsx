"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUBSTANCE_LIMITS } from "@/lib/award-substance";

/** 선정 뒤 시험물질 필요량 (0027). 시험물질 정보를 받은 뒤 적고, 바뀌면 다시 저장한다 */
export function SubstanceForm({ awardId, qty, when, note, updatedAt }: { awardId: string; qty: string; when: string; note: string; updatedAt: string | null }) {
  const router = useRouter();
  const [v, setV] = useState({ qty, when, note });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = v.qty !== qty || v.when !== when || v.note !== note;
  const ok = !!v.qty.trim() && dirty;
  const set = (k: keyof typeof v, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => { setSaved(false); setV({ ...v, [k]: e.target.value.slice(0, max) }); };

  return (
    <form
      className="card card--pad stack"
      style={{ gap: 12, background: "var(--sf)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        setError("");
        try {
          const res = await fetch(`/api/awards/${awardId}/substance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(d.error || "저장하지 못했습니다.");
          setSaved(true);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <b style={{ fontSize: 14, fontWeight: 700 }}>시험물질 필요량</b>
        <small style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
          {updatedAt ? `의뢰자에게 안내했습니다 · ${new Date(updatedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}` : "시험물질 정보를 받은 뒤 적어 주세요. 저장하면 의뢰자에게 알림이 갑니다."}
        </small>
      </div>
      <div className="grid2">
        <div className="fld">
          <label className="fld__lab" htmlFor={`sq-${awardId}`}>필요량<span className="req">*</span></label>
          <input id={`sq-${awardId}`} className="inp" value={v.qty} onChange={set("qty", SUBSTANCE_LIMITS.qty)} placeholder="예: 원료 40 g + 예비 10 g" />
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor={`sw-${awardId}`}>보낼 시점</label>
          <input id={`sw-${awardId}`} className="inp" value={v.when} onChange={set("when", SUBSTANCE_LIMITS.when)} placeholder="예: 착수 2주 전까지" />
        </div>
      </div>
      <div className="fld">
        <label className="fld__lab" htmlFor={`sn-${awardId}`}>함께 알릴 것</label>
        <input id={`sn-${awardId}`} className="inp" style={{ height: 44 }} value={v.note} onChange={set("note", SUBSTANCE_LIMITS.note)} placeholder="예: 냉장 보관, 시험성적서(CoA) 함께 보내기" />
      </div>
      {error && <p className="note note--err" role="alert">{error}</p>}
      {saved && !dirty && <p className="note note--ok" role="status">저장했습니다. 의뢰자에게 알림을 보냈습니다.</p>}
      <button type="submit" className="b1" disabled={!ok || busy}>{busy ? "저장 중…" : updatedAt ? "고쳐서 다시 안내" : "의뢰자에게 안내"}</button>
    </form>
  );
}
