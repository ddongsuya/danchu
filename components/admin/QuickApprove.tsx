"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LONG_ACTION_TIMEOUT_MS, failureText } from "@/components/ui/toast-queue";

/** 기관 목록 행에서 바로 승인 (반려·중지는 상세 화면에서) */
export function QuickApprove({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const confirm = useConfirm();

  const approve = async () => {
    if (busy || !(await confirm({ title: `${name} 기관을 승인하시겠습니까?`, body: "담당자에게 승인 메일이 갑니다.", confirmLabel: "승인" }))) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/cros/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", reason: "" }), signal: AbortSignal.timeout(LONG_ACTION_TIMEOUT_MS) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "처리하지 못했습니다.");
      router.refresh();
    } catch (e) {
      setErr(failureText(e, "처리하지 못했습니다. 다시 시도하세요."));
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <Button className="b1 bsm" pending={busy} onClick={approve}>승인</Button>
      {err && <span role="alert" style={{ fontSize: 12, color: "var(--err)" }}>{err}</span>}
    </span>
  );
}
