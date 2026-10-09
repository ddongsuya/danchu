"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ymd } from "@/lib/format";

type M = { id: string; name: string | null; email: string; phone: string | null; created_at: string };

/** 기관 상세 - 담당자 합류 신청을 연결하거나 거절한다 */
export function JoinRequests({ orgId, members }: { orgId: string; members: M[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const act = async (m: M, link: boolean) => {
    if (busy) return;
    if (!window.confirm(link ? `${m.email}을(를) 이 기관 담당자로 연결할까요? 기관에 배포된 요청서를 모두 볼 수 있게 됩니다.` : "합류 신청을 거절할까요? 계정은 남고 기관 연결만 되지 않습니다.")) return;
    setBusy(m.id);
    setErr("");
    const res = await fetch(`/api/admin/users/${m.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 거절해도 역할은 기관 담당자로 둔다. 의뢰자로 바꾸면 다음 로그인에 의뢰자 홈으로 들어간다
      body: JSON.stringify(link ? { role: "cro", croOrgId: orgId } : { role: "cro", croOrgId: null }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) setErr(d.error || "처리하지 못했습니다.");
    else router.refresh();
    setBusy("");
  };

  if (!members.length) return null;
  return (
    <div className="card card--rows" style={{ borderColor: "var(--bline)" }}>
      <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>담당자 합류 신청 {members.length}</div>
      <p style={{ padding: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>기관 이메일 도메인과 담당자 정보를 확인한 뒤 연결하세요. 연결 전에는 이 기관의 요청서를 볼 수 없습니다.</p>
      {members.map((m) => (
        <div key={m.id} className="kv" style={{ gap: 10 }}>
          <span>
            <b style={{ fontWeight: 600 }}>{m.name || "-"}</b>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.email}{m.phone ? ` · ${m.phone}` : ""} · 신청 {ymd(m.created_at)}</span>
          </span>
          <span style={{ display: "inline-flex", gap: 6, flex: "none" }}>
            <button type="button" className="b1 bsm" disabled={!!busy} onClick={() => act(m, true)}>{busy === m.id ? "…" : "연결"}</button>
            <button type="button" className="b2 bsm b2--danger" disabled={!!busy} onClick={() => act(m, false)}>거절</button>
          </span>
        </div>
      ))}
      {err && <p style={{ fontSize: 12, color: "var(--err)", padding: "4px 0 8px" }}>{err}</p>}
    </div>
  );
}
