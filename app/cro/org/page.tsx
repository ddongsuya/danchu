import { requireSession } from "@/lib/auth";
import { dbReady, listOrgMembers, listPendingMembers } from "@/lib/data";
import { OrgMembers } from "@/components/cro/OrgMembers";
import { OrgForm } from "@/components/cro/OrgForm";
import { ThemeSettings } from "@/components/ThemeSettings";
import { LogoutButton } from "@/components/shell/LogoutButton";
import { autoReplyEnabled } from "@/lib/env";
import Link from "next/link";
import { canUse } from "@/lib/plans";
import { todaySeoul } from "@/lib/format";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui/EmptyState";
import "@/components/cro/layout-quote.css";

export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  pending: ["승인 대기", "pill--warn"],
  approved: ["참여 중", "pill--ok"],
  rejected: ["반려", "pill--err"],
  suspended: ["중지", "pill--err"],
};

export default async function CroOrgPage() {
  const s = await requireSession("cro");
  const org = s.org;
  const [members, pending] = org && dbReady() ? await Promise.all([listOrgMembers(org.id), listPendingMembers(org.id)]) : [[], []];
  const isOwner = s.profile.org_role === "owner";
  const st = STATUS[org?.status ?? "pending"];

  return (
    <>
      <div className="ph">
        <div>
          <h1>{org?.name ?? "기관"}</h1>
          <p>{s.profile.name} · {s.email}</p>
        </div>
        <span className={`pill ${st[1]}`}>{st[0]}</span>
      </div>

      {org?.status === "pending" && <div className="note note--warn lq-set__note">운영자가 기관 정보를 확인하는 중이에요. 승인되면 메일로 알려요.</div>}

      <div className="lq-set">
        {org ? (
          <section className="card card--pad lq-set__sec" aria-labelledby="org-info">
            <header className="lq-set__hd">
              <h2 id="org-info">기관 정보</h2>
              <p>GLP 인증과 수행 분야는 회신에 자동으로 채워지고, 배포 대상 선정과 비교표의 제출처 대응 판정에 쓰여요.</p>
            </header>
            {isOwner ? (
              <OrgForm org={org} autoReplyAvailable={autoReplyEnabled()} />
            ) : (
              <div className="card--rows lq-set__rows">
                {[["사업자등록번호", org.business_no], ["웹사이트", org.website], ["소재지", org.address], ["대표 담당자", org.contact_name], ["대표 이메일", org.contact_email], ["대표 연락처", org.contact_phone], ["GLP 인증", org.glp_certs.join(" · ")], ["수행 분야", org.categories.join(" · ")]].map(([k, v]) => (
                  <div key={String(k)} className="kv"><span className="kv__k">{k}</span><span className="kv__v">{v || "-"}</span></div>
                ))}
                <p className="lq-set__hint">기관 정보 수정은 대표 담당자가 해요.</p>
              </div>
            )}
          </section>
        ) : (
          <EmptyState title="소속 기관이 없어요">support@danchu.kr로 알려주세요.</EmptyState>
        )}
        <OrgMembers members={members} pending={pending} isOwner={isOwner} selfId={s.userId} />
        <ThemeSettings />
        <nav className="card card--rows lq-set__links" aria-label="바로가기">
          {canUse(s.org, "tests", todaySeoul()) && (
            <Link href="/cro/catalog" className="kv">
              <span>시험 목록 <small>자주 하는 조건, 소요 기간, 표준가</small></span>
              <CaretRight size={16} aria-hidden="true" />
            </Link>
          )}
          <Link href="/cro/awards" className="kv"><span>수주·계약 보고</span><CaretRight size={16} aria-hidden="true" /></Link>
          <Link href="/cro/profile" className="kv"><span>내 계정 정보</span><CaretRight size={16} aria-hidden="true" /></Link>
          <a href="/terms/cro" className="kv"><span>기관 이용약관</span><CaretRight size={16} aria-hidden="true" /></a>
          <a href="/terms" className="kv"><span>이용약관 · 개인정보처리방침</span><CaretRight size={16} aria-hidden="true" /></a>
        </nav>
        <div className="lq-set__out">
          <LogoutButton className="b2" style={{ alignSelf: "center", padding: "0 24px" }} />
          <span>단추 · support@danchu.kr</span>
        </div>
      </div>
    </>
  );
}
