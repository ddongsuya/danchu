"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { REOPEN_DAYS } from "@/lib/request-policy";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const OUTCOMES = ["외부 진행", "보류", "취소"] as const;
type Outcome = (typeof OUTCOMES)[number];
const HELP: Record<Outcome, string> = {
  "외부 진행": "단추 밖에서 어느 기관과 진행하기로 했는지 적어 주세요. 전달된 기관이면 이름만 적어도 돼요.",
  보류: `지금은 진행하지 않아요. 비교표가 열린 뒤 보류했고 받은 견적이 있으면 ${REOPEN_DAYS}일 안에 이 화면에서 다시 열 수 있어요.`,
  취소: "시험 계획이 바뀌어 요청을 취소해요. 회신한 기관에 결과를 안내해요.",
};

/**
 * 요청 관리 카드의 "요청 마무리" (시안 v7 r-close). 선정 없이 마무리할 때 이유를 한 번 묻고, 보내기 전에 확인 창을 띄운다.
 * 선정이 아니면 어떤 경로였는지 단추가 알아야 기관별 청구 명세와 선정률을 바르게 볼 수 있다.
 * 보내는 중에는 버튼이 "마무리하는 중"으로 바뀌고 다시 눌러도 보내지 않는다. 실패하면 고른 값을 그대로 두고 버튼 옆에 이유를 보인다.
 */
export function OutcomeForm({ no, compared, initialOpen = false }: { no: string; compared: boolean; initialOpen?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(initialOpen);
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!outcome || busy) return;
    // 비교표가 열린 뒤 보류한 요청만 REOPEN_DAYS 안에 다시 열 수 있다 (요청 화면 reopenUntil)
    const body = compared
      ? `마무리하면 비교표에서 기관을 선정할 수 없습니다. ${outcome === "보류" ? `${REOPEN_DAYS}일 안에 다시 열 수 있습니다.` : "되돌릴 수 없습니다."}`
      : "마무리하면 기관이 견적서를 더 낼 수 없고, 비교표가 열리지 않습니다. 되돌릴 수 없습니다.";
    if (!(await confirm({ title: "선정 없이 요청을 마무리할까요?", body, confirmLabel: "요청 마무리", cancelLabel: "취소", danger: true }))) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/rfq/${no}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, note }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "마무리하지 못했어요. 다시 눌러 주세요.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "마무리하지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return <button type="button" className="b2" onClick={() => setOpen(true)}>요청 마무리</button>;
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <fieldset className="rq-end" disabled={busy}>
        <legend className="sr-only">마무리 사유</legend>
        {OUTCOMES.map((o) => (
          <label key={o} className="rq-end__o" data-on={outcome === o || undefined}>
            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
            <span>
              <b>{o}</b>
              <small>{HELP[o]}</small>
            </span>
          </label>
        ))}
        {outcome && (
          <label className="fld">
            <span className="fld__label">{outcome === "외부 진행" ? "진행 기관 · 사유 (필수)" : "메모 (선택)"}</span>
            <textarea className="inp" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={outcome === "외부 진행" ? "예: 기존 거래 기관과 진행, 조건이 맞아서" : ""} />
          </label>
        )}
      </fieldset>
      <div className="rq-end__acts">
        <button type="button" className="b1 b1--danger" disabled={!outcome || busy} aria-busy={busy || undefined} onClick={submit}>{busy ? "마무리하는 중" : "요청 마무리"}</button>
        <button type="button" className="b2" disabled={busy} onClick={() => setOpen(false)}>돌아가기</button>
        {err && <p role="alert" className="rq-end__err">{err}</p>}
      </div>
    </div>
  );
}
