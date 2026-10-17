import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listAllAwards } from "@/lib/data";
import { statusLabel, statusTone } from "@/lib/status";
import { StatusPill } from "@/components/app/ui";
import { won, ymd } from "@/lib/format";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/concierge";

export const dynamic = "force-dynamic";

export default async function AdminAwards() {
  await requireSession("admin");
  const list = dbReady() ? await listAllAwards() : [];
  const total = list.reduce((a, x) => a + (x.contract_amount ?? 0), 0);
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
              <tr><th>요청</th><th>의뢰자</th><th>선정 CRO</th><th>선정일</th><th>계약 상태</th><th>계약 보고</th><th>요청 상태</th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/r/${a.rfq?.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{a.rfq?.rfq_no}</Link><div style={{ fontSize: 12, color: "var(--muted)" }}>{a.rfq?.substance}</div></td>
                  <td data-label="의뢰자">{a.rfq?.company}</td>
                  <td data-label="선정 CRO" style={{ fontWeight: 600 }}>{a.cro_name}</td>
                  <td className="tnum" data-label="선정일">{ymd(a.awarded_at)}</td>
                  <td data-label="계약 상태"><span className={`pill ${CONTRACT_STATUS_TONE[a.contract_status] ?? "pill--sf"}`}>{CONTRACT_STATUS_LABEL[a.contract_status] ?? a.contract_status}</span></td>
                  <td className="tnum" data-label="계약 보고">{a.contract_reported_at ? <>{a.contract_date} · <b>{won(a.contract_amount ?? 0)}</b></> : <span style={{ color: "var(--muted)" }}>-</span>}{a.contract_note ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.contract_note}</div> : null}</td>
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
