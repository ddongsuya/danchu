import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCroOrg, listInvitesForOrg, listOrgMembers } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { OrgApproval } from "@/components/admin/OrgApproval";
import { ymd, won } from "@/lib/format";
import { INVITE_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = { pending: ["승인 대기", "pill--warn"], approved: ["참여 중", "pill--ok"], rejected: ["반려", "pill--err"], suspended: ["중지", "pill--err"] };

export default async function AdminCro({ params }: { params: Promise<{ id: string }> }) {
  await requireSession("admin");
  const { id } = await params;
  const org = await getCroOrg(id);
  if (!org) notFound();
  const [members, invites] = await Promise.all([listOrgMembers(org.id), listInvitesForOrg(org.id)]);
  const st = ST[org.status];

  return (
    <>
      <Crumb href="/admin/cros" label="CRO 기관" />
      <div className="ph">
        <div>
          <h1>{org.name}</h1>
          <p>신청 {ymd(org.created_at)}{org.approved_at ? ` · 승인 ${ymd(org.approved_at)}` : ""}</p>
        </div>
        <span className={`pill ${st[1]}`}>{st[0]}</span>
      </div>
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card card--rows">
            {[
              ["사업자등록번호", org.business_no], ["웹사이트", org.website], ["소재지", org.address],
              ["대표 담당자", org.contact_name], ["대표 이메일", org.contact_email], ["대표 연락처", org.contact_phone],
              ["GLP 인증", org.glp_certs.join(" · ")], ["AAALAC", org.aaalac == null ? null : org.aaalac ? "인증" : "없음"], ["기타 인증", org.other_certs],
              ["수행 분야", org.categories.join(" · ")],
            ].map(([k, v]) => (
              <div key={String(k)} className="kv"><span className="kv__k">{k}</span><span className="kv__v" style={{ fontWeight: 500 }}>{v || "—"}</span></div>
            ))}
            {org.intro && <div className="kv" style={{ flexDirection: "column", gap: 4 }}><span className="kv__k">소개</span><span style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{org.intro}</span></div>}
          </div>
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>승인 처리</h2>
            <OrgApproval id={org.id} status={org.status} />
          </div>
        </div>
        <div className="stack">
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>담당자 계정 {members.length}</div>
            {members.length === 0 && <p style={{ padding: "8px 0 12px", fontSize: 13, color: "var(--muted)" }}>연결된 계정이 없습니다. 사용자 탭에서 이 기관에 연결할 수 있습니다.</p>}
            {members.map((m) => (
              <div key={m.id} className="kv">
                <span><b style={{ fontWeight: 600 }}>{m.name || "—"}</b><span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></span>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{ymd(m.created_at)}</span>
              </div>
            ))}
          </div>
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>배포 이력 {invites.length}</div>
            {invites.length === 0 && <p style={{ padding: "8px 0 12px", fontSize: 13, color: "var(--muted)" }}>없음</p>}
            {invites.slice(0, 20).map((i) => (
              <div key={i.id} className="kv" style={{ fontSize: 13 }}>
                <span><b className="tnum" style={{ fontWeight: 600 }}>{i.rfq_no}</b> · {i.rfq?.substance}</span>
                <span style={{ color: "var(--muted)" }}>{INVITE_LABEL[i.status] ?? i.status}{i.quote?.status === "submitted" ? ` · ${won(i.quote.total_amount ?? 0)}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
