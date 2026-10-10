import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCroOrg, listInvitesForOrg, listOrgClients, listOrgMembers, listPendingMembers } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { OrgApproval } from "@/components/admin/OrgApproval";
import { JoinRequests } from "@/components/admin/JoinRequests";
import { OrgTerms } from "@/components/admin/OrgTerms";
import { autoReplyEnabled } from "@/lib/env";
import { ymd, won } from "@/lib/format";
import { INVITE_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = { pending: ["승인 대기", "pill--warn"], approved: ["참여 중", "pill--ok"], rejected: ["반려", "pill--err"], suspended: ["중지", "pill--err"] };

export default async function AdminCro({ params }: { params: Promise<{ id: string }> }) {
  await requireSession("admin");
  const { id } = await params;
  const org = await getCroOrg(id);
  if (!org) notFound();
  const [members, pendingMembers, invites, clients] = await Promise.all([listOrgMembers(org.id), listPendingMembers(org.id), listInvitesForOrg(org.id), listOrgClients(org.id)]);
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
              <div key={String(k)} className="kv"><span className="kv__k">{k}</span><span className="kv__v" style={{ fontWeight: 500 }}>{v || "-"}</span></div>
            ))}
            {org.intro && <div className="kv" style={{ flexDirection: "column", gap: 4 }}><span className="kv__k">소개</span><span style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{org.intro}</span></div>}
          </div>
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>승인 처리</h2>
            <OrgApproval id={org.id} status={org.status} />
          </div>
          <div className="card card--pad">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>약정 · 운영 설정</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>전달 1건이 청구 1건입니다. 단가와 월 한도는 기관과 약정한 값을 적고, 전달 명세의 집계에 그대로 쓰입니다.</p>
            <OrgTerms org={org} autoReplyAvailable={autoReplyEnabled()} />
          </div>
        </div>
        <div className="stack">
          <JoinRequests orgId={org.id} members={pendingMembers} />
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>담당자 계정 {members.length}</div>
            {members.length === 0 && <p style={{ padding: "8px 0 12px", fontSize: 13, color: "var(--muted)" }}>연결된 계정이 없습니다. 사용자 탭에서 이 기관에 연결할 수 있습니다.</p>}
            {members.map((m) => (
              <div key={m.id} className="kv">
                <span><b style={{ fontWeight: 600 }}>{m.name || "-"}</b><span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></span>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{ymd(m.created_at)}</span>
              </div>
            ))}
          </div>
          <div className="card card--rows">
            <div style={{ padding: "12px 0 4px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>기관이 등록한 기존 고객 {clients.length}</div>
            {clients.length === 0 && <p style={{ padding: "8px 0 12px", fontSize: 13, color: "var(--muted)" }}>없음. 기관 대표 담당자가 내 기관 화면에서 등록합니다. 선정 시 의뢰자 회사명과 대조해 성사수수료 면제 후보로 표시됩니다.</p>}
            {clients.slice(0, 50).map((c) => (
              <div key={c.id} className="kv" style={{ fontSize: 13 }}>
                <span><b style={{ fontWeight: 600 }}>{c.name}</b>{c.business_no ? <span style={{ color: "var(--muted)" }}> · {c.business_no}</span> : null}</span>
                <span className="tnum" style={{ color: "var(--muted)" }}>{c.last_contract_on ? `마지막 계약 ${c.last_contract_on}` : "-"}</span>
              </div>
            ))}
            {clients.length > 50 && <p style={{ padding: "8px 0 12px", fontSize: 12, color: "var(--muted)" }}>외 {clients.length - 50}곳</p>}
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
