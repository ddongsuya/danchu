"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmDialog";
import { adminPost, josa } from "./act";

/**
 * 기관 승인 처리 (시안 검토판 a-cro). 승인 · 반려 · 참여 중지 · (운영자 관리 기관) 수신 재개 · 수신 거부.
 * 모두 확인창이 실행하고, 실패하면 창 안에 "기관 상태는 바뀌지 않았어요"와 "다시 …"를 보여 준다. 반려 사유는 창 안에서 받는다.
 * 중지·수신 거부는 서버가 열린 초대(작성 중 회신 링크 포함)를 닫는다 (app/api/admin/cros/[id] 44~49줄).
 */
export function OrgApproval({ id, name, status, managed = false }: { id: string; name: string; status: string; managed?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const call = (action: string, fallback: string, body?: Record<string, unknown>) => async () => {
    await adminPost(`/api/admin/cros/${id}`, { action, ...body }, fallback);
  };
  const ask = async (opts: ConfirmOptions) => { if (await confirm(opts)) router.refresh(); };
  const keep = "기관 상태는 바뀌지 않았어요.";

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status === "pending" && !managed && <Button className="b2 b2--danger" onClick={() => setRejecting(true)}>반려</Button>}
        {status !== "approved" && (managed
          ? <Button className="b1" onClick={() => ask({ title: `${name}의 수신을 다시 열까요?`, body: "다시 열면 참여 안내에서 이 기관을 고를 수 있고, 기관에 메일은 보내지 않습니다.", confirmLabel: "수신 재개", pendingLabel: "여는 중", action: call("approve", `수신을 다시 열지 못했어요. ${keep}`) })}>수신 재개</Button>
          : <Button className="b1" onClick={() => ask({ title: `${josa(name, "을", "를")} 승인할까요?`, body: `승인하면 ${josa(name, "이", "가")} 분야에 맞는 요청의 참여 안내를 받습니다.`, confirmLabel: "승인", pendingLabel: "승인하는 중", action: call("approve", `승인하지 못했어요. ${keep}`) })}>승인</Button>)}
        {status === "approved" && managed && <Button className="b2 b2--danger" onClick={() => ask({ title: "수신 거부로 처리할까요?", body: "처리하면 새 요청서가 가지 않고 열린 안내도 닫히며, 기관에 메일은 보내지 않습니다.", confirmLabel: "수신 거부 처리", pendingLabel: "처리하는 중", danger: true, action: call("optout", `수신 거부로 처리하지 못했어요. ${keep}`) })}>수신 거부 처리</Button>}
        {status === "approved" && !managed && <Button className="b2 b2--danger" onClick={() => ask({ title: `${name}의 참여를 멈출까요?`, body: "멈추면 새 참여 안내를 보내지 않고, 작성 중인 회신 링크도 닫힙니다.", confirmLabel: "참여 중지", pendingLabel: "멈추는 중", danger: true, action: call("suspend", `참여를 멈추지 못했어요. ${keep}`) })}>참여 중지</Button>}
      </div>
      <ConfirmDialog
        open={rejecting}
        title={`${name} 신청을 반려할까요?`}
        body={
          <div className="stack" style={{ gap: 12 }}>
            <p>반려하면 대표 이메일로 반려 결과를 알리고, 기관은 다시 신청해야 합니다.</p>
            <div className="fld">
              <label className="fld__lab" htmlFor={`rej-${id}`}>반려 사유</label>
              <textarea id={`rej-${id}`} className="ta" rows={3} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} />
            </div>
          </div>
        }
        confirmLabel="반려"
        pendingLabel="반려하는 중"
        danger
        action={async () => { await call("reject", `반려하지 못했어요. ${keep}`, { reason })(); router.refresh(); }}
        onResult={() => setRejecting(false)}
      />
    </div>
  );
}
