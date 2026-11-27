"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { md } from "@/lib/format";
import { ManagedBadge } from "./ManagedBadge";
import { adminPost } from "./act";

type Org = { id: string; name: string; categories: string[]; glp: string[]; email: string | null; members: number; invited: boolean; managed?: boolean; sentAt?: string | null; openedAt?: string | null };
type Sent = { sent?: number; mailed?: number; skipped?: string[]; blocked?: string };

/**
 * 참여 안내 (0023, 시안 검토판 a-r-dist). 승인된 기관을 표에서 포함/포함 안 함으로 고르고 "고른 기관에만 보내기"를 누르면 확인창이 보낸다.
 * 안내만 만든다. 참여는 기관이 링크에서 직접 눌러야 하고, 운영자는 대신 참여할 수 없다.
 * 이미 안내한 기관은 "안내함 날짜 · 열람"으로 보이고 다시 고를 수 없다 (다시 보내기는 회신 현황의 메일 재발송).
 */
export function DistributePanel({ no, categories, defaultReplyBy, replyByLocked = false, nomineesOnly = false, orgs, today, autoDistribute: initialAuto }: { no: string; categories: string[]; defaultReplyBy: string; replyByLocked?: boolean; nomineesOnly?: boolean; orgs: Org[]; today: string; autoDistribute: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const match = (o: Org) => o.categories.some((c) => categories.includes(c));
  // "지명 기관에만 안내" 요청은 기본으로 아무 기관도 고르지 않는다 (의뢰자가 요청한 경우에만 추가 안내)
  const [picked, setPicked] = useState<string[]>(nomineesOnly ? [] : orgs.filter((o) => !o.invited && match(o)).map((o) => o.id));
  // 요청에 회신 기한이 있으면 모든 기관이 같은 기한이다. 바꾸려면 "회신 기한 변경"을 쓴다
  const [replyBy, setReplyBy] = useState(defaultReplyBy);
  const [sponsorAsked, setSponsorAsked] = useState(false);
  const [reason, setReason] = useState("");
  const overrideMissing = nomineesOnly && (!sponsorAsked || reason.trim().length < 2);
  const [showAll, setShowAll] = useState(false);
  const [keepManual, setKeepManual] = useState(!initialAuto);
  const past = !!replyBy && replyBy < today;
  const [busy, setBusy] = useState(false);
  const [pickErr, setPickErr] = useState("");
  const [partial, setPartial] = useState("");
  const shown = orgs.filter((o) => showAll || match(o) || o.invited);

  const send = async () => {
    if (busy) return;
    if (!picked.length) { setPickErr("보낼 기관을 하나 이상 골라 주세요."); return; }
    if (!replyBy || past || overrideMissing) return;
    setPickErr("");
    setPartial("");
    const names = orgs.filter((o) => picked.includes(o.id)).map((o) => o.name);
    let result: Sent = {};
    setBusy(true);
    const ok = await confirm({
      title: `고른 기관 ${names.length}곳에 참여 안내를 보낼까요?`,
      body: `보내면 ${names.join(", ")}에 참여 안내가 가고, 회신 기한은 ${md(replyBy)}입니다.`,
      confirmLabel: "안내 보내기",
      pendingLabel: "보내는 중",
      action: async () => {
        result = (await adminPost(`/api/admin/rfqs/${no}/distribute`, { orgIds: picked, replyBy, autoDistribute: !keepManual, ...(nomineesOnly ? { overrideNomineesOnly: sponsorAsked, overrideReason: reason.trim() } : {}) }, "참여 안내를 보내지 못했어요. 다시 보내 주세요.")) as Sent;
      },
    });
    setBusy(false);
    if (!ok) return;
    // 일부 실패: 연락처가 없어 못 보낸 곳만 이름으로 알린다 (시안 a-r-dist~part)
    const skipped = result.skipped ?? [];
    if (result.blocked) setPartial(result.blocked);
    else if (skipped.length) setPartial(`${names.length}곳 중 ${skipped.length}곳에 보내지 못했어요: ${skipped.join(", ")}`);
    setPicked([]);
    setSponsorAsked(false);
    setReason("");
    router.refresh();
  };

  return (
    <section className="adm-sec stack" style={{ gap: 12 }} aria-labelledby="dist-h">
      <div className="adm-sec__head"><h2 id="dist-h">참여 안내{nomineesOnly && <span className="pill pill--warn" style={{ marginLeft: 8 }}>지명 기관에만 안내</span>}</h2></div>
      {partial && <div className="note note--err" role="alert">{partial}</div>}
      {nomineesOnly && <p className="note note--warn" style={{ fontSize: 13 }}>의뢰자가 지명 기관에만 안내를 고른 요청이에요. 의뢰자가 요청한 경우에만 보내고 아래에 요청 내용을 남겨요.</p>}
      {orgs.length === 0 && <p className="note note--warn">승인된 기관이 없어요.</p>}
      {shown.length > 0 && (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead><tr><th><span className="sr-only">포함</span></th><th>기관</th><th>수행 분야</th><th>안내</th></tr></thead>
            <tbody>
              {shown.map((o) => {
                const on = picked.includes(o.id) || o.invited;
                return (
                  <tr key={o.id}>
                    <td>
                      <label className="adm-pick">
                        <input type="checkbox" checked={on} disabled={o.invited} aria-label={`${o.name} 포함`} onChange={(e) => { setPickErr(""); setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id)); }} />
                        <span className={`pill ${on ? "pill--ok" : "pill--sf"}`}>{on ? "포함" : "포함 안 함"}</span>
                      </label>
                    </td>
                    <td><span className="strong">{o.name}</span>{o.managed && <ManagedBadge />}<span className="sub">{o.glp.join(" · ") || "GLP 미등록"}{o.email ? ` · ${o.email}` : ""}</span></td>
                    <td data-label="수행 분야" className="adm-small">{o.categories.join(" · ") || "-"}</td>
                    <td data-label="안내" className="adm-small tnum">{o.invited ? `안내함 ${md(o.sentAt)} · ${o.openedAt ? `${md(o.openedAt)} 열람` : "열지 않음"}` : match(o) ? "-" : "분야 불일치"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pickErr && <p className="fld__err" role="alert">{pickErr}</p>}
      {orgs.some((o) => !match(o) && !o.invited) && (
        <button type="button" className="btxt" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setShowAll(!showAll)}>{showAll ? "분야가 맞는 기관만 보기" : "분야가 다른 기관도 보기"}</button>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="fld" style={{ flex: "1 1 160px" }}>
          <label className="fld__lab" htmlFor="replyBy">회신 기한</label>
          {replyByLocked ? (
            <>
              <input id="replyBy" className="inp tnum" type="date" value={replyBy} readOnly aria-describedby="replyBy-help" />
              <p id="replyBy-help" className="fld__help">기한은 &ldquo;회신 기한 변경&rdquo;으로 바꿔요.</p>
            </>
          ) : (
            <input id="replyBy" className="inp" type="date" value={replyBy} onChange={(e) => setReplyBy(e.target.value)} />
          )}
        </div>
        <button type="button" className="b1" disabled={!replyBy || busy || past || overrideMissing} onClick={send}>고른 기관에만 보내기</button>
      </div>
      {nomineesOnly && (
        <div className="stack" style={{ gap: 8 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
            <input type="checkbox" checked={sponsorAsked} onChange={(e) => setSponsorAsked(e.target.checked)} style={{ marginTop: 2 }} />
            <span>의뢰자가 지명 기관 밖의 기관에도 안내해 달라고 요청함</span>
          </label>
          <div className="fld">
            <label className="fld__lab" htmlFor="overrideReason">의뢰자 요청 내용</label>
            <input id="overrideReason" className="inp" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="예: 10/21 전화, 분야 맞는 기관 2곳 추가 요청" aria-describedby="overrideReason-help" />
            <p id="overrideReason-help" className="fld__help">감사 기록에 남아요.</p>
          </div>
        </div>
      )}
      {past && <p className="note note--warn" style={{ fontSize: 13 }}>회신 기한이 지났어요. 회신 기한을 먼저 늘려요.</p>}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
        <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} style={{ marginTop: 2 }} />
        <span>자동 추가 끄기 <span style={{ display: "block", color: "var(--muted)" }}>켜 두면 나중에 승인되는 기관이나 매일 하는 빈자리 채우기가 이 요청에 기관을 더하지 않아요.</span></span>
      </label>
    </section>
  );
}
