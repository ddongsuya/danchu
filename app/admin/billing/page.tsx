import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { adjustmentsByOrg, CLOSED_MONTH_NOTE, monthRangeOf, rateLabel, REFERENCE_LABEL, REFERENCE_PER_QUOTE_FEE, REFERENCE_SUCCESS_RATE, REFERENCE_UNIT_LABEL, referenceTotals, signedWon, statementDigest, statementTotals, TIER_LABEL, joinStatusNote, wonOrPending } from "@/lib/billing";
import { BillingClose } from "@/components/admin/BillingClose";
import { BillingAdjustmentForm } from "@/components/admin/BillingAdjustmentForm";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { BillingAdjustmentRow, BillingAwardRow, BillingLineRow, BillingReferenceRow, BillingSnapshot, BillingSummaryRow } from "@/lib/db-types";
import { comma, won, ymd } from "@/lib/format";
import { BillableToggle } from "@/components/admin/BillableToggle";
import { ManagedBadge } from "@/components/admin/ManagedBadge";
import { CONTRACT_STATUS_LABEL } from "@/lib/concierge";

export const dynamic = "force-dynamic";

const muted = { fontSize: 12, color: "var(--muted)" } as const;
const cardHead = { padding: "14px 16px 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" } as const;

/**
 * 월별 청구 명세 (0020 기준). 청구 단위는 기관이 제출한 견적 1건이고, 그 견적을 처음 제출한 달에 한 번 센다.
 * 1,000만 원 미만은 월 구독료, 1,000만 원 이상은 건당 이용료, 선정 견적 5,000만 원 이상이 체결되면 계약 금액 기준 성사수수료.
 * 마감한 달은 마감 때 저장한 명세(billing_periods.snapshot)를 보여 준다. 마감한 달은 다시 열 수 없고(0024), 바로잡을 금액은
 * 다음 열린 달에 조정 항목으로 넣는다. 시범 기간 참고 수치("유료였다면")는 따로 보여 주고 합계에 넣지 않는다.
 * 아래 표는 우회 거래의 신호도 보여 준다: 기관별 선정률이 유독 낮거나, 의뢰자가 선정 없이 마무리한 요청이 특정 기관에 몰리면 확인한다.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSession("admin");
  const { month } = await searchParams;
  const r = monthRangeOf(month);
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const sb = getSupabaseAdmin()!;

  const cur = monthRangeOf(undefined);
  // 끝난 달만 마감할 수 있다 (되돌릴 수 없으므로, close_billing_month not_ended)
  const ended = r.from < cur.from;
  const [{ data: liveSummary, error }, { data: liveLines }, { data: liveAwards }, { data: noSelect }, { data: period }, { data: liveAdj, error: adjError }, { data: liveRef, error: refError }, { data: closedRows }, { data: orgRows }] = await Promise.all([
    sb.rpc("billing_summary", { p_from: r.from, p_to: r.to }),
    sb.rpc("billing_lines", { p_from: r.from, p_to: r.to }),
    sb.rpc("billing_awards", { p_from: r.from, p_to: r.to }),
    sb.from("rfq_requests").select("rfq_no, substance, outcome, outcome_note, outcome_at, compared_at").not("compared_at", "is", null).is("selected_quote_id", null).gte("compared_at", `${r.from}T00:00:00+09:00`).lt("compared_at", `${r.to}T00:00:00+09:00`).order("compared_at", { ascending: false }).limit(500),
    sb.from("billing_periods").select("month, closed_at, snapshot").eq("month", r.from).maybeSingle(),
    sb.rpc("billing_adjustment_lines", { p_from: r.from, p_to: r.to }),
    sb.rpc("billing_reference", { p_from: r.from, p_to: r.to }),
    sb.from("billing_periods").select("month").lt("month", r.from).order("month", { ascending: false }).limit(24),
    // 정지한 기관에도 돌려줄 금액이 있을 수 있어 조정 대상에 넣는다
    sb.from("cro_orgs").select("id, name").in("status", ["approved", "suspended"]).order("name").limit(500),
  ]);
  const closed = !!period;
  const snap = (period?.snapshot ?? null) as BillingSnapshot | null;
  const live = { summary: (liveSummary ?? []) as BillingSummaryRow[], lines: (liveLines ?? []) as BillingLineRow[], awards: (liveAwards ?? []) as BillingAwardRow[] };
  // 마감한 달은 저장본이 기준이다. 저장본이 없는 예전 마감(0020 전)만 지금 집계를 보여 준다
  const view = snap ?? live;
  // 조정 항목은 0024 부터. 그 전에 마감한 달에는 조정을 넣을 수 없었으므로 저장본에 없으면 빈 목록이다
  const adjustments: BillingAdjustmentRow[] = snap ? snap.adjustments ?? [] : ((liveAdj ?? []) as BillingAdjustmentRow[]);
  // 참고 수치는 청구가 아니므로, 0024 전 저장본에 없으면 지금 집계로 보여 준다
  const reference: BillingReferenceRow[] = snap?.reference ?? ((liveRef ?? []) as BillingReferenceRow[]);
  const referenceLive = !!snap && !snap.reference;
  // 지금 집계를 써야 하는데 불러오지 못했으면 "없습니다" 대신 오류를 보여 준다 (합계에는 조정이 들어 있으므로)
  const adjFailed = !snap && !!adjError;
  const refFailed = !snap?.reference && !!refError;
  const adjByOrg = adjustmentsByOrg(adjustments);
  const adjTotal = adjustments.reduce((n, a) => n + a.amount, 0);
  const refT = referenceTotals(reference);
  const closedMonths = ((closedRows ?? []) as { month: string }[]).map((p) => p.month.slice(0, 7));
  const drifted = !!snap && !error && statementDigest(snap.summary) !== statementDigest(live.summary);
  const rows = view.summary;
  const t = statementTotals(rows);
  const guidance = view.awards.filter((a) => a.kind === "guidance");
  const settled = view.awards.filter((a) => a.kind === "settlement");

  return (
    <>
      <div className="ph">
        <div>
          <h1>청구 명세</h1>
          <p>
            {r.label} · 청구 대상 견적 {t.billable}건 · 합계 {comma(t.total)}
            {adjustments.length ? ` · 조정 ${signedWon(adjTotal, comma)} 포함` : ""}
            {t.pendingOrgs ? ` · 단가·요율 미정 ${t.pendingOrgs}곳은 미정 금액 제외` : ""}
            {closed ? " · 마감됨" : ""}
          </p>
        </div>
        <div className="ph__actions" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href={`/admin/billing?month=${r.prev}`} className="b2">이전 달</Link>
          <Link href={`/admin/billing?month=${r.next}`} className="b2">다음 달</Link>
          <a href={`/api/admin/billing/export?month=${r.from.slice(0, 7)}`} className="b2">CSV 내려받기</a>
          <BillingClose month={r.from.slice(0, 7)} closed={closed} ended={ended} />
        </div>
      </div>
      <div className="note note--tint" style={{ marginBottom: 12 }}>시범운영 기간에는 기관에 청구하지 않습니다(이용약관 제5조3항). 이 화면의 금액은 참고 집계이며, 금액은 기관과 서면으로 합의한 뒤에 적용합니다.</div>
      <p style={{ ...muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16, maxWidth: "75ch" }}>
        기관이 직접 참여한 요청에 제출한 견적만 청구합니다. 참여 기록이 없는 견적, 시범 운영 조건 판으로 참여한 요청의 견적과 성사수수료, 요청을 받고 견적을 내지 않은 기관, 금액이 입력되지 않은 견적은 청구하지 않습니다. 기관이 참여한 뒤 운영자가 옮겨 적은 견적은 기관이 직접 낸 견적과 같게 셉니다. 금액 없이 제출된 견적은 나중에 금액이 들어온 달에 청구합니다. 견적 총액(부가세 별도) 1,000만 원 미만은 월 구독료에 포함되고, 1,000만 원 이상은 건당 이용료, 선정 견적이 5,000만 원 이상이고 단추를 통해 계약이 체결되면 계약 금액 기준 성사수수료를 더합니다. 같은 초대의 재제출·수정은 처음 제출한 달에 한 번만 셉니다. 월 구독료는 구독 시작 월부터 이번 달까지만 나옵니다.
      </p>
      {closed && (
        <div className="note note--ok" style={{ marginBottom: 12 }}>
          {snap ? `이 달은 마감되었습니다. ${ymd(snap.taken_at)} 마감 때 저장한 명세를 보여 줍니다.` : "이 달은 마감되었습니다."} {CLOSED_MONTH_NOTE}
        </div>
      )}
      {drifted && <div className="note note--warn" style={{ marginBottom: 12 }}>마감 뒤 바뀐 값이 있습니다(단가, 견적 금액, 체결 정정 등). 마감한 명세는 바꾸지 않습니다. 바로잡을 금액은 다음 달 명세에 조정 항목으로 넣습니다.</div>}
      {error && <div className="note note--warn" style={{ marginBottom: 16 }}>집계 함수를 불러오지 못했습니다. `0020_billing_rules.sql` 마이그레이션이 적용됐는지 확인하세요. ({error.message})</div>}
      {adjFailed && <div className="note note--warn" role="alert" style={{ marginBottom: 16 }}>조정 항목을 불러오지 못했습니다. 합계에는 조정 금액이 들어 있지만 조정 열과 목록은 비어 보입니다. `0024_billing_close_lock.sql` 이 적용됐는지 확인한 뒤 새로고침해 주세요. ({adjError.message})</div>}

      <div className="card tbl-wrap" style={{ marginBottom: 20 }}>
        <div style={cardHead}>기관별 명세 · 미정은 0원으로 보이지 않고 미정으로 표시합니다</div>
        {rows.length === 0 ? (
          <p className="empty">이 달에 제출된 견적, 체결 확인, 구독 기관이 없습니다.</p>
        ) : (
          <table className="tbl tbl--sticky">
            <thead>
              <tr>
                <th>기관</th>
                <th className="tnum">회신 견적 (청구 대상)</th>
                <th className="tnum">1,000만 원 미만 (구독)</th>
                <th className="tnum">건당 이용료 대상</th>
                <th className="tnum">건당 이용료 합계</th>
                <th className="tnum">성사수수료 예상 (견적 기준)</th>
                <th className="tnum">성사수수료 정산 (계약 기준, 체결 확인분)</th>
                <th className="tnum">월 구독료</th>
                <th className="tnum">조정</th>
                <th className="tnum">합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.org_id}>
                  <td>
                    <Link href={`/admin/cros/${x.org_id}`}>{x.org_name}</Link>{x.managed && <ManagedBadge />}
                    <span style={{ ...muted, display: "block" }}>
                      전달 {x.delivered} · 제출 {x.quoted}{x.excluded ? ` · 청구 안 함 ${x.excluded}` : ""}{x.no_amount ? ` · 금액 미입력 ${x.no_amount}` : ""} · 선정 {x.selected}{x.quoted ? ` (${Math.round((x.selected / x.quoted) * 100)}%)` : ""}
                    </span>
                  </td>
                  <td className="tnum">{x.billable}</td>
                  <td className="tnum">{x.subscription || "-"}</td>
                  <td className="tnum">{x.per_quote || "-"}{x.per_quote > 0 && x.per_request_fee != null ? <span style={{ ...muted, display: "block" }}>{comma(x.per_request_fee)} × {x.per_quote}</span> : null}</td>
                  <td className="tnum">{x.per_quote ? wonOrPending(x.per_quote_fee, comma, "단가 미정") : "-"}</td>
                  <td className="tnum">{x.guidance_count ? <>{wonOrPending(x.guidance_fee, comma, "요율 미정")}<span style={{ ...muted, display: "block" }}>{x.guidance_count}건 · 합계 미포함</span></> : "-"}</td>
                  <td className="tnum">{x.settled_count ? <>{wonOrPending(x.settled_fee, comma, "요율 미정")}<span style={{ ...muted, display: "block" }}>{x.settled_count}건 · 계약 {won(x.settled_contract_amount)}</span></> : "-"}</td>
                  <td className="tnum">{x.monthly_fee != null ? comma(x.monthly_fee) : <span style={muted}>구독 없음</span>}</td>
                  <td className="tnum">{adjByOrg.has(x.org_id) ? signedWon(adjByOrg.get(x.org_id)!, comma) : "-"}</td>
                  <td className="tnum" style={{ fontWeight: 700 }}>{comma(x.total_due)}{x.terms_pending ? <span style={{ ...muted, display: "block", fontWeight: 400 }}>미정 금액 제외</span> : null}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>합계</td>
                <td className="tnum">{t.billable}</td>
                <td className="tnum">-</td>
                <td className="tnum">{t.perQuote}</td>
                <td className="tnum">{comma(t.perQuoteFee)}</td>
                <td className="tnum" style={muted}>{comma(t.guidanceFee)}</td>
                <td className="tnum">{comma(t.settledFee)}</td>
                <td className="tnum">{comma(t.monthlyFee)}</td>
                <td className="tnum">{adjustments.length ? signedWon(adjTotal, comma) : "-"}</td>
                <td className="tnum" style={{ fontWeight: 700 }}>{comma(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <section className="card billadj-card" aria-labelledby="adj-head" style={{ marginBottom: 20 }}>
        <h2 id="adj-head" style={{ ...cardHead, margin: 0 }}>조정 항목 · 마감한 달을 바로잡는 금액. 이 달 합계에 들어갑니다</h2>
        {adjFailed ? (
          <p className="note note--warn" role="alert" style={{ margin: "0 16px 12px" }}>조정 항목을 불러오지 못했습니다. 새로고침해 주세요.</p>
        ) : adjustments.length === 0 ? (
          <p className="empty">이 달에 넣은 조정 항목이 없습니다.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl tbl--stack">
              <thead><tr><th>기관</th><th className="tnum">금액</th><th>사유</th><th>바로잡는 달</th><th>넣은 날</th></tr></thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.adjustment_id}>
                    <td><Link href={`/admin/cros/${a.org_id}`}>{a.org_name}</Link></td>
                    <td className="tnum" data-label="금액" style={{ fontWeight: 600 }}>{signedWon(a.amount, comma)}</td>
                    <td data-label="사유" style={{ fontSize: 13, maxWidth: "48ch" }}>{a.reason}</td>
                    <td className="tnum" data-label="바로잡는 달">{a.corrects_month ? <Link href={`/admin/billing?month=${a.corrects_month.slice(0, 7)}`}>{a.corrects_month.slice(0, 7)}</Link> : "-"}</td>
                    <td className="tnum" data-label="넣은 날">{ymd(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="billadj-card__foot">
          {closed ? (
            <p style={{ ...muted, fontSize: 13, margin: 0 }}>이 달은 마감해 조정 항목을 더 넣거나 바꿀 수 없습니다. 바로잡을 금액은 <Link href="/admin/billing">열린 달 명세</Link>에서 넣어 주세요.</p>
          ) : (
            <BillingAdjustmentForm month={r.from.slice(0, 7)} orgs={(orgRows ?? []) as { id: string; name: string }[]} closedMonths={closedMonths} />
          )}
        </div>
      </section>

      <div className="card tbl-wrap" style={{ marginBottom: 20 }}>
        <div style={cardHead}>회신 견적 기록 · 이 달에 처음 제출된 견적(금액 없이 제출했으면 금액이 들어온 달). 허위·중복·범위 불일치만 제외합니다. 예산 검토·비교 견적은 정상 요청입니다</div>
        {view.lines.length === 0 ? (
          <p className="empty">이 달에 처음 제출된 견적이 없습니다.</p>
        ) : (
          <table className="tbl tbl--stack">
            <thead><tr><th>요청</th><th>처음 제출</th><th>기관</th><th className="tnum">견적 금액</th><th>구간</th><th className="tnum">건당 이용료</th><th>청구</th></tr></thead>
            <tbody>
              {view.lines.map((l) => (
                <tr key={l.quote_id}>
                  <td><Link href={`/admin/r/${l.rfq_no}`} className="tnum">{l.rfq_no}</Link></td>
                  <td className="tnum" data-label="처음 제출">{ymd(l.first_submitted_at)}{l.billing_at && ymd(l.billing_at).slice(0, 7) !== ymd(l.first_submitted_at).slice(0, 7) ? <span style={{ ...muted, display: "block" }}>금액 입력 {ymd(l.billing_at)}</span> : null}</td>
                  <td data-label="기관">{l.org_name}{l.entry_source === "operator" && <span style={{ ...muted, display: "block" }}>운영자 대리 입력</span>}{l.auto && <span style={{ ...muted, display: "block" }}>예비 견적 (자동 회신)</span>}{joinStatusNote(l.join_status) && <span style={{ ...muted, display: "block" }}>{joinStatusNote(l.join_status)}</span>}</td>
                  <td className="tnum" data-label="견적 금액">{l.total_amount ? won(l.total_amount) : <span style={muted}>금액 미입력</span>}</td>
                  <td data-label="구간" style={{ fontSize: 12 }}>{TIER_LABEL[l.tier] ?? l.tier}</td>
                  <td className="tnum" data-label="건당 이용료">{l.chargeable ? wonOrPending(l.fee_due, comma, "단가 미정") : "-"}</td>
                  <td data-label="청구" className="tbl__act"><BillableToggle inviteId={l.invite_id} billable={l.billable} reason={l.bill_excluded_reason} locked={closed} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card tbl-wrap" style={{ marginBottom: 20 }}>
        <div style={cardHead}>성사수수료 · 선정 견적 5,000만 원 이상만. 예상은 이 달 선정분(선정 견적 × 요율, 안내용), 정산은 이 달 체결 확인분(계약 금액 × 요율)</div>
        {guidance.length + settled.length === 0 ? (
          <p className="empty">이 달에 해당하는 성사수수료가 없습니다.</p>
        ) : (
          <table className="tbl tbl--stack">
            <thead><tr><th>요청</th><th>구분</th><th>기관</th><th className="tnum">선정 견적</th><th className="tnum">계약 금액</th><th>계약 상태</th><th className="tnum">요율</th><th className="tnum">수수료</th></tr></thead>
            <tbody>
              {[...settled, ...guidance].map((a) => (
                <tr key={`${a.kind}-${a.award_id}`}>
                  <td><Link href={`/admin/r/${a.rfq_no}`} className="tnum">{a.rfq_no}</Link></td>
                  <td data-label="구분">{a.kind === "settlement" ? <b>정산 (계약 기준)</b> : "예상 (견적 기준)"}<span style={{ ...muted, display: "block" }}>{a.kind === "settlement" ? `체결 확인 ${ymd(a.contract_reported_at)}` : `선정 ${ymd(a.awarded_at)}`}</span></td>
                  <td data-label="기관">{a.org_name}{a.invite_billable === false && <span style={{ ...muted, display: "block" }}>견적 청구 제외한 초대</span>}{a.invite_joined === false && <span style={{ ...muted, display: "block" }}>청구 조건 참여 기록 없음(참여 기록 없음 또는 시범 운영 중 참여), 합계 미포함</span>}</td>
                  <td className="tnum" data-label="선정 견적">{won(a.quote_amount)}</td>
                  <td className="tnum" data-label="계약 금액">{a.contract_amount != null ? won(a.contract_amount) : "-"}</td>
                  <td data-label="계약 상태" style={{ fontSize: 12 }}>{CONTRACT_STATUS_LABEL[a.contract_status] ?? a.contract_status}</td>
                  <td className="tnum" data-label="요율">{a.fee_rate != null ? `${Math.round(a.fee_rate * 10000) / 100}%` : "미정"}</td>
                  <td className="tnum" data-label="수수료" style={{ fontWeight: a.kind === "settlement" ? 700 : 400 }}>{wonOrPending(a.fee, comma, "요율 미정")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="card tbl-wrap" aria-labelledby="ref-head" style={{ marginBottom: 20 }}>
        <h2 id="ref-head" style={{ ...cardHead, margin: 0 }}>{REFERENCE_LABEL} · 유료였다면</h2>
        <p className="billref__lead">
          시범 판이나 참여 기능 도입 전(legacy)에 참여해 청구하지 않은 견적과 체결을, 유료였다면 얼마였을지 셉니다. 합계, 명세, 청구서에는 넣지 않습니다.
          기관 약정 값이 없으면 {REFERENCE_UNIT_LABEL}를 씁니다: 건당 {comma(REFERENCE_PER_QUOTE_FEE)}, 성사수수료 {rateLabel(REFERENCE_SUCCESS_RATE)}. 월 구독료는 정하지 않아 1,000만 원 미만 견적은 건수만 셉니다.
          {referenceLive ? " 이 달 저장본에는 참고 수치가 없어(0024 전 마감) 지금 집계로 보여 줍니다." : ""}
        </p>
        {refFailed ? (
          <p className="note note--warn" role="alert" style={{ margin: "0 16px 12px" }}>참고 수치를 불러오지 못했습니다. `0024_billing_close_lock.sql` 이 적용됐는지 확인한 뒤 새로고침해 주세요. ({refError.message})</p>
        ) : reference.length === 0 ? (
          <p className="empty">이 달에 시범 기간이라 청구하지 않은 견적이나 체결이 없습니다.</p>
        ) : (
          <table className="tbl tbl--stack">
            <thead>
              <tr>
                <th>기관</th>
                <th className="tnum">1,000만 원 미만 (구독 구간)</th>
                <th className="tnum">건당 이용료 대상</th>
                <th className="tnum">건당 이용료 (참고)</th>
                <th className="tnum">체결 (5,000만 원 이상)</th>
                <th className="tnum">성사수수료 (참고)</th>
              </tr>
            </thead>
            <tbody>
              {reference.map((x) => (
                <tr key={x.org_id}>
                  <td><Link href={`/admin/cros/${x.org_id}`}>{x.org_name}</Link></td>
                  <td className="tnum" data-label="1,000만 원 미만 (구독 구간)">{x.subscription_count ? `${x.subscription_count}건` : "-"}</td>
                  <td className="tnum" data-label="건당 이용료 대상">{x.per_quote_count ? `${x.per_quote_count}건` : "-"}</td>
                  <td className="tnum" data-label="건당 이용료 (참고)">
                    {x.per_quote_count ? <>{comma(x.per_quote_fee)}<span style={{ ...muted, display: "block" }}>{x.per_quote_unit_source === "org" ? "기관 단가" : "참고 단가"} {comma(x.per_quote_unit)} × {x.per_quote_count}</span></> : "-"}
                  </td>
                  <td className="tnum" data-label="체결 (5,000만 원 이상)">{x.success_count ? <>{x.success_count}건<span style={{ ...muted, display: "block" }}>계약 {won(x.success_contract_amount)}</span></> : "-"}</td>
                  <td className="tnum" data-label="성사수수료 (참고)">
                    {x.success_count ? <>{comma(x.success_fee)}<span style={{ ...muted, display: "block" }}>{x.success_rate_source === "org" ? "기관 요율" : "참고 요율"} {rateLabel(x.success_rate)}</span></> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>참고 합계</td>
                <td className="tnum">{refT.subscription}건</td>
                <td className="tnum">{refT.perQuote}건</td>
                <td className="tnum">{comma(refT.perQuoteFee)}</td>
                <td className="tnum">{refT.success}건</td>
                <td className="tnum">{comma(refT.successFee)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <div className="card tbl-wrap">
        <div style={cardHead}>회신 마감 후 선정 없는 요청 · 외부 진행이 반복되는 기관을 확인합니다</div>
        {(noSelect ?? []).length === 0 ? (
          <p className="empty">해당 요청이 없습니다.</p>
        ) : (
          <table className="tbl tbl--stack">
            <thead><tr><th>요청</th><th>회신 마감</th><th>결과</th><th>사유</th></tr></thead>
            <tbody>
              {(noSelect ?? []).map((q) => (
                <tr key={q.rfq_no}>
                  <td><Link href={`/admin/r/${q.rfq_no}`}>{q.rfq_no}</Link><span style={{ ...muted, display: "block" }}>{q.substance}</span></td>
                  <td className="tnum" data-label="회신 마감">{q.compared_at ? ymd(q.compared_at) : "-"}</td>
                  <td data-label="결과">{q.outcome ?? <span style={{ color: "var(--muted)" }}>미응답</span>}</td>
                  <td data-label="사유" style={{ fontSize: 12 }}>{q.outcome_note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
