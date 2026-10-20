import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { monthRangeOf, statementDigest, statementTotals, TIER_LABEL, joinStatusNote, wonOrPending } from "@/lib/billing";
import { BillingClose } from "@/components/admin/BillingClose";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { BillingAwardRow, BillingLineRow, BillingSnapshot, BillingSummaryRow } from "@/lib/db-types";
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
 * 마감한 달은 마감 때 저장한 명세(billing_periods.snapshot)를 보여 준다.
 * 아래 표는 우회 거래의 신호도 보여 준다: 기관별 선정률이 유독 낮거나, 의뢰자가 선정 없이 마무리한 요청이 특정 기관에 몰리면 확인한다.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSession("admin");
  const { month } = await searchParams;
  const r = monthRangeOf(month);
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const sb = getSupabaseAdmin()!;

  const [{ data: liveSummary, error }, { data: liveLines }, { data: liveAwards }, { data: noSelect }, { data: period }] = await Promise.all([
    sb.rpc("billing_summary", { p_from: r.from, p_to: r.to }),
    sb.rpc("billing_lines", { p_from: r.from, p_to: r.to }),
    sb.rpc("billing_awards", { p_from: r.from, p_to: r.to }),
    sb.from("rfq_requests").select("rfq_no, substance, outcome, outcome_note, outcome_at, compared_at").not("compared_at", "is", null).is("selected_quote_id", null).gte("compared_at", `${r.from}T00:00:00+09:00`).lt("compared_at", `${r.to}T00:00:00+09:00`).order("compared_at", { ascending: false }).limit(500),
    sb.from("billing_periods").select("month, closed_at, snapshot").eq("month", r.from).maybeSingle(),
  ]);
  const closed = !!period;
  const snap = (period?.snapshot ?? null) as BillingSnapshot | null;
  const live = { summary: (liveSummary ?? []) as BillingSummaryRow[], lines: (liveLines ?? []) as BillingLineRow[], awards: (liveAwards ?? []) as BillingAwardRow[] };
  // 마감한 달은 저장본이 기준이다. 저장본이 없는 예전 마감(0020 전)만 지금 집계를 보여 준다
  const view = snap ?? live;
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
            {t.pendingOrgs ? ` · 단가·요율 미정 ${t.pendingOrgs}곳은 미정 금액 제외` : ""}
            {closed ? " · 마감됨" : ""}
          </p>
        </div>
        <div className="ph__actions" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href={`/admin/billing?month=${r.prev}`} className="b2">이전 달</Link>
          <Link href={`/admin/billing?month=${r.next}`} className="b2">다음 달</Link>
          <a href={`/api/admin/billing/export?month=${r.from.slice(0, 7)}`} className="b2">CSV 내려받기</a>
          <BillingClose month={r.from.slice(0, 7)} closed={closed} />
        </div>
      </div>
      <div className="note note--tint" style={{ marginBottom: 12 }}>시범운영 기간에는 기관에 청구하지 않습니다(이용약관 제5조3항). 이 화면의 금액은 참고 집계이며, 금액은 기관과 서면으로 합의한 뒤에 적용합니다.</div>
      <p style={{ ...muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16, maxWidth: "75ch" }}>
        기관이 직접 참여한 요청에 제출한 견적만 청구합니다. 참여 기록이 없는 견적, 요청을 받고 견적을 내지 않은 기관, 금액이 입력되지 않은 견적은 청구하지 않습니다. 기관이 참여한 뒤 운영자가 옮겨 적은 견적은 기관이 직접 낸 견적과 같게 셉니다. 금액 없이 제출된 견적은 나중에 금액이 들어온 달에 청구합니다. 견적 총액(부가세 별도) 1,000만 원 미만은 월 구독료에 포함되고, 1,000만 원 이상은 건당 이용료, 선정 견적이 5,000만 원 이상이고 단추를 통해 계약이 체결되면 계약 금액 기준 성사수수료를 더합니다. 같은 초대의 재제출·수정은 처음 제출한 달에 한 번만 셉니다. 월 구독료는 구독 시작 월부터 이번 달까지만 나옵니다.
      </p>
      {closed && (
        <div className="note note--ok" style={{ marginBottom: 12 }}>
          {snap ? `이 달은 마감되었습니다. ${ymd(snap.taken_at)} 마감 때 저장한 명세를 보여 줍니다.` : "이 달은 마감되었습니다."} 청구 제외·복원과 마감 뒤 바뀐 값은 마감을 해제한 뒤 다시 마감해야 반영됩니다.
        </div>
      )}
      {drifted && <div className="note note--warn" style={{ marginBottom: 12 }}>마감 뒤 바뀐 값이 있습니다(단가, 견적 금액, 체결 정정 등). 지금 값으로 청구하려면 마감을 해제하고 다시 마감해 주세요.</div>}
      {error && <div className="note note--warn" style={{ marginBottom: 16 }}>집계 함수를 불러오지 못했습니다. `0020_billing_rules.sql` 마이그레이션이 적용됐는지 확인하세요. ({error.message})</div>}

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
                <td className="tnum" style={{ fontWeight: 700 }}>{comma(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

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
                  <td data-label="기관">{a.org_name}{a.invite_billable === false && <span style={{ ...muted, display: "block" }}>견적 청구 제외한 초대</span>}{a.invite_joined === false && <span style={{ ...muted, display: "block" }}>참여 기록 없음, 합계 미포함</span>}</td>
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
