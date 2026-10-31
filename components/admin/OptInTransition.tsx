"use client";
import { useState } from "react";

export type TransitionRow = { rfqNo: string; replyBy: string; joinBy: string; offers: string[] };

/**
 * 참여 선택형 전환 (0023 적용 뒤 한 번, lib/opt-in-transition.ts). 전환할 열린 요청이 있을 때만 운영자 홈에 보인다.
 * 실행하면 요청마다 참여 결정 기한을 채우고 관리 기관에 참여 안내를 다시 보낸다. 처리한 요청은 다음에 홈을 열 때 목록에서 빠진다
 */
export function OptInTransition({ rows }: { rows: TransitionRow[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; failed?: string[] } | null>(null);
  const offers = rows.reduce((n, r) => n + r.offers.length, 0);

  const run = async () => {
    if (busy) return;
    if (!window.confirm(`열린 요청 ${rows.length}건의 참여 결정 기한을 오늘부터 다시 잡고, 관리 기관 ${offers}곳에 참여 안내 메일을 다시 보냅니다. 진행할까요?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/opt-in/transition", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string; failed?: string[] };
      if (!r.ok) throw new Error(d.error || "전환을 마치지 못했습니다.");
      // 목록을 바로 새로 고치면 이 카드가 사라져 결과 문구를 못 본다. 결과를 보여 주고 새로 고침은 운영자에게 맡긴다
      setMsg({ ok: true, text: d.message || "전환했습니다.", failed: d.failed });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "전환을 마치지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="note note--tint optin-tr" aria-labelledby="optin-tr-title">
      <h2 id="optin-tr-title" className="optin-tr__title">참여 선택형 전환</h2>
      <p className="optin-tr__body tnum">
        예전 방식으로 안내가 나간 열린 요청이 {rows.length}건 있습니다. 실행하면 요청마다 참여 결정 기한을 오늘부터 다시 잡고, 아직 참여를 정하지 않은 관리 기관 {offers}곳에 참여 안내 메일을 다시 보냅니다. 계정이 있는 기관은 기관 화면과 기존 링크에서 참여 화면을 바로 보므로 메일을 다시 보내지 않습니다.
      </p>
      <details className="optin-tr__list">
        <summary>대상 보기</summary>
        <ul>
          {rows.map((r) => (
            <li key={r.rfqNo} className="tnum">
              <a href={`/admin/r/${r.rfqNo}`}>{r.rfqNo}</a> · 회신 기한 {r.replyBy} · 참여 결정 기한 {r.joinBy}
              {r.offers.length ? ` · 다시 보낼 곳 ${r.offers.join(", ")}` : " · 다시 보낼 관리 기관 없음"}
            </li>
          ))}
        </ul>
      </details>
      <div className="optin-tr__actions">
        <button type="button" className="b1 bsm" onClick={run} disabled={busy || rows.length === 0 || !!msg?.ok} aria-busy={busy}>
          {busy ? "전환 중…" : msg?.ok ? "전환함" : "전환 실행"}
        </button>
        {msg && (
          <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "optin-tr__ok" : "optin-tr__err"}>
            {msg.text}
            {msg.failed?.length ? ` (${msg.failed.join(" / ")})` : ""}
          </span>
        )}
      </div>
    </section>
  );
}
