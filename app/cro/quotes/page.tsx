import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listInvitesForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { dday, won, ymd } from "@/lib/format";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CroQuotes() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} />;
  const list = (dbReady() ? await listInvitesForOrg(org.id) : []).filter((i) => i.quote && i.status === "submitted");

  return (
    <>
      <div className="ph">
        <div>
          <h1>제출한 견적</h1>
          <p>회신 기한 안에는 수정할 수 있습니다. 결과는 의뢰자 선택 후 안내됩니다.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>제출한 견적이 없습니다</b>
          받은 요청에서 회신을 작성하면 여기에 쌓입니다.
        </div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>요청</th>
                <th>총액</th>
                <th>기간</th>
                <th>제출일</th>
                <th>회신 기한</th>
                <th>진행</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const q = i.quote!;
                const dd = dday(i.reply_by);
                const rs = i.rfq?.status ?? "";
                const result = rs === "selected" || rs === "contracting" || rs === "closed" ? (i.rfq?.selected_quote_id === q.id ? "선정" : "미선정") : statusLabel(rs);
                return (
                  <tr key={i.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{i.rfq?.substance}</div>
                      <div className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{i.rfq_no} · {(i.rfq?.categories ?? []).join(" · ")}</div>
                    </td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{won(q.total_amount ?? 0)}</td>
                    <td className="tnum">{q.total_weeks ? `${q.total_weeks}주` : "—"}</td>
                    <td className="tnum">{ymd(q.submitted_at)}</td>
                    <td className="tnum">{i.reply_by}{dd.n >= 0 ? <span className="pill pill--sf" style={{ marginLeft: 6 }}>{dd.label}</span> : null}</td>
                    <td><span className="pill pill--tint">{result}</span></td>
                    <td><Link href={`/cro/r/${i.id}`} className="b2 bsm">보기</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
