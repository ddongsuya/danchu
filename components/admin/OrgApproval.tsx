"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmDialog";

export function OrgApproval({ id, status, managed = false }: { id: string; status: string; managed?: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const confirm = useConfirm();

  const act = async (action: string, ask: ConfirmOptions) => {
    if (busy || !(await confirm(ask))) return;
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/cros/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "처리했습니다." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="fld">
        <label className="fld__lab" htmlFor="reason">{managed ? "메모 (운영 기록에만 남고 기관에 메일은 가지 않습니다)" : "안내 문구 (반려·중지 시 메일에 포함)"}</label>
        <input id="reason" className="inp" style={{ height: 44 }} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="예: 사업자등록번호 확인 필요" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status !== "approved" && (managed
          ? <Button className="b1" pending={busy === "approve"} disabled={!!busy && busy !== "approve"} onClick={() => act("approve", { title: "이 기관의 수신을 재개하시겠습니까?", body: "기관이 다시 요청서를 받기로 했을 때만 진행합니다. 배포 패널에서 고를 수 있게 되고, 기관에 메일은 보내지 않습니다.", confirmLabel: "수신 재개" })}>수신 재개</Button>
          : <Button className="b1" pending={busy === "approve"} disabled={!!busy && busy !== "approve"} onClick={() => act("approve", { title: "이 기관을 승인하시겠습니까?", body: "담당자에게 승인 메일이 갑니다.", confirmLabel: "승인" })}>승인</Button>)}
        {status === "pending" && <Button className="b2 b2--danger" pending={busy === "reject"} disabled={!!busy && busy !== "reject"} onClick={() => act("reject", { title: "이 기관을 반려하시겠습니까?", confirmLabel: "반려", danger: true })}>반려</Button>}
        {status === "approved" && managed && <Button className="b2 b2--danger" pending={busy === "optout"} disabled={!!busy && busy !== "optout"} onClick={() => act("optout", { title: "수신 거부로 처리하시겠습니까?", body: "기관이 수신 거부를 요청했을 때만 진행합니다. 새 요청서가 가지 않고 열린 초대도 닫히며, 기관에 메일은 보내지 않습니다.", confirmLabel: "수신 거부 처리", danger: true })}>수신 거부 처리</Button>}
        {status === "approved" && !managed && <Button className="b2 b2--danger" pending={busy === "suspend"} disabled={!!busy && busy !== "suspend"} onClick={() => act("suspend", { title: "이 기관의 참여를 중지하시겠습니까?", body: "새 참여 안내가 가지 않습니다.", confirmLabel: "중지", danger: true })}>중지</Button>}
      </div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
    </div>
  );
}
