import { AttachmentRetry } from "@/components/app/AttachmentRetry";
import { OutcomeForm } from "@/components/app/OutcomeForm";
import { NextStep } from "@/components/app/NextStep";
import { ContractConfirm, ReopenRequest, StartNow } from "@/components/app/RequestActions";
import { needsCda, occupiesSeat, participation, participationLabel, seatState, REOPEN_DAYS } from "@/lib/request-policy";
import { getSupabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { DockAfter } from "@/components/app/DockAfter";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { inviteStage, inviteStageLabel } from "@/lib/status";
import { Crumb } from "@/components/app/ui";
import { md, won, ymd } from "@/lib/format";
import { labelMap } from "@/lib/rfq-schema";
import { comparisonOpened } from "@/lib/reply-window";
import { funnel } from "@/lib/request-story";
import { RequestStory } from "@/components/app/RequestStory";

export const dynamic = "force-dynamic";

export default async function RequestDetail({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  // 운영자가 취소한 초대는 숫자에서 뺀다
  // 비교표가 열리기 전 (2026-10-20 결정 1): 의뢰자에게는 합계 숫자(보낸 곳·확인한 곳·참여·제출)만 보인다.
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
  // 요청 이야기 숫자 (보낸 곳·확인한 곳·참여·견적). 합계만 보이고 기관별 불참은 보이지 않는다 (lib/request-story.ts)
  const story = funnel(d.invites);
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
  // 다음 할 일 (2026-10-29 과업 점검 2·5). 의뢰자가 지금 할 수 있는 일 하나를 제목 아래에 둔다
  const todayKst = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const noJoinPastDue = ["distributed", "quoted"].includes(rfq.status) && !rfq.compared_at && !!rfq.reply_by && rfq.reply_by < todayKst && joinedCount === 0;
  const contractOpen = !!d.award && !reported && ["selected", "contracting"].includes(rfq.status);
  const chips = [
    ...(Array.isArray(p.authority) ? (p.authority as string[]) : []),
    rfq.cro_count ? (rfq.cro_count === "전체" ? "참여 자리 제한 없음" : `참여 자리 ${rfq.cro_count}`) : "",
    rfq.nominees_only ? "지명 기관에만 안내" : "",
    needsCda(rfq.confidentiality) ? "CDA 필요" : "",
  ].filter(Boolean);

  // 요청이 기관에 전달된 시각 (예전 요청은 기록에만 남아 있다)
  const distributedAt = rfq.distributed_at ?? d.events.filter((e) => e.kind === "distributed").at(-1)?.created_at ?? null;

  return (
    <>
      <Crumb href="/app" label="내 요청" />
      <RequestStory
        no={rfq.rfq_no}
        substance={rfq.substance}
        categories={rfq.categories}
        status={rfq.status}
        outcome={rfq.outcome}
        started={!!rfq.started_at || rfq.status !== "received"}
        replyBy={rfq.reply_by}
        distributedAt={distributedAt}
        comparedAt={rfq.compared_at}
        award={d.award ? { name: d.award.cro_name, at: d.award.awarded_at, reportedAt: d.award.contract_reported_at ?? null } : null}
        f={story}
        canCompare={canCompare}
        next={
          (noJoinPastDue || contractOpen) && (
            <div className="rs-next">
              {noJoinPastDue && <NextStep no={rfq.rfq_no} kind="no_join" />}
              {contractOpen && d.award && <NextStep no={rfq.rfq_no} kind="contract" cro={d.award.cro_name} croEmail={croContact?.email || undefined} />}
            </div>
          )
        }
      >
        <div className="rs-aside">
          {chips.length > 0 && (
            <div className="rs-tags">
              {chips.map((c) => (
                <span key={c} className="tag">{c}</span>
              ))}
            </div>
          )}
          {!rfq.started_at && rfq.status === "received" ? (
            <div className="rs-aside__p">
              아직 기관에 참여 안내를 보내지 않았어요. 첨부를 다시 올린 뒤 보내거나, 지금 있는 첨부로 바로 보낼 수 있어요.
              <StartNow no={rfq.rfq_no} />
            </div>
          ) : d.invites.length === 0 ? (
            <p className="rs-aside__p">{rfq.started_at && !ended ? "운영자가 안내할 기관을 확인하면 여기에 숫자가 채워져요." : "참여 안내를 보낸 기관이 없어요."}</p>
          ) : !named ? (
            <>
              {nominees.length > 0 && (
                <div className="rs-names" aria-label="지명한 기관">
                  <span className="rs-names__k">지명한 기관</span>
                  {nominees.map((i) => (
                    <span key={i.id} className="rs-name">
                      <b>{i.cro_name}</b>
                      <span>{nomineeLabel(i)}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="rs-aside__p">
                {ended
                  ? "비교표가 열리기 전에 마무리한 요청이라 기관 이름과 견적은 공개되지 않아요."
                  : `${rfq.reply_by ? `비교 보고서는 회신 기한(${md(rfq.reply_by)}) 다음 날 오전 9시에 열려요. ` : ""}참여 결정이 끝난 뒤 참여한 기관이 모두 내면 더 빨리 열려요. 그 전에는 숫자만 보이고, 기관 이름과 견적은 보고서에서 함께 공개돼요.${seats.reserved > 0 && joinBy ? ` 지명 기관 몫 ${seats.reserved}곳은 참여 결정 기한(${md(joinBy)})까지 비워 둬요.` : joinBy ? ` 참여 결정 기한은 ${md(joinBy)}이에요.` : ""}`}
              </p>
            </>
          ) : shown.length === 0 ? (
            <p className="rs-aside__p">참여한 기관이 없어요.</p>
          ) : (
            <>
              <div className="rs-names" aria-label="참여한 기관">
                <span className="rs-names__k">참여한 기관 · {seatLine}</span>
                {shown.map((i) => (
                  <span key={i.id} className="rs-name">
                    <b>{i.cro_name}{i.source === "nominated" && <span className="pill pill--tint">지명</span>}</b>
                    <span>{inviteStageLabel(i)}</span>
                  </span>
                ))}
              </div>
              {opened && !d.award && !ended && (
                <p className="rs-aside__p">{submitted > 0 ? "비교 보고서가 열렸어요. 도착한 견적은 더 바뀌지 않아요. 보고서에서 진행할 기관을 선택해 주세요." : "비교 보고서가 열렸지만 도착한 견적이 없어요."}</p>
              )}
            </>
          )}
        </div>
      </RequestStory>

      {(rfq.outcome || d.award) && <div className="stack rs-status">

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
      </div>}

      <section className="rs-block" aria-labelledby="detail-title">
        <p className="rs-bk">요청 내용</p>
        <h2 id="detail-title" className="rs-h2">보낸 요청서</h2>
        <div className="stack">
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
      </section>

      {!d.award && !rfq.selected_quote_id && ["received", "distributed", "quoted", "compared"].includes(rfq.status) && <div id="end" style={{ marginTop: 24 }}><OutcomeForm no={rfq.rfq_no} compared={canCompare} /></div>}

      {canCompare && !d.award && (
        <DockAfter>
          <Link href={`/app/r/${rfq.rfq_no}/compare`} className="b1 blg bfull">비교 보고서 받아보기</Link>
        </DockAfter>
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
