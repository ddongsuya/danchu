import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listAllAwards } from "@/lib/data";
import { contractConfirmState, statusLabel, statusTone } from "@/lib/status";
import { StatusPill } from "@/components/app/ui";
import { comma, won, ymd } from "@/lib/format";
import { successFeeView, wonOrPending } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/concierge";
import { DisputeResolve } from "@/components/admin/DisputeResolve";

export const dynamic = "force-dynamic";

export default async function AdminAwards() {
  await requireSession("admin");
  const list = dbReady() ? await listAllAwards() : [];
  const total = list.reduce((a, x) => a + (x.contract_amount ?? 0), 0);
  // 성사수수료: 선정 견적 5,000만 원 이상만. 예상 = 선정 견적 × 요율(안내), 정산 = 확정된 계약 금액 × 요율 (의뢰자 확인 또는 7일 뒤 자동 확정, 0025)
  const orgIds = [...new Set(list.map((a) => a.cro_org_id).filter((x): x is string => !!x))];
  const { data: rates } = orgIds.length ? await getSupabaseAdmin()!.from("cro_orgs").select("id, fee_rate").in("id", orgIds) : { data: [] as { id: string; fee_rate: number | null }[] };
  const rateOf = new Map((rates ?? []).map((o) => [o.id, o.fee_rate]));
  const count = (st: string) => list.filter((a) => a.contract_status === st).length;
  return (
    <>
      <div className="ph">
        <div>
          <h1>수주·계약</h1>
          <p>선정 {list.length}건 · 체결 {count("signed")}건 · 협의 중 {count("negotiating")}건 · 미체결 {count("not_signed")}건 · 보고된 계약금액 합계 {won(total)}</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty"><b>수주가 없습니다</b>의뢰자가 비교표에서 CRO를 선택하면 여기에 쌓입니다.</div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead>
              <tr><th>요청</th><th>의뢰자</th><th>선정 CRO</th><th>선정일</th><th>계약 상태</th><th>계약 보고</th><th className="tnum">성사수수료</th><th>요청 상태</th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/r/${a.rfq?.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{a.rfq?.rfq_no}</Link><div style={{ fontSize: 12, color: "var(--muted)" }}>{a.rfq?.substance}</div></td>
                  <td data-label="의뢰자">{a.rfq?.company}</td>
                  <td data-label="선정 CRO" style={{ fontWeight: 600 }}>{a.cro_name}</td>
                  <td className="tnum" data-label="선정일">{ymd(a.awarded_at)}</td>
                  <td data-label="계약 상태"><span className={`pill ${CONTRACT_STATUS_TONE[a.contract_status] ?? "pill--sf"}`}>{CONTRACT_STATUS_LABEL[a.contract_status] ?? a.contract_status}</span></td>
                  <td className="tnum" data-label="계약 보고">{a.contract_reported_at ? (
                    <>
                      {a.contract_date} · <b>{won(a.contract_amount ?? 0)}</b>
                      {a.contract_note ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.contract_note}</div> : null}
                      {(() => { const c = contractConfirmState(a); return c ? <div style={{ fontSize: 12, color: c.tone === "warn" ? "var(--warn)" : "var(--muted)", fontWeight: c.tone === "warn" ? 600 : 400 }}>{c.label}</div> : null; })()}
                      {a.requester_disputed_at && !a.dispute_resolved_at && !a.contract_confirmed_at ? <DisputeResolve awardId={a.id} /> : null}
                    </>
                  ) : <span style={{ color: "var(--muted)" }}>-</span>}</td>
                  <td className="tnum" data-label="성사수수료">{(() => {
                    const confirmed = !!a.contract_confirmed_at;
                    const f = successFeeView({ quoteAmount: a.fee_basis_amount, contractAmount: a.contract_amount, contractStatus: a.contract_status, feeRate: a.cro_org_id ? rateOf.get(a.cro_org_id) : null, confirmed });
                    if (!f.eligible) return <span style={{ fontSize: 12, color: "var(--muted)" }}>대상 아님 (선정 견적 5,000만 원 미만)</span>;
                    const settledLine = f.signed && confirmed
                      ? `정산 (계약 기준) ${wonOrPending(f.settled, comma, "요율 미정")}`
                      : a.contract_status === "not_signed"
                        ? "미체결 · 정산 없음"
                        : f.signed
                          ? a.requester_disputed_at && !a.dispute_resolved_at ? "이의 정리 전 · 정산 보류" : "정산은 계약 확정 후"
                          : "정산은 체결 확인 후";
                    return (
                      <>
                        <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>예상 (견적 기준) {wonOrPending(f.expected, comma, "요율 미정")}</span>
                        <span style={{ display: "block", fontWeight: f.signed && confirmed ? 700 : 400 }}>{settledLine}</span>
                      </>
                    );
                  })()}</td>
                  <td data-label="요청 상태"><StatusPill tone={statusTone(a.rfq?.status)}>{statusLabel(a.rfq?.status)}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
