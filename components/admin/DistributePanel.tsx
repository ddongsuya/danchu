"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string; categories: string[]; glp: string[]; email: string | null; members: number; invited: boolean };

/** 배포 — 승인된 CRO 중 수행 분야가 맞는 기관을 골라 초대(회신 링크 메일)를 보낸다 */
export function DistributePanel({ no, categories, defaultReplyBy, orgs }: { no: string; categories: string[]; defaultReplyBy: string; orgs: Org[] }) {
  const router = useRouter();
  const match = (o: Org) => o.categories.some((c) => categories.includes(c));
  const [picked, setPicked] = useState<string[]>(orgs.filter((o) => !o.invited && match(o)).map((o) => o.id));
  const [replyBy, setReplyBy] = useState(defaultReplyBy);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const shown = orgs.filter((o) => showAll || match(o) || o.invited);

  const send = async () => {
    if (!picked.length || !replyBy || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/rfqs/${no}/distribute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgIds: picked, replyBy }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; mailed?: number };
      if (!res.ok) throw new Error(d.error || "배포하지 못했습니다.");
      setMsg({ ok: true, text: `${d.sent}곳에 배포했습니다 (메일 ${d.mailed}건).` });
      setPicked([]);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "배포하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {orgs.length === 0 && <p className="note note--warn">승인된 CRO 기관이 없습니다. CRO 기관 탭에서 가입 신청을 승인하세요.</p>}
      <div className="stack" style={{ gap: 6 }}>
        {shown.map((o) => {
          const on = picked.includes(o.id);
          const ok = match(o);
          return (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: `1px solid ${on ? "var(--brand)" : "var(--cline)"}`, background: on ? "var(--tint)" : "var(--wh)", borderRadius: 10, cursor: o.invited ? "default" : "pointer", opacity: o.invited ? 0.6 : 1 }}>
              <input type="checkbox" checked={on} disabled={o.invited} onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id))} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {o.name} {o.invited && <span className="pill pill--sf">배포됨</span>}{!ok && <span className="pill pill--warn">분야 불일치</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{o.glp.join(" · ") || "GLP 미등록"} · 담당자 {o.members}명{o.email ? ` · ${o.email}` : ""}</div>
              </div>
            </label>
          );
        })}
      </div>
      {orgs.some((o) => !match(o) && !o.invited) && (
        <button type="button" className="btxt" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setShowAll(!showAll)}>{showAll ? "분야가 맞는 기관만 보기" : "분야가 다른 기관도 보기"}</button>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="fld" style={{ flex: "1 1 160px" }}>
          <label className="fld__lab" htmlFor="replyBy">회신 기한</label>
          <input id="replyBy" className="inp" type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
        </div>
        <button type="button" className="b1" disabled={!picked.length || !replyBy || busy} onClick={send}>{busy ? "배포 중…" : `${picked.length}곳에 배포`}</button>
      </div>
      <p className="fld__help">회신 링크는 기한 +7일까지 열립니다. 기관 대표 이메일과 담당자 계정 모두에 메일이 갑니다.</p>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
    </div>
  );
}
