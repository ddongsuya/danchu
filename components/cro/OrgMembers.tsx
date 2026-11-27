"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ymd } from "@/lib/format";
import { withObj } from "@/lib/cro-due";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type M = { id: string; name: string | null; email: string; phone: string | null; created_at: string; org_role?: string };

/**
 * 기관 담당자 목록. 대표 담당자(owner)에게만 합류 승인·거절과 내보내기 버튼이 보인다.
 * 내보내기와 거절은 확인 창에서 처리한다 (창 안에서 처리 중 · 실패).
 */
export function OrgMembers({ members, pending, isOwner, selfId }: { members: M[]; pending: M[]; isOwner: boolean; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const confirm = useConfirm();

  const post = async (userId: string, action: "approve" | "reject" | "remove") => {
    const r = await fetch("/api/cro/org/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action }) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string; message?: string } | undefined;
    return { ok: !!r?.ok, error: d?.error, message: d?.message };
  };
  const approve = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    setMsg(null);
    const r = await post(userId, "approve");
    setBusy("");
    setMsg(r.ok ? { ok: true, text: r.message || "연결했어요." } : { ok: false, text: r.error || "연결하지 못했어요." });
    if (r.ok) router.refresh();
  };
  // 내보내기 · 연결 거절은 되돌리기 어려워 확인 창에서 처리한다 (시안 검토판 c-set-members~out · c-set-members-req~rej)
  const remove = async (m: M) => {
    const ok = await confirm({
      title: `${withObj(m.name || m.email)} 내보낼까요?`,
      body: `내보내면 ${m.email} 계정은 이 기관의 요청과 견적서를 볼 수 없습니다.`,
      confirmLabel: "내보내기 확정",
      pendingLabel: "내보내는 중",
      retryLabel: "다시 내보내기",
      danger: true,
      action: async () => { if (!(await post(m.id, "remove")).ok) throw new Error("구성원을 내보내지 못했어요. 구성원은 그대로예요."); },
    });
    if (ok) router.refresh();
  };
  const reject = async (m: M) => {
    const ok = await confirm({
      title: "연결 요청을 거절할까요?",
      body: `거절하면 ${m.email}에 거절 결과를 알립니다.`,
      confirmLabel: "거절",
      pendingLabel: "거절하는 중",
      retryLabel: "다시 거절",
      danger: true,
      action: async () => { if (!(await post(m.id, "reject")).ok) throw new Error("연결 요청을 거절하지 못했어요. 요청은 그대로예요."); },
    });
    if (ok) router.refresh();
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
                <button type="button" className="b2 bsm" disabled={!!busy} onClick={() => reject(m)}>거절</button>
                <button type="button" className="b1 bsm" disabled={!!busy} onClick={() => approve(m.id)}>{busy === m.id ? "연결하는 중" : "연결"}</button>
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
            <button type="button" className="btxt" style={{ fontSize: 12 }} onClick={() => remove(m)}>내보내기</button>
          ) : (
            <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{ymd(m.created_at)}</span>
          )}
        </div>
      ))}
      <div style={{ padding: "10px 0 12px", fontSize: 13, color: "var(--muted)" }}>
        {isOwner ? "같은 기관명으로 CRO 가입을 신청하면 합류 신청으로 들어와요." : "기관 정보 수정과 담당자 관리는 대표 담당자가 해요."}
      </div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status" style={{ marginBottom: 12 }}>{msg.text}</p>}
    </div>
  );
}
