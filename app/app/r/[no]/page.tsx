import { AttachmentRetry } from "@/components/app/AttachmentRetry";
import { OutcomeForm } from "@/components/app/OutcomeForm";
import { ContractConfirm, ReopenRequest, StartNow } from "@/components/app/RequestActions";
import { needsCda, occupiesSeat, participation, participationLabel, seatState, REOPEN_DAYS } from "@/lib/request-policy";
import { getSupabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { ENDED_LABEL, STAGES, statusLabel, statusTone, inviteStage, inviteStageLabel } from "@/lib/status";
import { CheckMark, Crumb, StatusPill } from "@/components/app/ui";
import { md, mdhm, won, ymd } from "@/lib/format";
import { labelMap } from "@/lib/rfq-schema";
import { comparisonOpened } from "@/lib/reply-window";

export const dynamic = "force-dynamic";

export default async function RequestDetail({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  // 기관을 고르지 않고 마친 요청은 선택·계약 단계를 건너뛰고 "마무리"로 끝난다
  const stages = rfq.outcome && rfq.status === "closed"
    ? STAGES.filter((s) => s.key !== "selected" && s.key !== "contracting").map((s) => (s.key === "closed" ? { ...s, label: ENDED_LABEL, desc: "기관을 고르지 않고 요청을 마쳤습니다" } : s))
    : STAGES;
  const idx = Math.max(0, stages.findIndex((s) => s.key === rfq.status));
  // 운영자가 취소한 초대는 숫자에서 뺀다
  // 비교표가 열리기 전 (2026-10-20 결정 1): 의뢰자에게는 진행 숫자(참여 n곳, 제출 m곳)만 보인다.
  // 일반 기관의 이름·금액·견적은 열릴 때 함께 공개한다. 의뢰자가 지명한 기관만 이름과 참여 여부(참여·불참·결정 전)를 보여 준다
  const opened = !!rfq.compared_at;
  const ended = ["closed", "cancelled"].includes(rfq.status);
  // 비교표가 열리기 전에 마무리한 요청도 일반 기관 이름은 보이지 않는다
  const named = comparisonOpened(rfq);
  const nominees = d.invites.filter((i) => i.source === "nominated" && !i.revoked_at);
  // 비교표가 열린 뒤: 참여한 기관과 지명 기관 결과 (0023). 일반 기관의 참여 결정 전·불참·철회는 그때도 보이지 않는다
  const shown = sponsorVisibleInvites(d.invites);
  const seats = seatState(rfq.cro_count, rfq.join_by, d.invites);
  const counts = participation(rfq.cro_count, d.invites);
  const { submitted, joined: joinedCount } = counts;
  const seatLine = participationLabel(counts);
  const joinBy = rfq.join_by ? new Date(rfq.join_by).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : null;
  // 선택은 비교표가 열린 뒤에만 (0025 select_quote: 열리기 전이면 not_compared). 기한 전 선정 단계는 없다
  const canCompare = opened && submitted > 0;
  const p = rfq.payload;
  const labels = labelMap();
  // 선정한 기관의 연락처 (선정 순간 서로 주고받는다)
  let croContact: { name: string; email: string; phone: string } | null = null;
  if (d.award?.cro_org_id) {
    const { data: org } = await getSupabaseAdmin()!.from("cro_orgs").select("contact_name, contact_email, contact_phone").eq("id", d.award.cro_org_id).maybeSingle();
    if (org && (org.contact_email || org.contact_phone)) croContact = { name: org.contact_name ?? "", email: org.contact_email ?? "", phone: org.contact_phone ?? "" };
  }
  // 계약 확인 (2026-10-20 결정 2, 0025): 기관 보고 → 의뢰자 확인 또는 이의 → 이의가 없으면 7일 뒤 자동 확정
  const aw = d.award;
  const reported = aw?.contract_reported_at ?? null;
  const confirmedAt = aw ? aw.contract_confirmed_at ?? aw.requester_confirmed_at : null;
  const disputeOpen = !!(aw?.requester_disputed_at && !aw.dispute_resolved_at && !confirmedAt);
  // 계약 확인은 요청 주인만 한다 (운영자가 이 화면을 열어도 확인 버튼을 보이지 않는다. 운영자 확정은 이의 정리에서만, 0025 confirm_contract)
  const needsConfirm = !!(aw && reported && aw.contract_status === "signed" && !confirmedAt && !disputeOpen && ["selected", "contracting"].includes(rfq.status) && ownsRfq(rfq, s.userId));
  const dueAt = aw?.contract_confirm_due_at ?? (reported ? new Date(new Date(reported).getTime() + 7 * 864e5).toISOString() : null);
  const autoOn = dueAt ? ymd(dueAt) : "";
  const via = aw?.contract_confirmed_via ?? (aw?.requester_confirmed_at ? (aw.confirmed_auto ? "auto" : "sponsor") : null);
  const viaNote = via === "auto" ? " (보고 7일 뒤 자동 확정)" : via === "operator" ? " (운영자가 기관과 확인한 뒤 확정)" : "";
  // 비교표가 열린 뒤 보류한 요청만 다시 연다. 열리기 전에 보류한 요청을 다시 열면 기한 전 선정 길이 되므로 막는다 (결정 1)
  const reopenUntil = rfq.outcome === "보류" && rfq.status === "closed" && !!rfq.compared_at && rfq.outcome_at && submitted > 0 && Date.now() - new Date(rfq.outcome_at).getTime() <= REOPEN_DAYS * 864e5 ? ymd(new Date(new Date(rfq.outcome_at).getTime() + REOPEN_DAYS * 864e5).toISOString()) : "";
  const chips = [
    ...(Array.isArray(p.authority) ? (p.authority as string[]) : []),
    rfq.cro_count ? (rfq.cro_count === "전체" ? "참여 자리 제한 없음" : `참여 자리 ${rfq.cro_count}`) : "",
    rfq.nominees_only ? "지명 기관에만 안내" : "",
    needsCda(rfq.confidentiality) ? "CDA 필요" : "",
  ].filter(Boolean);

  // 진행 이력: 상태 단계 + 이벤트 시각
  const eventAt = (kind: string) => d.events.filter((e) => e.kind === kind).at(-1)?.created_at;
  const whenOf: Record<string, string | undefined> = {
    received: rfq.created_at,
    distributed: rfq.distributed_at ?? eventAt("distributed"),
    quoted: eventAt("quote_submitted"),
    compared: rfq.compared_at ?? undefined,
    selected: d.award?.awarded_at,
    contracting: d.award?.contract_reported_at ?? undefined,
    closed: rfq.closed_at ?? undefined,
  };

  return (
    <>
      <Crumb href="/app" label="내 요청" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", letterSpacing: ".04em" }}>{rfq.rfq_no}</span>
          <h1>{rfq.substance}</h1>
          <p>{rfq.categories.join(" · ")}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <StatusPill tone={statusTone(rfq.status)}>{statusLabel(rfq.status, rfq.outcome)}</StatusPill>
            {chips.map((c) => (
              <span key={c} className="tag">{c}</span>
            ))}
          </div>
        </div>
        <div className="ph__actions"><Link href={`/app/support?rfq=${rfq.rfq_no}`} className="b2">이 요청 문의하기</Link>
          {/* 넓은 화면은 위쪽 버튼, 좁은 화면은 바닥에 붙는 아래 버튼 하나만 보인다 */}
          {canCompare && <Link href={`/app/r/${rfq.rfq_no}/compare`} className="b1 only-wide">견적 {submitted}건 비교</Link>}
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card" style={{ padding: "20px 20px 8px" }}>
          <h2 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>진행 상태</h2>
          <div className="tl">
            {stages.map((st, i) => {
              const state = i < idx ? 2 : i === idx ? 1 : 0;
              const when = whenOf[st.key];
              return (
                <div key={st.key} className="tl__row">
                  <div className="tl__rail">
                    <span className={`tl__dot${state === 2 ? " tl__dot--done" : state === 1 ? " tl__dot--now" : ""}`}>{state === 2 && <CheckMark size={12} />}</span>
                    {i < stages.length - 1 && <span className={`tl__line${state === 2 ? " tl__line--done" : ""}`} />}
                  </div>
                  <div className="tl__body">
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span className={`tl__t${state ? "" : " tl__t--off"}`}>{st.label}</span>
                      {state === 1 && <span className="tl__d">{st.desc}</span>}
                      {st.key === "quoted" && state >= 1 && joinedCount > 0 && <span className="tl__d tnum">참여 {joinedCount}곳 중 {submitted}곳 제출</span>}
                    </div>
                    <span className="tl__when tnum">{when ? mdhm(when) : state === 1 && st.key === "quoted" && rfq.reply_by ? `기한 ${md(rfq.reply_by)}` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack">
          <div className="card" style={{ padding: 18 }}>
            <div className="sec-title" style={{ margin: "0 0 10px" }}>
              <h2>회신 현황 <span className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>{seatLine}</span></h2>
              <span className="tnum">{rfq.reply_by ? `회신 기한 ${md(rfq.reply_by)}` : ""}</span>
            </div>
            {!rfq.started_at && rfq.status === "received" ? (
              <div style={{ fontSize: 14, color: "var(--muted)" }}>
                아직 기관에 참여 안내를 보내지 않았습니다. 첨부를 다시 올린 뒤 보내거나, 지금 있는 첨부로 바로 보낼 수 있습니다.
                <StartNow no={rfq.rfq_no} />
              </div>
            ) : d.invites.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>
                {rfq.started_at && !ended
                  ? "요청 분야에 바로 맞는 참여 기관이 없어 운영자가 안내할 기관을 확인하고 있습니다. 보통 영업일 1~2일 안에 결과를 알려 드립니다."
                  : "참여 안내를 보낸 기관이 없습니다."}
              </p>
            ) : !named ? (
              <div className="stack" style={{ gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <div style={{ padding: "10px 12px", background: "var(--sf)", borderRadius: 10 }}>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>참여</span>
                    <b className="tnum" style={{ fontSize: 18 }}>{seats.cap == null ? `${joinedCount}곳` : `${joinedCount}/${seats.cap}곳`}</b>
                  </div>
                  <div style={{ padding: "10px 12px", background: "var(--sf)", borderRadius: 10 }}>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>제출</span>
                    <b className="tnum" style={{ fontSize: 18 }}>{submitted}곳</b>
                  </div>
                </div>
                {nominees.length > 0 && (
                  <div className="stack" style={{ gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>지명한 기관</span>
                    {nominees.map((i) => (
                      <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--sf)", borderRadius: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{i.cro_name}</span>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>{nomineeLabel(i)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ended ? (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>비교표가 열리기 전에 마무리한 요청이라 기관 이름과 견적은 공개되지 않습니다.</p>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    {rfq.reply_by ? `비교표는 회신 기한(${md(rfq.reply_by)}) 다음 날 오전 9시에 열립니다. ` : ""}
                    참여 결정이 끝난 뒤 참여한 기관이 모두 제출하면 더 빨리 열립니다. 그 전에는 숫자만 보이고, 기관 이름과 견적은 비교표에서 함께 공개됩니다.
                    {seats.reserved > 0 && joinBy ? ` 지명 기관 몫 ${seats.reserved}곳은 참여 결정 기한(${md(joinBy)})까지 비워 둡니다.` : joinBy ? ` 참여 결정 기한은 ${md(joinBy)}입니다.` : ""}
                  </p>
                )}
              </div>
            ) : shown.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>참여한 기관이 없습니다.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {shown.map((i) => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--sf)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: i.status === "submitted" ? "var(--brand)" : "var(--dash)" }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{i.cro_name}</span>
                      {i.source === "nominated" && <span className="pill pill--tint">지명</span>}
                    </div>
                    <span style={{ fontSize: 13, color: i.status === "submitted" ? "var(--ink)" : "var(--muted)" }}>{inviteStageLabel(i)}</span>
                  </div>
                ))}
              </div>
            )}
            {opened && !d.award && !ended && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
                {submitted > 0 ? "비교표가 열렸습니다. 도착한 견적은 더 바뀌지 않습니다. 비교표에서 기관을 선택해 주세요." : "비교표가 열렸지만 도착한 견적이 없습니다."}
              </p>
            )}
          </div>

          {!d.award && !rfq.selected_quote_id && ["received", "distributed", "quoted", "compared"].includes(rfq.status) && <OutcomeForm no={rfq.rfq_no} compared={canCompare} />}
          {!d.award && rfq.outcome && (
            <div className="note" style={{ flexDirection: "column", gap: 4 }}>
              <b>선정 없이 마무리 · {rfq.outcome}{rfq.outcome_at ? ` · ${ymd(rfq.outcome_at)}` : ""}</b>
              {rfq.outcome_note && <span>{rfq.outcome_note}</span>}
              {reopenUntil && <ReopenRequest no={rfq.rfq_no} until={reopenUntil} />}
            </div>
          )}
          {d.award && (
            <div className="note note--ok" style={{ flexDirection: "column", gap: 4 }}>
              <b>{d.award.cro_name} 선정 · {ymd(d.award.awarded_at)}</b>
              <span>
                {confirmedAt && reported
                  ? `계약 확정 · ${d.award.contract_date ? ymd(d.award.contract_date) : ""} · ${won(d.award.contract_amount ?? 0)}${viaNote}`
                  : disputeOpen
                    ? "계약 보고에 남기신 의견을 운영자가 기관과 확인하고 있습니다. 확인을 마칠 때까지 계약을 확정하지 않습니다."
                    : reported && d.award.contract_status === "signed"
                      ? "기관이 계약 체결을 보고했습니다. 아래에서 내용을 확인해 주세요."
                      : "서로 연락처를 주고받았습니다. 계약은 기관과 직접 진행합니다."}
              </span>
              {croContact && (
                <span>
                  기관 담당 {[croContact.name, croContact.email, croContact.phone].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          )}
          {d.award && (
            <div className="note note--tint" style={{ flexDirection: "column", gap: 4 }}>
              <b>시험물질 필요량</b>
              {d.award.substance_qty ? (
                <span>
                  {[d.award.substance_qty, d.award.substance_when && `보낼 시점 ${d.award.substance_when}`].filter(Boolean).join(" · ")}
                  {d.award.substance_note ? <span style={{ display: "block" }}>{d.award.substance_note}</span> : null}
                </span>
              ) : (
                <span>{d.award.cro_name}에 시험물질 정보를 보내면 기관이 필요량과 보낼 시점을 여기에 적습니다.</span>
              )}
            </div>
          )}
          {needsConfirm && d.award && (
            <ContractConfirm
              no={rfq.rfq_no}
              cro={d.award.cro_name}
              date={d.award.contract_date ? ymd(d.award.contract_date) : "-"}
              amount={won(d.award.contract_amount ?? 0)}
              autoOn={autoOn}
            />
          )}

          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>요청 내용</div>
            {[
              ["의뢰 목적", rfq.purpose],
              ["요청 성격", rfq.intent],
              ["개발 분야", p.devField],
              ["희망 착수", p.start],
              ["예산", rfq.budget],
              ["지명 기관", Array.isArray(p.nominees) && p.nominees.length ? (p.nominees as string[]).join(", ") : ""],
              ["안내 범위", rfq.nominees_only ? "지명 기관에만 안내" : ""],
              ["기밀 등급", rfq.confidentiality],
              ["접수일", ymd(rfq.created_at)],
              ["상세 입력", rfq.submitted_step === 2 ? "완료" : "기본 정보만"],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={String(k)} className="kv">
                  <span className="kv__k">{k}</span>
                  <span className="kv__v">{String(v)}</span>
                </div>
              ))}
            {d.files.length > 0 && (
              <div className="kv" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <span className="kv__k">첨부</span>
                {d.files.map((f) => (
                  <a key={f.id} href={`/api/files/${f.id}`} style={{ fontSize: 14 }}>
                    {f.file_name} <span style={{ color: "var(--muted)" }}>· {(f.size_bytes / 1024 / 1024).toFixed(1)}MB</span>
                    {!f.uploaded_at && <span className="pill pill--warn" style={{ marginLeft: 6 }}>업로드 안 됨</span>}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* 첨부는 기관을 고르기 전까지만 고친다. 선정 뒤 자료는 선택한 기관과 직접 주고받는다 */}
          {!d.award && !["closed", "cancelled"].includes(rfq.status) && <div className="card card--pad"><AttachmentRetry no={rfq.rfq_no} /></div>}
          <details className="card" style={{ padding: "0 18px" }}>
            <summary style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>입력한 전체 항목 보기</summary>
            <div className="card--rows" style={{ padding: "0 0 8px" }}>
              {Object.entries(labels)
                .filter(([id]) => {
                  const v = p[id];
                  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v;
                })
                .map(([id, label]) => (
                  <div key={id} className="kv" style={{ fontSize: 13 }}>
                    <span className="kv__k">{label}</span>
                    <span className="kv__v" style={{ fontWeight: 500 }}>{Array.isArray(p[id]) ? (p[id] as string[]).join(", ") : String(p[id])}</span>
                  </div>
                ))}
            </div>
          </details>
        </div>
      </div>

      {canCompare && (
        <div className="cta only-narrow">
          <Link href={`/app/r/${rfq.rfq_no}/compare`} className="b1 blg bfull">견적 {submitted}건 비교하기</Link>
        </div>
      )}
    </>
  );
}

/**
 * 의뢰자 화면에 보일 초대 (0023): 참여한 기관(참여·작성 중·제출, 철회·취소 제외)과 지명 기관(결과와 함께).
 * 일반 기관의 참여 결정 전·불참·철회는 보이지 않는다 (설계 규칙표 "불참", "지명 기관")
 */
function sponsorVisibleInvites<T extends { source?: string | null; status: string; joined_at?: string | null; withdrawn_at?: string | null; revoked_at?: string | null }>(invites: T[]): T[] {
  return invites.filter((i) => i.source === "nominated" || occupiesSeat(i) || (i.status === "submitted" && !i.revoked_at) || (!!i.joined_at && !i.withdrawn_at && !i.revoked_at));
}

/** 지명 기관의 참여 여부 (비교표가 열리기 전 의뢰자 화면): 참여 · 불참 · 결정 전 */
function nomineeLabel(i: Parameters<typeof inviteStage>[0]): string {
  const st = inviteStage(i);
  if (st === "joined" || st === "draft" || st === "submitted") return "참여";
  // 안내가 끝난(취소·만료) 지명 기관도 의뢰자에게는 불참으로 보인다 (2026-10-20 결정 1: 참여 · 불참 · 결정 전 세 가지)
  if (st === "declined" || st === "withdrawn" || st === "ended") return "불참";
  return "결정 전";
}
