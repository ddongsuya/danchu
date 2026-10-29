import { needsCda, participation, participationLabel, seatState, seatsDetailLabel } from "@/lib/request-policy";
import { CdaPanel } from "@/components/admin/CdaPanel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, listCroOrgs } from "@/lib/data";
import { contractConfirmState, inviteStageLabel, statusLabel, statusTone } from "@/lib/status";
import { proxyEntryAllowed } from "@/lib/concierge";
import { Crumb, StatusPill } from "@/components/app/ui";
import { DistributePanel } from "@/components/admin/DistributePanel";
import { AdminActions } from "@/components/admin/AdminActions";
import { DeadlineForm } from "@/components/admin/DeadlineForm";
import { JoinByForm } from "@/components/admin/JoinByForm";
import { InviteActions } from "@/components/admin/InviteActions";
import { RequestTerms } from "@/components/admin/RequestTerms";
import { ContractRecord } from "@/components/admin/ContractRecord";
import { DisputeResolve } from "@/components/admin/DisputeResolve";
import { todaySeoul } from "@/lib/format";
import { labelMap } from "@/lib/rfq-schema";
import { quoteRowsFromPayload } from "@/lib/quote-items";
import { addBusinessDays, nowSeoul } from "@/lib/dates";
import { md, mdhm, won, ymd } from "@/lib/format";
import { beforeDeadline, pendingInvites } from "@/lib/reply-window";

export const dynamic = "force-dynamic";

export default async function AdminRfq({ params }: { params: Promise<{ no: string }> }) {
  await requireSession("admin");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq) notFound();
  const [d, orgs] = await Promise.all([getRfqDetail(rfq), listCroOrgs("approved")]);
  const p = rfq.payload;
  const labels = labelMap();
  const submitted = d.invites.filter((i) => i.status === "submitted");
  const defaultReplyBy = rfq.reply_by || addBusinessDays(nowSeoul(), 7).toLocaleDateString("sv-SE");
  const invitedOrgIds = new Set(d.invites.map((i) => i.cro_org_id).filter(Boolean));
  const managedIds = new Set(orgs.filter((o) => o.managed).map((o) => o.id));
  const rows = quoteRowsFromPayload(p);
  const today = todaySeoul();
  // 회신 기한은 비교표가 열리기 전에만 바꾼다. 열린 비교표는 다시 열거나 기한을 늘릴 수 없다 (2026-10-21 결정 3, deadline 라우트 409 · 0026 트리거)
  const canChangeDeadline = ["received", "distributed", "quoted"].includes(rfq.status) && !rfq.compared_at && !rfq.selected_quote_id;
  const done = rfq.status === "closed" || rfq.status === "cancelled";
  // 참여 자리 (0023): 참여·작성 중·제출을 세고, 참여 결정 기한 전에는 아직 결정하지 않은 지명 기관 몫을 비워 둔다
  const seats = seatState(rfq.cro_count, rfq.join_by, d.invites);
  const counts = participation(rfq.cro_count, d.invites);
  const joinBy = rfq.join_by ? new Date(rfq.join_by).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : null;
  const canExtendJoin = !!joinBy && ["distributed", "quoted"].includes(rfq.status) && !rfq.compared_at && !rfq.selected_quote_id;

  return (
    <>
      <Crumb href="/admin" label="접수 현황" />
      <div className="ph">
        <div>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{rfq.rfq_no} · 접수 {ymd(rfq.created_at)}</span>
          <h1>{rfq.substance} · {rfq.company}</h1>
          <p>{rfq.categories.join(" · ")} · {rfq.purpose ?? "-"} · {rfq.confidentiality ?? "일반"} · 참여 자리 {rfq.cro_count ?? "-"}{Array.isArray(p.nominees) && p.nominees.length ? ` · 지명 ${(p.nominees as string[]).join(", ")}` : ""}</p>
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <StatusPill tone={statusTone(rfq.status)}>{statusLabel(rfq.status, rfq.outcome)}</StatusPill>
            {rfq.submitted_step === 2 && <span className="tag">상세 입력</span>}
            {d.files.length > 0 && <span className="tag">첨부 {d.files.length}</span>}
          </div>
        </div>
        <div className="ph__actions">
          <Link href={`/app/r/${rfq.rfq_no}`} className="b2 bsm">의뢰자 화면으로 보기</Link>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>참여 안내 추가{rfq.nominees_only && <span className="pill pill--warn" style={{ marginLeft: 8 }}>지명 기관에만 안내</span>}</h2>
            {rfq.status === "cancelled" || rfq.status === "closed" ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>종료된 요청입니다.</p>
            ) : (
              <DistributePanel
                no={rfq.rfq_no}
                categories={rfq.categories}
                defaultReplyBy={defaultReplyBy}
                replyByLocked={!!rfq.reply_by}
                nomineesOnly={!!rfq.nominees_only}
                orgs={orgs.map((o) => ({ id: o.id, name: o.name, categories: o.categories, glp: o.glp_certs, email: o.contact_email, members: o.members, invited: invitedOrgIds.has(o.id), managed: !!o.managed }))}
                today={today}
                autoDistribute={rfq.auto_distribute !== false}
              />
            )}
          </div>

          <div className="card card--pad">
            <div className="sec-title" style={{ margin: "0 0 10px" }}>
              <h2>회신 현황 <span className="tnum">{participationLabel(counts)} · 제출 {counts.submitted} · 안내 {d.invites.length}</span></h2>
              <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {rfq.reply_by ? <span>{`기한 ${md(rfq.reply_by)}`}{rfq.compared_at ? <span className="pill pill--sf" style={{ marginLeft: 6 }}>회신 마감 {mdhm(rfq.compared_at)}</span> : rfq.reply_by < today ? <span className="pill pill--warn" style={{ marginLeft: 6 }}>지남</span> : null}</span> : null}
                {canChangeDeadline && <DeadlineForm no={rfq.rfq_no} current={rfq.reply_by} min={rfq.distributed_at && rfq.reply_by && nextDay(rfq.reply_by) > today ? nextDay(rfq.reply_by) : today} />}
              </span>
            </div>
            {joinBy && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                <span className="tnum">참여 결정 기한 {md(joinBy)}{rfq.join_by && new Date(rfq.join_by).getTime() < Date.now() ? " · 지남" : ""} · {seatsDetailLabel(seats)}</span>
                {canExtendJoin && <JoinByForm no={rfq.rfq_no} current={joinBy} min={today} max={rfq.reply_by} extended={!!rfq.join_by_extended_at} />}
              </div>
            )}
            {d.invites.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)" }}>아직 참여 안내를 보내지 않았습니다.</p>
            ) : (
              <div className="tbl-wrap">
                {/* 휴대폰 폭에서는 행을 카드처럼 세운다 (tbl--stack, 칸 이름은 data-label) */}
                <table className="tbl tbl--stack">
                  <thead>
                    <tr><th>기관</th><th>상태</th><th>참여</th><th>열람</th><th>총액 · 기간</th><th>링크</th></tr>
                  </thead>
                  <tbody>
                    {d.invites.map((i) => {
                      const q = d.quotes.find((x) => x.invite_id === i.id);
                      return (
                        <tr key={i.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{i.cro_name}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{i.cro_email} · 기한 {i.reply_by}{!i.mailed_at && ["sent", "draft"].includes(i.status) ? <span className="pill pill--warn" style={{ marginLeft: 6 }}>메일 미발송</span> : null}</div>
                          </td>
                          <td data-label="상태">
                            <span className={`pill ${i.status === "submitted" ? "pill--ok" : i.status === "declined" ? "pill--err" : i.status === "draft" ? "pill--warn" : "pill--sf"}`}>{inviteStageLabel(i)}</span>{i.source === "nominated" && <span className="pill pill--tint" style={{ marginLeft: 6 }}>지명</span>}{q?.status === "submitted" && q.entry_source === "operator" && <span className="pill pill--sf" style={{ marginLeft: 6 }}>대리 입력</span>}
                            {i.decline_reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{i.decline_reason}</div>}
                          </td>
                          <td data-label="참여" className="tnum" style={{ fontSize: 12 }} title={i.join_terms_version ? `조건 판 ${i.join_terms_version}` : undefined}>{joinCell(i)}</td>
                          <td data-label="열람" className="tnum" style={{ fontSize: 12 }}>{i.opened_at ? mdhm(i.opened_at) : "-"}</td>
                          <td data-label="총액 · 기간" className="tnum">{q?.status === "submitted" ? `${won(q.total_amount ?? 0)} · ${q.total_weeks ?? "-"}주` : "-"}{q?.pdf_path && <> · <a href={`/api/quotes/${q.id}/pdf`}>PDF</a></>}</td>
                          <td data-label="링크">
                            {proxyEntryAllowed(i) ? (
                              <a href={`/q/${i.token}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }} title="기관이 보낸 견적서 PDF를 대신 입력합니다. 운영자가 연 것은 기관 열람으로 기록되지 않습니다.">{managedIds.has(i.cro_org_id ?? "") ? "대리 입력" : "회신 링크"}</a>
                            ) : i.revoked_at ? (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>취소됨</span>
                            ) : (
                              // 참여 전에는 회신 링크(토큰)를 내보내지 않는다. 운영자 전용 요약 화면으로 연다 (운영자는 대신 참여할 수 없다)
                              <Link href={`/admin/r/${rfq.rfq_no}/offer/${i.id}`} style={{ fontSize: 12 }} title="기관이 참여하기 전이라 요약만 보입니다. 운영자는 대신 참여하거나 견적을 입력할 수 없습니다. 기관에 링크를 다시 보내려면 메일 재발송을 쓰세요.">요약 보기</Link>
                            )}
                            {["sent", "draft", "submitted"].includes(i.status) && !done && <div style={{ marginTop: 4 }}><InviteActions inviteId={i.id} croName={i.cro_name} canCancel={i.status !== "submitted" && (!!rfq.compared_at || (!i.joined_at && i.status !== "draft"))} /></div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>진행 관리</h2>
            {needsCda(rfq.confidentiality) && <CdaPanel no={rfq.rfq_no} invites={d.invites.map((i) => ({ id: i.id, cro_name: i.cro_name, cda_signed_at: i.cda_signed_at }))} />}
            {!done && <div style={{ marginBottom: 12 }}><RequestTerms no={rfq.rfq_no} croCount={rfq.cro_count} confidentiality={rfq.confidentiality} /></div>}
            <AdminActions
              no={rfq.rfq_no}
              status={rfq.status}
              submitted={submitted.length}
              pending={pendingInvites(d.invites)}
              early={beforeDeadline(rfq.reply_by)}
              closed={!!rfq.compared_at}
              note={rfq.admin_note ?? ""}
              award={d.award ? { cro: d.award.cro_name, at: ymd(d.award.awarded_at), contract: d.award.contract_reported_at ? `${d.award.contract_date} · ${won(d.award.contract_amount ?? 0)}` : "" } : null}
            />
            {d.award && (
              <div style={{ marginTop: 12 }}>
                <ContractRecord awardId={d.award.id} status={d.award.contract_status} reported={!!d.award.contract_reported_at} today={today} minDate={new Date(d.award.awarded_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })} note={d.award.contract_note} />
                {d.award.contract_reported_at && (() => {
                  // 계약 확인 (2026-10-20 결정 2, 0025): 의뢰자 확인·이의·7일 뒤 자동 확정
                  const cs = contractConfirmState(d.award);
                  return cs ? <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", overflowWrap: "anywhere" }}>계약 확인 · <b style={{ fontWeight: 600, color: cs.tone === "warn" ? "var(--warn)" : cs.tone === "ok" ? "var(--ok)" : "var(--ink)" }}>{cs.label}</b></p> : null;
                })()}
                {d.award.requester_disputed_at && !d.award.dispute_resolved_at && !d.award.contract_confirmed_at ? <div style={{ marginTop: 10 }}><DisputeResolve awardId={d.award.id} /></div> : null}
              </div>
            )}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>의뢰자</div>
            {[["회사", rfq.company], ["담당자", `${rfq.contact_name}${p.dept ? ` · ${p.dept}` : ""}`], ["이메일", rfq.email], ["전화", rfq.phone ?? "-"], ["기관 유형", rfq.org_type ?? "-"], ["계정", rfq.user_id ? "연결됨" : "미가입"]].map(([k, v]) => (
              <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>
            ))}
          </div>

          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>회신 표 행 {rows.length}</h2>
            <div className="stack" style={{ gap: 6 }}>
              {rows.map((r) => (
                <div key={r.seq} style={{ padding: "8px 12px", background: "var(--sf)", borderRadius: 10, fontSize: 13 }}>
                  <b style={{ fontWeight: 600 }}>{r.name}</b> <span style={{ color: "var(--brand)" }}>{r.category}</span>
                  {r.cond && <div style={{ color: "var(--muted)" }}>{r.cond}</div>}
                </div>
              ))}
            </div>
          </div>

          {d.files.length > 0 && (
            <div className="card card--rows">
              <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>첨부</div>
              {d.files.map((f) => (
                <div key={f.id} className="kv"><a href={`/api/files/${f.id}`}>{f.file_name}{!f.uploaded_at && <span className="pill pill--warn" style={{ marginLeft: 6 }}>업로드 안 됨</span>}</a><span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{(f.size_bytes / 1024 / 1024).toFixed(1)}MB</span></div>
              ))}
            </div>
          )}

          <details className="card" style={{ padding: "0 18px" }}>
            <summary style={{ padding: "14px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>입력한 전체 항목</summary>
            <div className="card--rows" style={{ padding: "0 0 8px" }}>
              {Object.entries(labels)
                .filter(([id]) => { const v = p[id]; return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v; })
                .map(([id, label]) => (
                  <div key={id} className="kv" style={{ fontSize: 13 }}>
                    <span className="kv__k">{label}</span>
                    <span className="kv__v" style={{ fontWeight: 500 }}>{Array.isArray(p[id]) ? (p[id] as string[]).join(", ") : String(p[id])}</span>
                  </div>
                ))}
            </div>
          </details>

          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>이력</h2>
            <div className="stack" style={{ gap: 8 }}>
              {d.events.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>없음</span>}
              {[...d.events].reverse().map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <span><b style={{ fontWeight: 600 }}>{e.title}</b>{e.body ? <span style={{ color: "var(--muted)" }}> · {e.body}</span> : null}</span>
                  <span className="tnum" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{mdhm(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** 운영자 화면 "참여" 칸 (0023): 참여 시각과 경로(포털·링크·도입 전), 철회 시각. 참여 기록은 기관이 직접 누른 것만 있다 */
function joinCell(i: { joined_at: string | null; join_channel: string | null; withdrawn_at: string | null }): string {
  if (!i.joined_at) return "-";
  const via = i.join_channel === "portal" ? "포털" : i.join_channel === "token" ? "링크" : i.join_channel === "legacy" ? "도입 전" : "";
  return `${mdhm(i.joined_at)}${via ? ` · ${via}` : ""}${i.withdrawn_at ? ` · 철회 ${mdhm(i.withdrawn_at)}` : ""}`;
}

/** 'YYYY-MM-DD' 다음 날. 배포한 요청의 회신 기한은 늘리기만 되므로 날짜 칸의 최솟값으로 쓴다 */
function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
