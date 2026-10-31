"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ManagedBadge } from "./ManagedBadge";

type Org = { id: string; name: string; categories: string[]; glp: string[]; email: string | null; members: number; invited: boolean; managed?: boolean };

/**
 * 참여 안내 추가 (0023). 승인된 기관을 골라 참여 안내(요약 링크 메일)를 보낸다. 분야가 다른 기관과 운영자 관리 기관도 고를 수 있다.
 * 안내만 만든다. 참여는 기관이 링크에서 직접 눌러야 하고, 운영자는 대신 참여할 수 없다
 */
export function DistributePanel({ no, categories, defaultReplyBy, replyByLocked = false, nomineesOnly = false, orgs, today, autoDistribute: initialAuto }: { no: string; categories: string[]; defaultReplyBy: string; replyByLocked?: boolean; nomineesOnly?: boolean; orgs: Org[]; today: string; autoDistribute: boolean }) {
  const router = useRouter();
  const match = (o: Org) => o.categories.some((c) => categories.includes(c));
  // "지명 기관에만 안내" 요청은 기본으로 아무 기관도 고르지 않는다 (의뢰자가 요청한 경우에만 추가 안내)
  const [picked, setPicked] = useState<string[]>(nomineesOnly ? [] : orgs.filter((o) => !o.invited && match(o)).map((o) => o.id));
  // 요청에 회신 기한이 있으면 모든 기관이 같은 기한이다. 바꾸려면 회신 현황의 "회신 기한 변경"을 쓴다
  const [replyBy, setReplyBy] = useState(defaultReplyBy);
  const [sponsorAsked, setSponsorAsked] = useState(false);
  const [reason, setReason] = useState("");
  const overrideMissing = nomineesOnly && (!sponsorAsked || reason.trim().length < 2);
  const [showAll, setShowAll] = useState(false);
  const [keepManual, setKeepManual] = useState(!initialAuto);
  const past = !!replyBy && replyBy < today;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const shown = orgs.filter((o) => showAll || match(o) || o.invited);

  const send = async () => {
    if (!picked.length || !replyBy || busy || past || overrideMissing) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/rfqs/${no}/distribute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgIds: picked, replyBy, autoDistribute: !keepManual, ...(nomineesOnly ? { overrideNomineesOnly: sponsorAsked, overrideReason: reason.trim() } : {}) }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; mailed?: number; skipped?: string[]; blocked?: string };
      if (!res.ok) throw new Error(d.error || "참여 안내를 보내지 못했습니다.");
      setMsg({ ok: true, text: `${d.sent}곳에 참여 안내를 보냈습니다. 메일 ${d.mailed}건.${d.blocked ? ` ${d.blocked}` : d.skipped?.length ? ` 연락처가 없어 ${d.skipped.length}곳은 보내지 못했습니다.` : ""} 기관이 참여하기를 누르면 회신 현황에 참여로 바뀝니다.` });
      setPicked([]);
      setSponsorAsked(false);
      setReason("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "참여 안내를 보내지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {nomineesOnly && <p className="note note--warn" style={{ fontSize: 13 }}>의뢰자가 <b>지명 기관에만 안내</b>를 고른 요청입니다. 의뢰자가 다른 기관에도 안내해 달라고 요청한 경우에만 보내고, 아래에 요청 내용을 남겨 주세요 (감사 기록).</p>}
      {orgs.length === 0 && <p className="note note--warn">승인된 기관이 없습니다. 기관 탭에서 가입 신청을 승인하세요.</p>}
      <div className="stack" style={{ gap: 6 }}>
        {shown.map((o) => {
          const on = picked.includes(o.id);
          const ok = match(o);
          return (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: `1px solid ${on ? "var(--brand)" : "var(--cline)"}`, background: on ? "var(--tint)" : "var(--wh)", borderRadius: 10, cursor: o.invited ? "default" : "pointer", opacity: o.invited ? 0.6 : 1 }}>
              <input type="checkbox" checked={on} disabled={o.invited} onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id))} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {o.name} {o.invited && <span className="pill pill--sf">안내함</span>}{!ok && <span className="pill pill--warn">분야 불일치</span>}{o.managed && <ManagedBadge />}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{o.glp.join(" · ") || "GLP 미등록"} · {o.managed ? "참여는 기관이 링크에서 직접, 참여 뒤 PDF 옮겨 적기 가능" : `담당자 ${o.members}명`}{o.email ? ` · ${o.email}` : ""}</div>
              </div>
            </label>
          );
        })}
      </div>
      {orgs.some((o) => !match(o) && !o.invited) && (
        <button type="button" className="btxt" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setShowAll(!showAll)}>{showAll ? "분야가 맞는 기관만 보기" : "분야가 다른 기관도 보기"}</button>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="fld" style={{ flex: "1 1 160px" }}>
          <label className="fld__lab" htmlFor="replyBy">회신 기한</label>
          {replyByLocked ? (
            <>
              <input id="replyBy" className="inp tnum" type="date" value={replyBy} readOnly aria-describedby="replyBy-help" />
              <p id="replyBy-help" className="fld__help">모든 기관이 같은 회신 기한입니다. 바꾸려면 회신 현황의 "회신 기한 변경"을 쓰세요.</p>
            </>
          ) : (
            <input id="replyBy" className="inp" type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
          )}
        </div>
        <button type="button" className="b1" disabled={!picked.length || !replyBy || busy || past || overrideMissing} onClick={send}>{busy ? "보내는 중…" : `${picked.length}곳에 참여 안내`}</button>
      </div>
      {nomineesOnly && (
        <div className="stack" style={{ gap: 8 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
            <input type="checkbox" checked={sponsorAsked} onChange={(e) => setSponsorAsked(e.target.checked)} style={{ marginTop: 2 }} />
            <span>의뢰자가 지명 기관 밖의 기관에도 안내해 달라고 요청했습니다</span>
          </label>
          <div className="fld">
            <label className="fld__lab" htmlFor="overrideReason">의뢰자 요청 내용</label>
            <input id="overrideReason" className="inp" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="예: 10/21 전화, 분야 맞는 기관 2곳 추가 요청" aria-describedby="overrideReason-help" />
            <p id="overrideReason-help" className="fld__help">언제, 어떤 방법으로 요청받았는지 적어 주세요. 감사 기록에 남습니다.</p>
          </div>
        </div>
      )}
      {past && <p className="note note--warn" style={{ fontSize: 13 }}>회신 기한이 이미 지났습니다. 회신 현황의 "회신 기한 변경"으로 먼저 늘린 뒤 안내하세요.</p>}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
        <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} style={{ marginTop: 2 }} />
        <span>고른 기관에만 보내기 <span style={{ display: "block", color: "var(--muted)" }}>켜 두면 나중에 승인되는 기관이나 매일 한 번 하는 빈자리 채우기가 이 요청에 기관을 더하지 않습니다. 운영자가 고른 기관만 안내를 받습니다.</span></span>
      </label>
      <p className="fld__help">안내 링크는 회신 기한 +7일까지 열립니다. 기관 대표 이메일과 담당자 계정 모두에 메일이 갑니다. 운영자는 기관 대신 참여할 수 없고, 기관이 참여한 뒤에만 견적서 PDF를 옮겨 적을 수 있습니다.</p>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
    </div>
  );
}
