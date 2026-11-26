import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dbReady, listCroOrgs } from "@/lib/data";
import { ymd } from "@/lib/format";
import { QuickApprove } from "@/components/admin/QuickApprove";
import { SearchBox } from "@/components/admin/SearchBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ManagedBadge } from "@/components/admin/ManagedBadge";
import { ManagedOrgForm } from "@/components/admin/ManagedOrgForm";
import { AdminSection, FilterChips } from "@/components/admin/Blocks";

export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = { pending: ["승인 대기", "pill--warn"], approved: ["참여 중", "pill--ok"], rejected: ["반려", "pill--err"], suspended: ["중지", "pill--err"] };

export default async function AdminCros({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireSession("admin");
  const { status = "", q = "" } = await searchParams;
  const list = dbReady() ? await listCroOrgs(status || undefined, q || undefined) : [];
  const pending = list.filter((o) => o.status === "pending");
  const rest = status ? list : list.filter((o) => o.status !== "pending");

  const Table = ({ rows }: { rows: typeof list }) => (
    <div className="card tbl-wrap">
      <table className="tbl tbl--stack">
        <thead>
          <tr><th>기관</th><th>상태</th><th>GLP</th><th>수행 분야</th><th className="num">담당자</th><th className="num">신청일</th><th><span className="sr-only">처리</span></th></tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/cros/${o.id}`} className="strong">{o.name}</Link>{o.managed && <ManagedBadge />}
                <span className="sub">{o.contact_name} · {o.contact_email}</span>
              </td>
              <td data-label="상태"><span className={`pill ${ST[o.status][1]}`}>{ST[o.status][0]}</span></td>
              <td data-label="GLP" className="adm-small">{o.glp_certs.join(" · ") || "-"}</td>
              <td data-label="수행 분야" className="adm-small">{o.categories.join(" · ") || "-"}</td>
              <td className="num" data-label="담당자">{o.members}</td>
              <td className="num" data-label="신청일">{ymd(o.created_at)}</td>
              <td className="tbl__act nowrap">
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  {o.status === "pending" && <QuickApprove id={o.id} name={o.name} />}
                  <Link href={`/admin/cros/${o.id}`} className="b2 bsm">상세</Link>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const chips = [["", "전체"], ["pending", "승인 대기"], ["approved", "참여 중"]].map(([k, label]) => ({ href: `/admin/cros?${new URLSearchParams({ ...(k ? { status: k } : {}), ...(q ? { q } : {}) })}`, label, on: status === k }));

  return (
    <>
      <div className="ph">
        <div>
          <h1>기관</h1>
          <p>가입 신청을 검토하고 승인합니다. 승인된 기관에만 참여 안내가 갑니다. 가입 전 기관은 운영자 관리 기관으로 직접 추가합니다.</p>
        </div>
      </div>
      <ManagedOrgForm />
      <div className="adm-bar">
        <FilterChips label="기관 상태" items={chips} />
        <div className="adm-bar__end"><SearchBox q={q} placeholder="기관명 · 대표 이메일 · 사업자번호" keep={{ status }} /></div>
      </div>
      {!status && pending.length > 0 && (
        <AdminSection id="pending" title="승인 대기" count={pending.length}>
          <Table rows={pending} />
        </AdminSection>
      )}
      <AdminSection id="orgs" title={status ? ST[status]?.[0] ?? "기관" : "전체 기관"} count={rest.length}>
        {rest.length === 0
          ? (q || status
            ? <EmptyState kind="filtered" title={q ? `"${q}"에 맞는 기관이 없습니다` : "이 상태의 기관이 없습니다"} clearHref="/admin/cros" />
            : <EmptyState title="기관 없음" />)
          : <Table rows={rest} />}
      </AdminSection>
    </>
  );
}
