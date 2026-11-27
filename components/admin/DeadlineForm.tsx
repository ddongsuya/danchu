"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { md } from "@/lib/format";
import { adminPost } from "./act";

/**
 * 회신 기한 변경 (시안 검토판 a-deadline). 버튼을 누르면 확인창 안에서 새 기한을 고르고, 창이 바로 바꾼다 (처리 중 · 창 안 실패 · 다시).
 * 비교표가 열린 요청에는 보이지 않는다 (2026-10-21 결정 3). 배포한 요청은 늘리기만 된다: min 은 페이지가 max(오늘, 지금 기한 다음 날)로 넘긴다 (결정 2)
 */
export function DeadlineForm({ no, current, min, invited = 0, distributed = false, primary = false, label = "회신 기한 변경" }: { no: string; current: string | null; min: string; invited?: number; distributed?: boolean; primary?: boolean; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [replyBy, setReplyBy] = useState(current && current >= min ? current : min);

  const save = async () => {
    if (!replyBy || replyBy < min) throw new Error(current ? `지금 기한(${md(current)}) 뒤 날짜를 골라 주세요.` : "오늘 이후 날짜를 골라 주세요.");
    await adminPost(`/api/admin/rfqs/${no}/deadline`, { replyBy }, "회신 기한을 바꾸지 못했어요. 기한은 그대로예요.");
    router.refresh();
  };

  const notice = invited ? `바꾸면 의뢰자와 안내를 받은 기관 ${invited}곳에 새 기한을 알립니다.` : "바꾸면 의뢰자에게 새 기한을 알립니다.";
  return (
    <>
      <button type="button" className={primary ? "b1 bsm" : "b2 bsm"} onClick={() => setOpen(true)}>{label}</button>
      <ConfirmDialog
        open={open}
        title={`회신 기한을 ${md(replyBy)}로 바꿀까요?`}
        body={
          <>
            <p>{notice}{distributed ? " 배포한 뒤라 기한은 늘리기만 할 수 있습니다." : ""}</p>
            <div className="fld" style={{ marginTop: 12 }}>
              <label className="fld__lab" htmlFor={`dl-${no}`}>새 회신 기한</label>
              <input id={`dl-${no}`} className="inp tnum" type="date" min={min} value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
            </div>
          </>
        }
        confirmLabel="기한 변경"
        pendingLabel="바꾸는 중"
        action={save}
        onResult={() => setOpen(false)}
      />
    </>
  );
}
