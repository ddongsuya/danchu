"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgClientRow } from "@/lib/data";

/**
 * 기존 고객 목록. 여기 적힌 회사가 단추를 통해 이 기관을 선정하면 성사수수료 면제 후보로 표시된다.
 * 목록은 이 기관에만 보인다. 대표 담당자만 고친다.
 */
export function OrgClients({ clients, isOwner }: { clients: OrgClientRow[]; isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", businessNo: "", lastContractOn: "" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const call = async (method: "POST" | "DELETE", body: unknown, key: string) => {
    if (busy) return;
    setBusy(key);
    setMsg(null);
    try {
      const r = await fetch("/api/cro/org/clients", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "처리하지 못했습니다.");
      if (method === "POST") { setF({ name: "", businessNo: "", lastContractOn: "" }); setOpen(false); }
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card card--pad">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>기존 고객 목록</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>이미 거래하던 의뢰자가 단추에서 우리 기관을 선정하면 성사수수료 면제 대상입니다. 회사명을 등록해 두면 선정 때 자동으로 표시되고, 운영자가 확인 뒤 면제를 확정합니다. 목록은 다른 기관이나 의뢰자에게 보이지 않습니다.</p>
      {clients.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>등록된 회사가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {clients.map((c) => (
            <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--track)", fontSize: 14 }}>
              <span>
                <b style={{ fontWeight: 600 }}>{c.name}</b>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{[c.business_no, c.last_contract_on ? `마지막 계약 ${c.last_contract_on}` : ""].filter(Boolean).join(" · ") || "상세 없음"}</span>
              </span>
              {isOwner && <button type="button" className="btxt" style={{ fontSize: 12, color: "var(--err)" }} disabled={!!busy} onClick={() => { if (window.confirm(`${c.name} 을 목록에서 뺄까요?`)) call("DELETE", { id: c.id }, c.id); }}>삭제</button>}
            </li>
          ))}
        </ul>
      )}
      {isOwner && !open && <button type="button" className="b2 bsm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>회사 추가</button>}
      {isOwner && open && (
        <form className="stack" style={{ gap: 10, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (f.name.trim().length >= 2) call("POST", f, "add"); }}>
          <div className="grid2">
            <div className="fld"><label className="fld__lab" htmlFor="cl-name">회사명<span className="req">*</span></label><input id="cl-name" className="inp" value={f.name} onChange={set("name")} placeholder="㈜바이오벤처" /></div>
            <div className="fld"><label className="fld__lab" htmlFor="cl-bizno">사업자등록번호</label><input id="cl-bizno" className="inp tnum" inputMode="numeric" value={f.businessNo} onChange={set("businessNo")} placeholder="000-00-00000" /></div>
            <div className="fld"><label className="fld__lab" htmlFor="cl-date">마지막 계약일</label><input id="cl-date" className="inp" type="date" value={f.lastContractOn} onChange={set("lastContractOn")} /><p className="fld__help">선정일 이전 24개월 안의 계약이어야 면제됩니다.</p></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="b1 bsm" disabled={busy === "add" || f.name.trim().length < 2}>{busy === "add" ? "추가 중…" : "추가"}</button>
            <button type="button" className="b2 bsm" disabled={!!busy} onClick={() => setOpen(false)}>취소</button>
          </div>
        </form>
      )}
      {!isOwner && <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>목록 수정은 대표 담당자가 합니다.</p>}
      {msg && <p className={`note ${msg.ok ? "note--tint" : "note--err"}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </div>
  );
}
