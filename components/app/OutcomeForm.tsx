"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const OUTCOMES = ["외부 진행", "보류", "취소"] as const;
type Outcome = (typeof OUTCOMES)[number];
const HELP: Record<Outcome, string> = {
  "외부 진행": "단추 밖에서 어느 기관과 진행하기로 했는지 적어 주세요. 전달된 기관이면 이름만 적어도 됩니다.",
  보류: "지금은 진행하지 않습니다. 같은 요청은 나중에 다시 열 수 있습니다.",
  취소: "시험 계획이 바뀌어 요청을 취소합니다. 회신한 기관에 결과를 안내합니다.",
};

/**
 * 비교표를 받았지만 기관을 선정하지 않고 요청을 마무리할 때.
 * 선정 버튼을 누르지 않은 이유를 한 번 묻는다. 선정이 아니면 어떤 경로였는지 단추가 알아야
 * 기관별 전달 명세와 선정률을 바르게 볼 수 있다.
 */
export function OutcomeForm({ no, compared }: { no: string; compared: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!outcome || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/rfq/${no}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, note }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "저장하지 못했습니다.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div className="sec-title" style={{ margin: "0 0 6px" }}><h2>{compared ? "기관을 선정하지 않고 마무리하나요?" : "이 요청을 더 진행하지 않나요?"}</h2></div>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>{compared ? "비교표의 기관과 진행하려면 비교표에서 선정해 주세요. 선정하면 그 기관에 연락처가 전달됩니다. 다른 경로로 진행하거나 보류하는 경우 여기서 알려 주시면 회신 기관에 결과를 안내합니다." : "계획이 바뀌었거나 다른 경로로 진행하기로 했다면 여기서 마무리할 수 있습니다. 회신 중인 기관에는 닫혔다고 안내합니다."}</p>
        <button type="button" className="b2" onClick={() => setOpen(true)}>{compared ? "선정 없이 마무리" : "요청 마무리"}</button>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="sec-title" style={{ margin: "0 0 10px" }}><h2>어떻게 마무리하나요?</h2></div>
      <div className="stack" style={{ gap: 8 }}>
        {OUTCOMES.map((o) => (
          <label key={o} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: outcome === o ? "var(--tint)" : "var(--sf)", borderRadius: 10, cursor: "pointer" }}>
            <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} style={{ marginTop: 3 }} />
            <span>
              <b style={{ fontWeight: 600 }}>{o}</b>
              <span style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>{HELP[o]}</span>
            </span>
          </label>
        ))}
        {outcome && (
          <label className="fld">
            <span className="fld__label">{outcome === "외부 진행" ? "진행 기관 · 사유 (필수)" : "메모 (선택)"}</span>
            <textarea className="inp" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={outcome === "외부 진행" ? "예: 기존 거래 기관과 진행, 조건이 맞아서" : ""} />
          </label>
        )}
        {err && <p role="alert" style={{ fontSize: 13, color: "var(--err)" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="b1" disabled={!outcome || busy} onClick={submit}>{busy ? "저장 중" : "마무리"}</button>
          <button type="button" className="b2" disabled={busy} onClick={() => setOpen(false)}>돌아가기</button>
        </div>
      </div>
    </div>
  );
}
