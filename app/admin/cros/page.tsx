import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listCroOrgs } from "@/lib/data";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = { pending: ["승인 대기", "pill--warn"], approved: ["참여 중", "pill--ok"], rejected: ["반려", "pill--err"], suspended: ["중지", "pill--err"] };

export default async function AdminCros({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession("admin");
  const { status = "" } = await searchParams;
  const list = dbReady() ? await listCroOrgs(status || undefined) : [];
  const pending = list.filter((o) => o.status === "pending");
  const rest = status ? list : list.filter((o) => o.status !== "pending");

  const Table = ({ rows }: { rows: typeof list }) => (
    <div className="card tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>기관</th><th>상태</th><th>GLP</th><th>수행 분야</th><th>담당자</th><th>신청일</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/cros/${o.id}`} style={{ fontWeight: 700 }}>{o.name}</Link>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{o.contact_name} · {o.contact_email}</div>
              </td>
              <td><span className={`pill ${ST[o.status][1]}`}>{ST[o.status][0]}</span></td>
              <td style={{ fontSize: 12 }}>{o.glp_certs.join(" · ") || "—"}</td>
              <td style={{ fontSize: 12 }}>{o.categories.join(" · ") || "—"}</td>
              <td className="tnum">{o.members}</td>
              <td className="tnum">{ymd(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>CRO 기관</h1>
          <p>가입 신청을 검토하고 승인합니다. 승인된 기관에만 요청서가 배포됩니다.</p>
        </div>
        <div className="ph__actions">
          <Link href="/admin/cros" className={`b2 bsm`} aria-pressed={!status}>전체</Link>
          <Link href="/admin/cros?status=pending" className="b2 bsm" aria-pressed={status === "pending"}>승인 대기</Link>
          <Link href="/admin/cros?status=approved" className="b2 bsm" aria-pressed={status === "approved"}>참여 중</Link>
        </div>
      </div>
      {!status && pending.length > 0 && (
        <>
          <div className="sec-title" style={{ marginTop: 0 }}><h2>승인 대기 {pending.length}</h2></div>
          <Table rows={pending} />
        </>
      )}
      <div className="sec-title"><h2>{status ? ST[status]?.[0] ?? "기관" : "전체 기관"} {rest.length}</h2></div>
      {rest.length === 0 ? <div className="empty"><b>기관이 없습니다</b>CRO가 가입 신청하면 여기에 나타납니다.</div> : <Table rows={rest} />}
    </>
  );
}
