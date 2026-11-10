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
import { contractSignals, externalWithInvited, GAP_REASON_LABEL, isGapReason, SPONSOR_STATUS_LABEL } from "@/lib/contract-gap";

export const dynamic = "force-dynamic";

export default async function AdminAwards() {
  await requireSession("admin");
  const list = dbReady() ? await listAllAwards() : [];
  const total = list.reduce((a, x) => a + (x.contract_amount ?? 0), 0);
  // 성사 수수료: 체결 뒤에는 계약 금액 5,000만 원 이상만, 체결 전 예상은 선정 견적 5,000만 원 이상만 (0041). 예상 = 선정 견적 금액으로 계산(안내), 정산 = 확정된 계약 금액으로 계산. 요금표는 구간 초과분 누진(0039) (의뢰자 확인 또는 7일 뒤 자동 확정, 0025)
  const orgIds = [...new Set(list.map((a) => a.cro_org_id).filter((x): x is string => !!x))];
  const { data: rates } = orgIds.length ? await getSupabaseAdmin()!.from("cro_orgs").select("id, fee_rate").in("id", orgIds) : { data: [] as { id: string; fee_rate: number | null }[] };
  const rateOf = new Map((rates ?? []).map((o) => [o.id, o.fee_rate]));
  const count = (st: string) => list.filter((a) => a.contract_status === st).length;
  // 확인할 신호 (0034, 우회 계약 방지): 기관 보고와 의뢰자 알림이 다르거나, 계약 금액이 선정 견적보다 크게 낮은 수주
  const signalRows = list
    .map((a) => ({
      a,
      sig: contractSignals(
        { quoteAmount: a.fee_basis_amount, contractAmount: a.contract_amount, contractStatus: a.contract_status, contractReportedAt: a.contract_reported_at, contractConfirmedAt: a.contract_confirmed_at, gapReason: a.contract_gap_reason ?? null, sponsorStatus: a.sponsor_contract_status ?? null, sponsorAmount: a.sponsor_contract_amount ?? null, awardedAt: a.awarded_at },
        won,
      ),
    }))
    .filter((x) => x.sig.length);
  // 선정 없이 "외부 진행"으로 마쳤는데, 메모에 참여 안내를 받은 기관 이름이 있는 요청 (최근 180일)
  const sb = dbReady() ? getSupabaseAdmin() : null;
  const since = new Date(Date.now() - 180 * 864e5).toISOString();
  const { data: ext } = sb ? await sb.from("rfq_requests").select("id, rfq_no, substance, outcome_note, outcome_at").eq("outcome", "외부 진행").gte("outcome_at", since).order("outcome_at", { ascending: false }).limit(100) : { data: [] as { id: string; rfq_no: string; substance: string; outcome_note: string | null; outcome_at: string | null }[] };
  const { data: extInv } = sb && (ext ?? []).length ? await sb.from("rfq_invites").select("rfq_id, cro_name").in("rfq_id", (ext ?? []).map((r) => r.id)) : { data: [] as { rfq_id: string; cro_name: string | null }[] };
  const extRows = (ext ?? [])
    .map((r) => ({ r, hit: externalWithInvited(r.outcome_note, (extInv ?? []).filter((i) => i.rfq_id === r.id).map((i) => i.cro_name ?? "").filter(Boolean)) }))
    .filter((x) => x.hit.length);
  return (
    <>
      <div className="ph">
        <div>
          <h1>수주·계약</h1>
          <p>선정 {list.length}건 · 체결 {count("signed")}건 · 협의 중 {count("negotiating")}건 · 미체결 {count("not_signed")}건 · 보고된 계약금액 합계 {won(total)}</p>
        </div>
      </div>
      <section className="card tbl-wrap" aria-labelledby="signals-title" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 16px 6px" }}>
          <h2 id="signals-title" style={{ fontSize: 16, fontWeight: 700 }}>확인할 신호 {signalRows.length + extRows.length}건</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>기관 보고와 의뢰자 알림이 다르거나, 계약 금액이 선정 견적보다 20% 이상 낮거나, 외부 진행 메모에 참여 기관 이름이 있는 건입니다. 판단 전에 양쪽에 확인합니다.</p>
        </div>
        {signalRows.length + extRows.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>지금 확인할 신호가 없습니다.</p>
        ) : (
          <table className="tbl tbl--stack">
            <thead><tr><th>요청</th><th>기관</th><th>신호</th><th>의뢰자 알림</th></tr></thead>
            <tbody>
              {signalRows.map(({ a, sig }) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/r/${a.rfq?.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{a.rfq?.rfq_no}</Link><div style={{ fontSize: 12, color: "var(--muted)" }}>{a.rfq?.substance}</div></td>
                  <td data-label="기관">{a.cro_name}</td>
                  <td data-label="신호">{sig.map((x) => <div key={x.kind} style={{ fontSize: 13 }}>{x.label}</div>)}</td>
                  <td data-label="의뢰자 알림" style={{ fontSize: 13 }}>{a.sponsor_contract_status ? `${SPONSOR_STATUS_LABEL[a.sponsor_contract_status]}${a.sponsor_reported_at ? ` · ${ymd(a.sponsor_reported_at)}` : ""}${a.sponsor_contract_note ? ` · ${a.sponsor_contract_note}` : ""}` : "-"}</td>
                </tr>
              ))}
              {extRows.map(({ r, hit }) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/r/${r.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{r.rfq_no}</Link><div style={{ fontSize: 12, color: "var(--muted)" }}>{r.substance}</div></td>
                  <td data-label="기관">{hit.join(", ")}</td>
                  <td data-label="신호" style={{ fontSize: 13 }}>선정 없이 외부 진행 · 메모에 참여 안내를 받은 기관 이름이 있습니다</td>
                  <td data-label="의뢰자 알림" style={{ fontSize: 13 }}>{r.outcome_note}{r.outcome_at ? ` · ${ymd(r.outcome_at)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {list.length === 0 ? (
        <div className="empty"><b>수주가 없습니다</b>의뢰자가 비교표에서 CRO를 선택하면 여기에 쌓입니다.</div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack">
            <thead>
              <tr><th>요청</th><th>의뢰자</th><th>선정 CRO</th><th>선정일</th><th>계약 상태</th><th>계약 보고</th><th className="tnum">성사 수수료</th><th>요청 상태</th></tr>
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
                      {a.contract_gap_reason && isGapReason(a.contract_gap_reason) ? <div style={{ fontSize: 12, color: "var(--muted)" }}>차이 사유 {GAP_REASON_LABEL[a.contract_gap_reason]}</div> : null}
                      {a.contract_note ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.contract_note}</div> : null}
                      {(() => { const c = contractConfirmState(a); return c ? <div style={{ fontSize: 12, color: c.tone === "warn" ? "var(--warn)" : "var(--muted)", fontWeight: c.tone === "warn" ? 600 : 400 }}>{c.label}</div> : null; })()}
                      {a.requester_disputed_at && !a.dispute_resolved_at && !a.contract_confirmed_at ? <DisputeResolve awardId={a.id} /> : null}
                    </>
                  ) : <span style={{ color: "var(--muted)" }}>-</span>}</td>
                  <td className="tnum" data-label="성사 수수료">{(() => {
                    const confirmed = !!a.contract_confirmed_at;
                    const f = successFeeView({ quoteAmount: a.fee_basis_amount, contractAmount: a.contract_amount, contractStatus: a.contract_status, feeRate: a.cro_org_id ? rateOf.get(a.cro_org_id) : null, confirmed });
                    if (!f.eligible) return <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.signed ? "대상 아님 (계약 금액 5,000만 원 미만)" : "대상 아님 (선정 견적 5,000만 원 미만)"}</span>;
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
