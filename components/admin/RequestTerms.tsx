"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONFIDENTIALITY_OPTIONS, CRO_COUNT_OPTIONS } from "@/lib/request-policy";

/** 의뢰자가 고른 전달 기관 수·기밀 등급을 운영자가 바로잡는다 (의뢰자 요청이 있을 때) */
export function RequestTerms({ no, croCount, confidentiality }: { no: string; croCount: string | null; confidentiality: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(croCount ?? "3곳");
  const [conf, setConf] = useState(confidentiality ?? "일반");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, string> = {};
      if (count !== (croCount ?? "3곳")) body.croCount = count;
      if (conf !== (confidentiality ?? "일반")) body.confidentiality = conf;
      const r = await fetch(`/api/admin/rfqs/${no}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "저장하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "저장했습니다." });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "저장하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="btxt" style={{ padding: 0, fontSize: 13 }} onClick={() => setOpen(true)}>요청 조건 변경</button>
        {msg && <span style={{ fontSize: 12, color: msg.ok ? "var(--ok)" : "var(--err)" }} role="status">{msg.text}</span>}
      </span>
    );
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="grid2">
        <div className="fld">
          <label className="fld__lab" htmlFor="rt-count">전달 기관 수</label>
          <select id="rt-count" className="inp" value={count} onChange={(e) => setCount(e.target.value)}>
            {CRO_COUNT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor="rt-conf">기밀 등급</label>
          <select id="rt-conf" className="inp" value={conf} onChange={(e) => setConf(e.target.value)}>
            {CONFIDENTIALITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="b1 bsm" disabled={busy || (count === (croCount ?? "3곳") && conf === (confidentiality ?? "일반"))} onClick={save}>{busy ? "저장 중…" : "저장"}</button>
        <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>취소</button>
        {msg && <span style={{ fontSize: 12, color: msg.ok ? "var(--ok)" : "var(--err)" }} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}
