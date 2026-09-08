import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listAllAwards } from "@/lib/data";
import { statusLabel, statusTone } from "@/lib/status";
import { StatusPill } from "@/components/app/ui";
import { won, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAwards() {
  await requireSession("admin");
  const list = dbReady() ? await listAllAwards() : [];
  const total = list.reduce((a, x) => a + (x.contract_amount ?? 0), 0);
  return (
    <>
      <div className="ph">
        <div>
          <h1>수주·계약</h1>
          <p>선정 {list.length}건 · 계약 보고 {list.filter((a) => a.contract_reported_at).length}건 · 보고된 계약금액 합계 {won(total)}</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty"><b>수주가 없습니다</b>의뢰자가 비교표에서 CRO를 선택하면 여기에 쌓입니다.</div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>요청</th><th>의뢰자</th><th>선정 CRO</th><th>선정일</th><th>계약 보고</th><th>상태</th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/r/${a.rfq?.rfq_no}`} className="tnum" style={{ fontWeight: 700 }}>{a.rfq?.rfq_no}</Link><div style={{ fontSize: 12, color: "var(--muted)" }}>{a.rfq?.substance}</div></td>
                  <td>{a.rfq?.company}</td>
                  <td style={{ fontWeight: 600 }}>{a.cro_name}</td>
                  <td className="tnum">{ymd(a.awarded_at)}</td>
                  <td className="tnum">{a.contract_reported_at ? <>{a.contract_date} · <b>{won(a.contract_amount ?? 0)}</b>{a.contract_note ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.contract_note}</div> : null}</> : <span style={{ color: "var(--muted)" }}>대기</span>}</td>
                  <td><StatusPill tone={statusTone(a.rfq?.status)}>{statusLabel(a.rfq?.status)}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
