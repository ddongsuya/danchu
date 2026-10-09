import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, isBillingClosed } from "@/lib/data";
import { monthRangeOf, successFee } from "@/lib/billing";
import { BillingClose } from "@/components/admin/BillingClose";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { BillingSummaryRow } from "@/lib/db-types";
import { won, ymd } from "@/lib/format";
import { BillableToggle } from "@/components/admin/BillableToggle";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { matched: "매칭", nominated: "지명", manual: "수동" };

/**
 * 월별 전달 명세. 전달 1건 = 청구 1건이므로 이 화면이 기관 청구서의 원천이다.
 * 아래 두 표는 우회 거래의 신호도 보여 준다: 기관별 선정률이 유독 낮거나,
 * 의뢰자가 비교표를 보고도 선정 없이 마무리한 요청이 특정 기관에 몰리면 그 기관 요청이 밖으로 샌 것이다.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSession("admin");
  const { month } = await searchParams;
  const r = monthRangeOf(month);
  if (!dbReady()) return <div className="empty">Supabase 환경변수가 없어 데이터를 읽을 수 없습니다.</div>;
  const sb = getSupabaseAdmin()!;

  const [{ data: summary, error }, { data: invites }, { data: noSelect }, closed] = await Promise.all([
    sb.rpc("billing_summary", { p_from: r.from, p_to: r.to }),
    sb.from("rfq_invites").select("id, rfq_no, cro_name, cro_org_id, sent_at, status, source, billable, bill_excluded_reason").gte("sent_at", `${r.from}T00:00:00+09:00`).lt("sent_at", `${r.to}T00:00:00+09:00`).order("sent_at", { ascending: false }).limit(2000),
    sb.from("rfq_requests").select("rfq_no, substance, outcome, outcome_note, outcome_at, compared_at").not("compared_at", "is", null).is("selected_quote_id", null).gte("compared_at", `${r.from}T00:00:00+09:00`).lt("compared_at", `${r.to}T00:00:00+09:00`).order("compared_at", { ascending: false }).limit(500),
    isBillingClosed(r.from),
  ]);
  const rows = (summary ?? []) as BillingSummaryRow[];
  const orgIds = rows.map((x) => x.org_id);
  const { data: rates } = orgIds.length ? await sb.from("cro_orgs").select("id, fee_rate").in("id", orgIds) : { data: [] as { id: string; fee_rate: number | null }[] };
  const rateOf = new Map((rates ?? []).map((o) => [o.id, o.fee_rate]));
  const totalBillable = rows.reduce((a, x) => a + x.billable, 0);
  const priced = rows.filter((x) => x.per_request_fee != null);
  const totalFee = priced.reduce((a, x) => a + (x.per_request_fee ?? 0) * x.billable, 0);
  const unpriced = rows.length - priced.length;
  const totalSuccess = rows.reduce((a, x) => a + (successFee(x.selected_amount, rateOf.get(x.org_id)) ?? 0), 0);

  return (
    <>
      <div className="ph">
        <div>
          <h1>전달 명세</h1>
          <p>
            {r.label} · 청구 대상 전달 {totalBillable}건
            {priced.length ? ` · 전달 이용료 ${won(totalFee)}${unpriced ? ` (단가 미설정 ${unpriced}곳 제외)` : ""}` : " · 기관별 단가 미설정"}
            {totalSuccess ? ` · 성사수수료 ${won(totalSuccess)}` : ""}
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
      {closed && <div className="note note--ok" style={{ marginBottom: 16 }}>이 달은 청구가 마감되었습니다. 청구 제외·복원은 마감을 해제해야 바꿀 수 있습니다.</div>}

      {error && <div className="note note--warn" style={{ marginBottom: 16 }}>집계 함수를 불러오지 못했습니다. `0009_anonymous_billing.sql` 마이그레이션이 적용됐는지 확인하세요. ({error.message})</div>}

      <div className="card tbl-wrap" style={{ marginBottom: 20 }}>
        <div style={{ padding: "14px 16px 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>기관별 집계 · 선정률이 유독 낮은 기관은 우회 신호로 본다</div>
        {rows.length === 0 ? (
          <p className="empty">이 달에 전달된 요청이 없습니다.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>기관</th><th className="tnum">전달</th><th className="tnum">청구</th><th className="tnum">제외</th><th>출처</th><th className="tnum">회신</th><th className="tnum">미회신</th><th className="tnum">선정</th><th className="tnum">선정 견적 합계 (면제 제외)</th><th className="tnum">약정 단가</th><th className="tnum">전달 이용료</th><th className="tnum">성사수수료</th><th className="tnum">월 한도</th></tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.org_id}>
                  <td><Link href={`/admin/cros/${x.org_id}`}>{x.org_name}</Link></td>
                  <td className="tnum">{x.delivered}</td>
                  <td className="tnum">{x.billable}</td>
                  <td className="tnum">{x.excluded || "-"}</td>
                  <td style={{ fontSize: 12 }}>{[x.matched ? `매칭 ${x.matched}` : "", x.nominated ? `지명 ${x.nominated}` : "", x.manual ? `수동 ${x.manual}` : ""].filter(Boolean).join(" · ")}</td>
                  <td className="tnum">{x.replied}</td>
                  <td className="tnum">{x.unanswered}</td>
                  <td className="tnum">{x.selected}{x.replied ? ` (${Math.round((x.selected / x.replied) * 100)}%)` : ""}</td>
                  <td className="tnum">{x.selected_amount ? won(x.selected_amount) : "-"}{x.exempt ? <div style={{ fontSize: 11, color: "var(--muted)" }}>면제 {x.exempt}건 제외</div> : null}</td>
                  <td className="tnum">{x.per_request_fee ? won(x.per_request_fee) : "-"}</td>
                  <td className="tnum">{x.per_request_fee != null ? won(x.per_request_fee * x.billable) : "-"}</td>
                  <td className="tnum">{(() => { const f = successFee(x.selected_amount, rateOf.get(x.org_id)); return f == null ? (x.selected ? "요율 미정" : "-") : won(f); })()}</td>
                  <td className="tnum">{x.monthly_cap ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card tbl-wrap">
          <div style={{ padding: "14px 16px 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>전달 기록 · 허위·중복·범위 불일치만 제외한다. 예산 검토·비교 견적은 정상 요청이다</div>
          {(invites ?? []).length === 0 ? (
            <p className="empty">전달 기록이 없습니다.</p>
          ) : (
            <table className="tbl">
              <thead><tr><th>전달일</th><th>요청</th><th>기관</th><th>출처</th><th>회신</th><th>청구</th></tr></thead>
              <tbody>
                {(invites ?? []).map((i) => (
                  <tr key={i.id}>
                    <td className="tnum">{ymd(i.sent_at)}</td>
                    <td><Link href={`/admin/r/${i.rfq_no}`}>{i.rfq_no}</Link></td>
                    <td>{i.cro_name}</td>
                    <td style={{ fontSize: 12 }}>{SOURCE_LABEL[i.source] ?? i.source}</td>
                    <td style={{ fontSize: 12 }}>{i.status === "submitted" ? "제출" : i.status === "declined" ? "안 함" : "미회신"}</td>
                    <td><BillableToggle inviteId={i.id} billable={i.billable} reason={i.bill_excluded_reason} locked={closed} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card tbl-wrap">
          <div style={{ padding: "14px 16px 6px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>비교표 공개 후 선정 없는 요청 · 외부 진행이 반복되는 기관을 확인한다</div>
          {(noSelect ?? []).length === 0 ? (
            <p className="empty">해당 요청이 없습니다.</p>
          ) : (
            <table className="tbl">
              <thead><tr><th>요청</th><th>비교표</th><th>결과</th><th>사유</th></tr></thead>
              <tbody>
                {(noSelect ?? []).map((q) => (
                  <tr key={q.rfq_no}>
                    <td><Link href={`/admin/r/${q.rfq_no}`}>{q.rfq_no}</Link><span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{q.substance}</span></td>
                    <td className="tnum">{q.compared_at ? ymd(q.compared_at) : "-"}</td>
                    <td>{q.outcome ?? <span style={{ color: "var(--muted)" }}>미응답</span>}</td>
                    <td style={{ fontSize: 12 }}>{q.outcome_note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
