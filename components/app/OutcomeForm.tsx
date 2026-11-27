"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { REOPEN_DAYS } from "@/lib/request-policy";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const OUTCOMES = ["외부 진행", "보류", "취소"] as const;
type Outcome = (typeof OUTCOMES)[number];

/** 확인창 본문: 마무리 방법과 메모. 값은 확인창이 실행할 때 읽는다 */
function OutcomeBody({ compared, onChange }: { compared: boolean; onChange: (v: { outcome?: Outcome; note?: string }) => void }) {
  return (
    <>
      <p>
        마무리하면 안내를 받은 기관에 요청이 닫혔다고 알립니다.{" "}
        {compared ? `보류를 고르면 ${REOPEN_DAYS}일 안에 다시 열 수 있습니다.` : "비교표가 열리기 전이라 보류를 골라도 다시 열 수 없습니다."}
      </p>
      <fieldset className="rq-end">
        <legend className="fld__label">어떻게 마무리하나요?</legend>
        {OUTCOMES.map((o) => (
          <label key={o} className="rq-end__o">
            <input type="radio" name="outcome" value={o} onChange={() => onChange({ outcome: o })} />
            <span><b>{o}</b></span>
          </label>
        ))}
      </fieldset>
      <label className="fld">
        <span className="fld__label">메모 (선택)</span>
        <textarea className="inp" rows={2} maxLength={500} onChange={(e) => onChange({ note: e.currentTarget.value })} />
      </label>
      <p className="fld__help">외부 진행을 고르면 진행 기관과 사유를 적어야 해요.</p>
    </>
  );
}

/**
 * "요청 마무리" (시안 r-outcome): 선정 없이 마무리할 때 확인창 하나에서 방법(외부 진행 · 보류 · 취소)과 메모를 받고 바로 처리한다.
 * 처리 중에는 "마무리하는 중", 실패하면 창 안에서 알리고 "다시 마무리". 보류는 비교표가 열린 뒤에 고른 경우에만 REOPEN_DAYS 안에 다시 연다.
 * initialOpen: 요청 화면 주소가 ?end=1 이면 화면을 열자마자 확인창을 띄운다
 */
export function OutcomeForm({ no, compared, initialOpen = false, label = "요청 마무리", className = "b2" }: { no: string; compared: boolean; initialOpen?: boolean; label?: string; className?: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const val = useRef<{ outcome?: Outcome; note: string }>({ note: "" });

  const open = async () => {
    val.current = { note: "" };
    const ok = await confirm({
      title: "이 요청을 더 진행하지 않나요?",
      body: <OutcomeBody compared={compared} onChange={(v) => { val.current = { ...val.current, ...v }; }} />,
      confirmLabel: "마무리",
      cancelLabel: "돌아가기",
      pendingLabel: "마무리하는 중",
      danger: true,
      action: async () => {
        const { outcome, note } = val.current;
        if (!outcome) throw new Error("마무리 방법을 골라 주세요.");
        if (outcome === "외부 진행" && !note.trim()) throw new Error("진행 기관과 사유를 메모에 적어 주세요.");
        const r = await fetch(`/api/rfq/${no}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, note }) }).catch(() => null);
        if (!r?.ok) throw new Error("요청을 마무리하지 못했어요. 요청 상태는 바뀌지 않았어요.");
      },
    });
    if (ok) router.refresh();
  };

  const opened = useRef(false);
  useEffect(() => {
    if (!initialOpen || opened.current) return;
    opened.current = true;
    void open();
    // 처음 한 번만 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpen]);

  return <button type="button" className={className} onClick={() => void open()}>{label}</button>;
}
