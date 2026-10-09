"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ymd } from "@/lib/format";

type M = { id: string; name: string | null; email: string; phone: string | null; created_at: string; org_role?: string };

/**
 * 기관 담당자 목록. 대표 담당자(owner)에게만 합류 승인·거절과 내보내기 버튼이 보인다.
 * 내보내기는 두 번 눌러야 실행된다.
 */
export function OrgMembers({ members, pending, isOwner, selfId }: { members: M[]; pending: M[]; isOwner: boolean; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [arm, setArm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (userId: string, action: "approve" | "reject" | "remove") => {
    if (busy) return;
    setBusy(userId);
    setMsg(null);
    try {
      const r = await fetch("/api/cro/org/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "처리했습니다." });
      setArm("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card card--rows">
      {isOwner && pending.length > 0 && (
        <>
          <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>합류 신청 {pending.length}</div>
          {pending.map((m) => (
            <div key={m.id} className="kv" style={{ alignItems: "center" }}>
              <span>
                <b style={{ fontWeight: 600 }}>{m.name || "-"}</b>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.email}{m.phone ? ` · ${m.phone}` : ""} · 신청 {ymd(m.created_at)}</span>
              </span>
              <span style={{ display: "inline-flex", gap: 6 }}>
                <button type="button" className="b1 bsm" disabled={!!busy} onClick={() => act(m.id, "approve")}>연결</button>
                <button type="button" className="b2 bsm" disabled={!!busy} onClick={() => act(m.id, "reject")}>거절</button>
              </span>
            </div>
          ))}
        </>
      )}
      <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>담당자 {members.length}</div>
      {members.map((m) => (
        <div key={m.id} className="kv" style={{ alignItems: "center" }}>
          <span>
            <b style={{ fontWeight: 600 }}>{m.name || "-"}</b>
            {m.org_role === "owner" && <span className="pill pill--tint" style={{ marginLeft: 6 }}>대표</span>}
            {m.id === selfId && <span className="pill pill--sf" style={{ marginLeft: 6 }}>나</span>}
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.email}{m.phone ? ` · ${m.phone}` : ""}</span>
          </span>
          {isOwner && m.id !== selfId && m.org_role !== "owner" ? (
            arm === m.id ? (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                <span>내보내면 이 기관의 열린 회신 링크가 새로 발급됩니다.</span>
                <button type="button" className="b2 b2--danger bsm" disabled={!!busy} onClick={() => act(m.id, "remove")}>{busy === m.id ? "…" : "내보내기 확정"}</button>
                <button type="button" className="b2 bsm" disabled={!!busy} onClick={() => setArm("")}>취소</button>
              </span>
            ) : (
              <button type="button" className="btxt" style={{ fontSize: 12 }} onClick={() => setArm(m.id)}>내보내기</button>
            )
          ) : (
            <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{ymd(m.created_at)}</span>
          )}
        </div>
      ))}
      <div style={{ padding: "10px 0 12px", fontSize: 13, color: "var(--muted)" }}>
        {isOwner ? "담당자 추가는 같은 기관명으로 CRO 가입 신청을 하면 여기에 합류 신청으로 보입니다." : "기관 정보 수정과 담당자 관리는 대표 담당자가 합니다."}
      </div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status" style={{ marginBottom: 12 }}>{msg.text}</p>}
    </div>
  );
}
