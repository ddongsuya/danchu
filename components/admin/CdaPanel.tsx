"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CdaPanel({
  no,
  invites,
}: {
  no: string;
  invites: { id: string; cro_name: string; cda_signed_at: string | null }[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = invites.find((i) => i.id === picked);
  const save = async () => {
    if (!selected || !reference.trim() || busy) return;
    if (
      !window.confirm(
        selected.cda_signed_at
          ? "회사명과 첨부를 다시 비공개로 전환할까요? 이미 내려받은 파일은 회수되지 않습니다."
          : "양측의 CDA 체결을 확인했습니까? 이 기관에 회사명과 첨부파일을 공개합니다.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/rfqs/${no}/cda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteId: picked,
          reference,
          signed: !selected.cda_signed_at,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage("공개 범위를 변경했습니다.");
      setReference("");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card card--pad stack">
      <h2 style={{ fontSize: 16 }}>기관별 CDA 확인</h2>
      <p className="fld__help">
        외부에서 체결한 계약을 확인한 뒤 공개하세요. 체결 확인 전에는 회사명과
        첨부를 공개하지 않습니다.
      </p>
      <label className="fld">
        <span>기관</span>
        <select
          className="sel"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          <option value="">기관 선택</option>
          {invites.map((i) => (
            <option key={i.id} value={i.id}>
              {i.cro_name} ·{" "}
              {i.cda_signed_at ? "체결 확인됨" : "체결 확인 대기"}
            </option>
          ))}
        </select>
      </label>
      <label className="fld">
        <span>체결 확인 근거 / 변경 사유</span>
        <input
          className="inp"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="계약 문서 번호, 체결일, 확인 내용"
          maxLength={500}
        />
      </label>
      <button
        className="b2"
        disabled={!selected || !reference.trim() || busy}
        onClick={save}
      >
        {busy
          ? "저장 중…"
          : selected?.cda_signed_at
            ? "비공개로 전환"
            : "체결 확인하고 공개"}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
