"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminPost } from "./act";

/**
 * 의뢰자가 이의를 남긴 계약 보고를 운영자가 정리한다 (2026-10-20 결정 2, 0025 resolve_contract_dispute, 시안 검토판 a-dispute).
 * - 보고대로 확정: 운영자 확정으로 기록하고 요청을 마친다. 확정한 달에 정산한다
 * - 보고 취소: 보고를 지우고 기관이 다시 보고한다
 * 금액이나 체결일을 고쳐야 하면 먼저 요청 화면의 체결 정보 정정으로 고친 뒤 확정한다. 확인한 내용은 필수이며 감사 기록에 남는다.
 */
export function DisputeResolve({ awardId, rfqNo, report, dispute }: { awardId: string; rfqNo?: string; report?: string; dispute?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<"confirm" | "reject">("confirm");
  const [note, setNote] = useState("");

  const save = async () => {
    if (!note.trim()) throw new Error("확인한 내용을 입력해 주세요.");
    await adminPost(`/api/admin/awards/${awardId}/dispute`, { resolution, note: note.trim() }, "이의를 처리하지 못했어요. 계약 상태는 바뀌지 않았어요.");
    router.refresh();
  };
  const rows: [string, string][] = [["요청", rfqNo ?? ""], ["기관 보고", report ?? ""], ["의뢰자 이의", dispute ?? ""]].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <button type="button" className="b2 bsm" onClick={() => setOpen(true)}>이의 처리</button>
      <ConfirmDialog
        open={open}
        title="이의를 처리할까요?"
        body={
          <div className="stack" style={{ gap: 12 }}>
            <p>처리하면 결과가 의뢰자와 기관에 알려지고, 보고대로 확정하면 계약이 확정됩니다.</p>
            {rows.length > 0 && (
              <dl className="adm-dl">
                {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>)}
              </dl>
            )}
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="fld__lab" style={{ marginBottom: 6 }}>결과</legend>
              <div className="chips">
                <button type="button" className="chip" aria-pressed={resolution === "confirm"} onClick={() => setResolution("confirm")}>보고대로 확정</button>
                <button type="button" className="chip" aria-pressed={resolution === "reject"} onClick={() => setResolution("reject")}>보고 취소</button>
              </div>
            </fieldset>
            <div className="fld">
              <label className="fld__lab" htmlFor={`dr-n-${awardId}`}>확인한 내용</label>
              <textarea id={`dr-n-${awardId}`} className="ta" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} />
            </div>
          </div>
        }
        confirmLabel="처리"
        cancelLabel="닫기"
        pendingLabel="처리하는 중"
        action={save}
        onResult={() => setOpen(false)}
      />
    </>
  );
}
