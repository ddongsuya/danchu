import { mailMissing, stuckReasons } from "@/lib/stuck";
import { needsCda, participation, participationLabel, seatState, seatsDetailLabel } from "@/lib/request-policy";
import { CdaPanel } from "@/components/admin/CdaPanel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, listCroOrgs } from "@/lib/data";
import { contractConfirmState, inviteStageLabel, statusLabel, statusTone } from "@/lib/status";
import { proxyEntryAllowed } from "@/lib/concierge";
import { StatusPill } from "@/components/app/ui";
import { DistributePanel } from "@/components/admin/DistributePanel";
import { AdminActions } from "@/components/admin/AdminActions";
import { DeadlineForm } from "@/components/admin/DeadlineForm";
import { JoinByForm } from "@/components/admin/JoinByForm";
import { InviteActions } from "@/components/admin/InviteActions";
import { RequestTerms } from "@/components/admin/RequestTerms";
import { ContractRecord } from "@/components/admin/ContractRecord";
import { DisputeResolve } from "@/components/admin/DisputeResolve";
import { RequestFrame, requestTabOf } from "@/components/admin/RequestFrame";
import { AdminSection } from "@/components/admin/Blocks";
import { EmptyState } from "@/components/ui/EmptyState";
import { todaySeoul } from "@/lib/format";
import { labelMap } from "@/lib/rfq-schema";
import { quoteRowsFromPayload } from "@/lib/quote-items";
import { addBusinessDays, nowSeoul } from "@/lib/dates";
import { dday, md, mdhm, won, ymd } from "@/lib/format";
import { beforeDeadline, pendingInvites } from "@/lib/reply-window";
import { testNamesOf } from "@/lib/quote-items";
import type { Values } from "@/lib/rfq-schema";
import { captureError } from "@/lib/observe";
import { CONTRACT_WAIT_DAYS } from "@/lib/stuck";
import { MemoForm } from "@/components/admin/AdminActions";
import { ErrorState } from "@/components/ui/ErrorState";

export const dynamic = "force-dynamic";

export default async function AdminRfq({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireSession("admin");
  const { no } = await params;
  const tab = requestTabOf((await searchParams).tab);
  const rfq = await getRfqByNo(no);
  if (!rfq) notFound();
  const tests = testNamesOf(rfq.payload as Values) || rfq.substance;
  const frame = { no: rfq.rfq_no, substance: tests, company: rfq.company, createdAt: rfq.created_at, showCda: needsCda(rfq.confidentiality) };
  // 불러오기 실패는 제목 줄과 탭을 둔 채 본문 자리에만 알린다 (시안 a-r~err)
  const loaded = await Promise.all([getRfqDetail(rfq), listCroOrgs("approved")]).catch((e: unknown) => { captureError(e, "admin:request-detail", { no }); return null; });
  if (!loaded) {
    return (
      <RequestFrame {...frame} tags={null} stuck={[]} tab={tab === "cda" && !frame.showCda ? "" : tab}>
        <ErrorState title="요청을 불러오지 못했어요" />
      </RequestFrame>
    );
  }
  const [d, orgs] = loaded;
  const p = rfq.payload;
  const labels = labelMap();
  const submitted = d.invites.filter((i) => i.status === "submitted");
  const defaultReplyBy = rfq.reply_by || addBusinessDays(nowSeoul(), 7).toLocaleDateString("sv-SE");
  const invitedOrgIds = new Set(d.invites.map((i) => i.cro_org_id).filter(Boolean));
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
  const cda = needsCda(rfq.confidentiality);

  const tags = (
    <>
      <StatusPill tone={statusTone(rfq.status)}>{statusLabel(rfq.status, rfq.outcome)}</StatusPill>
      <span className="tag">{rfq.purpose ?? "목적 미입력"}</span>
      <span className="tag">{rfq.confidentiality ?? "일반"}</span>
      <span className="tag">참여 자리 {rfq.cro_count ?? "-"}</span>
      {Array.isArray(p.nominees) && p.nominees.length > 0 && <span className="tag">지명 {(p.nominees as string[]).join(", ")}</span>}
      {rfq.submitted_step === 2 && <span className="tag">상세 입력</span>}
      {d.files.length > 0 && <span className="tag">첨부 {d.files.length}</span>}
    </>
  );

  // 회신 기한 변경은 제목 줄 오른쪽 (시안 a-r · a-r-hist). 비교표가 열린 뒤 · 선정 뒤 · 종료 뒤에는 없다 (deadline 라우트 31~40줄)
  const deadlineButton = (primary: boolean) => canChangeDeadline && !done ? <DeadlineForm no={rfq.rfq_no} current={rfq.reply_by} min={rfq.distributed_at && rfq.reply_by && nextDay(rfq.reply_by) > today ? nextDay(rfq.reply_by) : today} invited={d.invites.filter((i) => !i.revoked_at).length} distributed={!!rfq.distributed_at} primary={primary} /> : null;
  const dd = rfq.reply_by ? dday(rfq.reply_by) : null;
  const manageRows: [string, string][] = [
    ["상태", statusLabel(rfq.status, rfq.outcome)],
    ["회신 기한", rfq.reply_by ? `${md(rfq.reply_by)}${rfq.compared_at ? ` (회신 마감 ${mdhm(rfq.compared_at)})` : dd ? ` (${dd.n < 0 ? `${-dd.n}일 지남` : dd.label})` : ""}` : "-"],
    ...(joinBy ? [["참여 결정 기한", `${md(joinBy)}${rfq.join_by && new Date(rfq.join_by).getTime() < Date.now() ? " (지남)" : ""}`] as [string, string]] : []),
    ["보낸 기관", `${d.invites.length}곳`],
    ["참여 자리", seatsDetailLabel(seats)],
    ["기밀 등급", rfq.confidentiality ?? "일반"],
  ];

  const replies = (
    <div className="adm-split">
      <div className="adm-col">
        <AdminSection id="replies" title="회신 현황" count={`${participationLabel(counts)} · 제출 ${counts.submitted} · 안내 ${d.invites.length}`} >
          {joinBy && (
            <div className="adm-line adm-sec__sub">
              <span className="tnum">참여 결정 기한 {md(joinBy)}</span>
              {canExtendJoin && <JoinByForm no={rfq.rfq_no} current={joinBy} min={today} max={rfq.reply_by} extended={!!rfq.join_by_extended_at} />}
            </div>
          )}
          {d.invites.length === 0 ? (
            <EmptyState title="보낸 참여 안내가 없어요" action={done ? undefined : <Link href={`/admin/r/${rfq.rfq_no}?tab=dist`} className="b2 bsm">참여 안내</Link>} />
          ) : (
            <div className="card tbl-wrap">
              {/* 휴대폰 폭에서는 행을 카드처럼 세운다 (tbl--stack, 칸 이름은 data-label) */}
              <table className="tbl tbl--stack">
                <thead>
                  <tr><th>기관</th><th>상태</th><th>참여</th><th>열람</th><th className="num">총액 · 기간</th><th>링크</th></tr>
                </thead>
                <tbody>
                  {d.invites.map((i) => {
                    const q = d.quotes.find((x) => x.invite_id === i.id);
                    return (
                      <tr key={i.id}>
                        <td>
                          <span className="strong">{i.cro_name}</span>
                          <span className="sub">{i.cro_email} · 기한 {i.reply_by}{mailMissing(i) ? <span className="pill pill--warn" style={{ marginLeft: 6 }}>메일 미발송</span> : null}</span>
                        </td>
                        <td data-label="상태">
                          <span className="adm-tags adm-tags--cell">
                            <span className={`pill ${i.status === "submitted" ? "pill--ok" : i.status === "declined" ? "pill--err" : i.status === "draft" ? "pill--warn" : "pill--sf"}`}>{inviteStageLabel(i)}</span>
                            {i.source === "nominated" && <span className="pill pill--tint">지명</span>}
                            {q?.status === "submitted" && q.entry_source === "operator" && <span className="pill pill--sf">대리 입력</span>}
                          </span>
                          {i.decline_reason && <span className="sub">{i.decline_reason}</span>}
                        </td>
                        <td data-label="참여" className="tnum adm-small" title={i.join_terms_version ? `조건 판 ${i.join_terms_version}` : undefined}>{joinCell(i)}</td>
                        <td data-label="열람" className="tnum adm-small">{i.opened_at ? mdhm(i.opened_at) : "-"}</td>
                        <td data-label="총액 · 기간" className="num">{q?.status === "submitted" ? `${won(q.total_amount ?? 0)} · ${q.total_weeks ?? "-"}주` : "-"}{q?.pdf_path && <> · <a href={`/api/quotes/${q.id}/pdf`}>PDF</a></>}</td>
                        <td data-label="링크" className="adm-small">
                          {proxyEntryAllowed(i) ? (
                            <a href={`/q/${i.token}`} target="_blank" rel="noopener noreferrer" title="기관이 보낸 견적서 PDF를 대신 입력합니다. 운영자가 연 것은 기관 열람으로 기록되지 않습니다.">대신 입력</a>
                          ) : i.revoked_at ? (
                            <span className="sub">취소됨</span>
                          ) : (
                            // 참여 전에는 회신 링크(토큰)를 내보내지 않는다. 운영자 전용 요약 화면으로 연다 (운영자는 대신 참여할 수 없다)
                            <Link href={`/admin/r/${rfq.rfq_no}/offer/${i.id}`} title="기관이 참여하기 전이라 요약만 보입니다. 운영자는 대신 참여하거나 견적을 입력할 수 없습니다. 기관에 링크를 다시 보내려면 메일 재발송을 써 주세요.">요약 보기</Link>
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
        </AdminSection>
      </div>

      <div className="adm-col">
        <section className="card adm-box" aria-labelledby="manage-h">
          <h2 id="manage-h" className="adm-box__h">진행 관리</h2>
          <dl className="adm-dl">{manageRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>)}</dl>
          {!done && <RequestTerms no={rfq.rfq_no} croCount={rfq.cro_count} confidentiality={rfq.confidentiality} />}
          <AdminActions
            no={rfq.rfq_no}
            status={rfq.status}
            submitted={submitted.length}
            pending={pendingInvites(d.invites)}
            early={beforeDeadline(rfq.reply_by)}
            closed={!!rfq.compared_at}
            award={d.award ? { cro: d.award.cro_name, at: ymd(d.award.awarded_at), contract: d.award.contract_reported_at ? `${d.award.contract_date} · ${won(d.award.contract_amount ?? 0)}` : "" } : null}
          />
        </section>

        <section className="card adm-box" aria-labelledby="memo-h">
          <h2 id="memo-h" className="adm-box__h">운영 메모 (내부용)</h2>
          <MemoForm no={rfq.rfq_no} note={rfq.admin_note ?? ""} />
        </section>

        <div className="card card--rows">
          <div className="adm-cap">의뢰자</div>
          {[["회사", rfq.company], ["담당자", `${rfq.contact_name}${p.dept ? ` · ${p.dept}` : ""}`], ["이메일", rfq.email], ["전화", rfq.phone ?? "-"], ["기관 유형", rfq.org_type ?? "-"], ["계정", rfq.user_id ? "연결됨" : "미가입"]].map(([k, v]) => (
            <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>
          ))}
        </div>

        <div className="card card--rows">
          <div className="adm-cap">회신 표 행 <span className="tnum">{rows.length}</span></div>
          {rows.map((r) => (
            <div key={r.seq} className="adm-row">
              <b>{r.name}</b> <span className="adm-row__cat">{r.category}</span>
              {r.cond && <span className="sub">{r.cond}</span>}
            </div>
          ))}
        </div>

        {d.files.length > 0 && (
          <div className="card card--rows">
            <div className="adm-cap">첨부</div>
            {d.files.map((f) => (
              <div key={f.id} className="kv"><a href={`/api/files/${f.id}`}>{f.file_name}{!f.uploaded_at && <span className="pill pill--warn" style={{ marginLeft: 6 }}>업로드 안 됨</span>}</a><span className="tnum adm-small">{(f.size_bytes / 1024 / 1024).toFixed(1)}MB</span></div>
            ))}
          </div>
        )}

        <details className="card adm-more">
          <summary>입력한 전체 항목</summary>
          <div className="card--rows adm-more__rows">
            {Object.entries(labels)
              .filter(([id]) => { const v = p[id]; return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v; })
              .map(([id, label]) => (
                <div key={id} className="kv adm-small">
                  <span className="kv__k">{label}</span>
                  <span className="kv__v" style={{ fontWeight: 500 }}>{Array.isArray(p[id]) ? (p[id] as string[]).join(", ") : String(p[id])}</span>
                </div>
              ))}
          </div>
        </details>
      </div>
    </div>
  );

  const inviteOf = new Map(d.invites.filter((i) => i.cro_org_id).map((i) => [i.cro_org_id as string, i]));
  const distribute = (
    <>
      {done ? (
        <EmptyState title="마무리한 요청이에요" />
      ) : (
        <DistributePanel
          no={rfq.rfq_no}
          categories={rfq.categories}
          defaultReplyBy={defaultReplyBy}
          replyByLocked={!!rfq.reply_by}
          nomineesOnly={!!rfq.nominees_only}
          orgs={orgs.map((o) => ({ id: o.id, name: o.name, categories: o.categories, glp: o.glp_certs, email: o.contact_email, members: o.members, invited: invitedOrgIds.has(o.id), managed: !!o.managed, sentAt: inviteOf.get(o.id)?.sent_at ?? null, openedAt: inviteOf.get(o.id)?.opened_at ?? null }))}
          today={today}
          autoDistribute={rfq.auto_distribute !== false}
        />
      )}
    </>
  );

  const award = d.award;
  const awardEmail = d.invites.find((i) => i.id === d.quotes.find((q) => q.id === award?.quote_id)?.invite_id)?.cro_email;
  const contract = !award ? (
    <EmptyState title="선정한 기관이 없어요" />
  ) : (
    <div className="adm-split">
      <div className="adm-col">
        <AdminSection id="contract" title="계약 기록">
          <ContractRecord awardId={award.id} status={award.contract_status} reported={!!award.contract_reported_at} today={today} minDate={new Date(award.awarded_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })} note={award.contract_note} quoteAmount={award.fee_basis_amount ?? d.quotes.find((x) => x.id === award.quote_id)?.total_amount ?? null} />
          {award.requester_disputed_at && !award.dispute_resolved_at && !award.contract_confirmed_at ? <div style={{ marginTop: 12 }}><DisputeResolve awardId={award.id} rfqNo={rfq.rfq_no} report={award.contract_reported_at ? `${won(award.contract_amount ?? 0)} · 계약일 ${md(award.contract_date)} · ${md(award.contract_reported_at)} 보고` : ""} dispute={award.requester_dispute_note} /></div> : null}
        </AdminSection>
      </div>
      <div className="adm-col">
        <div className="card card--rows">
          {(() => {
            // 계약 확인 (2026-10-20 결정 2, 0025): 의뢰자 확인·이의·7일 뒤 자동 확정. 계약 보고 기한은 선정 뒤 14일 (lib/contract-reminder.ts)
            const cs = award.contract_reported_at ? contractConfirmState(award) : null;
            const due = new Date(new Date(award.awarded_at).getTime() + CONTRACT_WAIT_DAYS * 864e5).toISOString();
            const dueD = dday(due.slice(0, 10));
            const amount = award.fee_basis_amount ?? d.quotes.find((x) => x.id === award.quote_id)?.total_amount ?? null;
            return [
              ["선정 기관", award.cro_name],
              ["선정일", md(award.awarded_at)],
              ["선정 금액", amount != null ? won(amount) : "-"],
              ...(!award.contract_reported_at ? [["계약 보고 기한", `${md(due)} (${dueD.n < 0 ? `${-dueD.n}일 지남` : dueD.label})`]] : []),
              ["계약 보고", award.contract_reported_at ? `${award.contract_date} · ${won(award.contract_amount ?? 0)}` : "없음"],
              ...(cs ? [["계약 확인", cs.label]] : []),
            ].map(([k, v]) => <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v tnum">{v}</span></div>);
          })()}
        </div>
        {!award.contract_reported_at && awardEmail && (
          <section className="card adm-box" aria-labelledby="todo-h">
            <h2 id="todo-h" className="adm-box__h">조치</h2>
            <div className="kv"><span><b className="strong">기관에 확인</b><span className="adm-sub">{award.cro_name}</span></span><a className="b2 bsm" href={`mailto:${awardEmail}?subject=${encodeURIComponent(`[단추] ${rfq.rfq_no} 계약 진행 확인`)}`}>기관에 메일</a></div>
          </section>
        )}
      </div>
    </div>
  );

  const history = (
    <AdminSection id="history" title="이력" count={d.events.length} actions={<span className="adm-head-acts"><Link href={`/admin/r/${rfq.rfq_no}/qna`} className="b2 bsm">질의응답 기록</Link>{deadlineButton(true)}</span>}>
      {d.events.length === 0 ? (
        <EmptyState title="기록이 없어요" />
      ) : (
        <div className="card card--rows adm-events">
          {[...d.events].reverse().map((e) => (
            <div key={e.id}>
              <time dateTime={e.created_at}>{mdhm(e.created_at)}</time>
              <span><b>{e.title}</b>{e.body ? <span> · {e.body}</span> : null}</span>
            </div>
          ))}
        </div>
      )}
    </AdminSection>
  );

  const body = tab === "dist" ? distribute
    : tab === "cda" && cda ? <CdaPanel no={rfq.rfq_no} files={d.files.length} invites={d.invites.map((i) => ({ id: i.id, cro_name: i.cro_name, cda_signed_at: i.cda_signed_at, joined_at: i.joined_at }))} />
    : tab === "contract" ? contract
    : tab === "hist" ? history
    : replies;

  return (
    <RequestFrame {...frame} tags={tags} stuck={stuckReasons(rfq, d.invites, d.award, today)} tab={tab === "cda" && !cda ? "" : tab} actions={tab === "hist" ? null : deadlineButton(false)}>
      {body}
    </RequestFrame>
  );
}

/** 운영자 화면 "참여" 칸 (0023): 참여 시각과 경로(포털·링크·도입 전), 철회 시각. 참여 기록은 기관이 직접 누른 것만 있다 */
function joinCell(i: { joined_at: string | null; join_channel: string | null; withdrawn_at: string | null }): string {
  if (!i.joined_at) return "-";
  const via = i.join_channel === "portal" ? "기관 계정" : i.join_channel === "token" ? "링크" : i.join_channel === "legacy" ? "도입 전" : "";
  return `${mdhm(i.joined_at)}${via ? ` · ${via}` : ""}${i.withdrawn_at ? ` · 철회 ${mdhm(i.withdrawn_at)}` : ""}`;
}

/** 'YYYY-MM-DD' 다음 날. 배포한 요청의 회신 기한은 늘리기만 되므로 날짜 칸의 최솟값으로 쓴다 */
function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
