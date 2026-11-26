import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCroOrg, listInvitesForOrg, listOrgMembers, listPendingMembers } from "@/lib/data";
import { Crumb } from "@/components/app/ui";
import { OrgApproval } from "@/components/admin/OrgApproval";
import { JoinRequests } from "@/components/admin/JoinRequests";
import { OrgTerms } from "@/components/admin/OrgTerms";
import { autoReplyEnabled } from "@/lib/env";
import { ymd, won } from "@/lib/format";
import { inviteStageLabel } from "@/lib/status";
import { ManagedBadge } from "@/components/admin/ManagedBadge";

export const dynamic = "force-dynamic";

const ST: Record<string, [string, string]> = { pending: ["승인 대기", "pill--warn"], approved: ["참여 중", "pill--ok"], rejected: ["반려", "pill--err"], suspended: ["중지", "pill--err"] };

export default async function AdminCro({ params }: { params: Promise<{ id: string }> }) {
  await requireSession("admin");
  const { id } = await params;
  const org = await getCroOrg(id);
  if (!org) notFound();
  const [members, pendingMembers, invites] = await Promise.all([listOrgMembers(org.id), listPendingMembers(org.id), listInvitesForOrg(org.id)]);
  const st = ST[org.status];

  const info: [string, string | null][] = [
    ["사업자등록번호", org.business_no], ["웹사이트", org.website], ["소재지", org.address],
    ["대표 담당자", org.contact_name], ["대표 이메일", org.contact_email], ["대표 연락처", org.contact_phone],
    ["GLP 인증", org.glp_certs.join(" · ")], ["AAALAC", org.aaalac == null ? null : org.aaalac ? "인증" : "없음"], ["기타 인증", org.other_certs],
    ["수행 분야", org.categories.join(" · ")],
  ];

  return (
    <>
      <Crumb href="/admin/cros" label="기관" />
      <div className="ph">
        <div>
          <h1>{org.name}</h1>
          <p className="tnum">신청 {ymd(org.created_at)}{org.approved_at ? ` · 승인 ${ymd(org.approved_at)}` : ""}</p>
        </div>
        <div className="ph__actions"><span className={`pill ${st[1]}`}>{st[0]}</span>{org.managed && <ManagedBadge />}</div>
      </div>
      {org.managed && <p className="note note--tint adm-note">운영자가 등록한 기관입니다. 담당자 계정이 없어 요청서·리마인더 메일은 로그인 없는 회신 링크로 가고, 기관이 보낸 견적서 PDF는 요청 화면의 회신 링크에서 대신 입력합니다. 기관 담당자가 가입해 이 기관에 연결되면 운영자 관리가 풀립니다.</p>}
      <div className="adm-split">
        <div className="adm-col">
          <section className="card adm-box" aria-labelledby="approve-h">
            <h2 id="approve-h" className="adm-box__h">승인 처리</h2>
            <OrgApproval id={org.id} status={org.status} managed={!!org.managed} />
          </section>
          <section className="card adm-box" aria-labelledby="terms-h">
            <h2 id="terms-h" className="adm-box__h">약정 · 운영 설정</h2>
            <p className="adm-box__p">2027년 12월 31일까지 참여한 견적은 청구하지 않습니다. 청구는 2028년 1월 1일부터입니다. 송부 비용과 성사 수수료율은 비우면 요금표를 쓰고, 서면으로 합의한 특별 조건이 있을 때만 적습니다.</p>
            <OrgTerms org={org} autoReplyAvailable={autoReplyEnabled()} />
          </section>
        </div>
        <div className="adm-col">
          <div className="card card--rows">
            <div className="adm-cap">기관 정보</div>
            {info.map(([k, v]) => (
              <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v" style={{ fontWeight: 500 }}>{v || "-"}</span></div>
            ))}
            {org.intro && <div className="kv adm-kv-col"><span className="kv__k">소개</span><span className="adm-pre">{org.intro}</span></div>}
          </div>
          <JoinRequests orgId={org.id} members={pendingMembers} orgEmail={org.contact_email} managed={!!org.managed} />
          <div className="card card--rows">
            <div className="adm-cap">담당자 계정 <span className="tnum">{members.length}</span></div>
            {members.length === 0 && <p className="adm-cap-empty">연결된 계정이 없습니다. 사용자 화면에서 이 기관에 연결할 수 있습니다.</p>}
            {members.map((m) => (
              <div key={m.id} className="kv">
                <span><b className="strong">{m.name || "-"}</b><span className="adm-sub">{m.email}{m.phone ? ` · ${m.phone}` : ""}</span></span>
                <span className="tnum adm-small adm-muted">{ymd(m.created_at)}</span>
              </div>
            ))}
          </div>
          <div className="card card--rows">
            <div className="adm-cap">배포 이력 <span className="tnum">{invites.length}</span></div>
            {invites.length === 0 && <p className="adm-cap-empty">아직 받은 요청이 없습니다.</p>}
            {invites.slice(0, 20).map((i) => (
              <div key={i.id} className="kv adm-small">
                <span><Link href={`/admin/r/${i.rfq_no}`} className="tnum strong">{i.rfq_no}</Link> · {i.rfq?.substance}</span>
                <span className="adm-muted">{inviteStageLabel(i)}{i.quote?.status === "submitted" ? ` · ${won(i.quote.total_amount ?? 0)}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
