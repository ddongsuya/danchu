import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import type { Session } from "@/lib/auth";
import { StatusPill } from "@/components/app/ui";
import { AdminHero } from "@/components/admin/AdminHero";
import { StuckList } from "@/components/admin/StuckList";
import { SearchBox } from "@/components/admin/SearchBox";
import { AdminSection, FilterChips } from "@/components/admin/Blocks";
import { RequestFrame, requestTabOf } from "@/components/admin/RequestFrame";
import { AdminActions } from "@/components/admin/AdminActions";
import { RequestTerms } from "@/components/admin/RequestTerms";
import { DeadlineForm } from "@/components/admin/DeadlineForm";
import { DistributePanel } from "@/components/admin/DistributePanel";
import { ContractRecord } from "@/components/admin/ContractRecord";
import { CdaPanel } from "@/components/admin/CdaPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ADMIN_FUNNEL } from "../report-fixtures";
import "@/components/admin/layout-admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "운영자 화면 배치 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/design-preview/admin", label: "접수", icon: "list", exact: true },
  { href: "/design-preview/admin?view=request", label: "요청 상세", icon: "doc" },
  { href: "/design-preview/admin?view=empty", label: "빈 목록", icon: "list" },
  { href: "/design-preview", label: "디자인 검토", icon: "home", exact: true },
];

const STUCK = [
  { rfq_no: "DEMO-007", company: "예시 의뢰사", substance: "예시 물질 C", reasons: [{ kind: "no_join" as const, label: "회신 기한 지남 · 참여 0곳", action: "기한 변경 또는 마무리", days: 19 }] },
  { rfq_no: "DEMO-006", company: "예시 의뢰사", substance: "예시 물질 B", reasons: [{ kind: "contract" as const, label: "예시 기관 A 선택 후 30일 · 계약 보고 없음", action: "기관에 확인", days: 16 }] },
];
const ROWS = [
  ["DEMO-007", "예시 의뢰사", "검토 담당 · preview@example.invalid", "예시 물질 C", "일반독성 · CDA", "distributed", "제출 0 · 참여 0/3", "10-10", "2026-09-26", true],
  ["DEMO-006", "예시 의뢰사", "검토 담당 · preview@example.invalid", "예시 물질 B", "일반독성", "selected", "제출 2 · 참여 2/3", "10-08", "2026-09-24", false],
] as const;

/**
 * 운영자 화면 배치 검토 (시안 v7 a-intake · a-r, 로그인 없이, 저장 안 됨). 미리보기 배포와 DANCHU_DESIGN_PREVIEW=1 에서만 열린다.
 * 실제 화면은 DB 를 읽는 서버 화면이라, 같은 부품(제목 줄 · 필터 · 탭 · 두 열 · 묶음)과 같은 클래스를 예시 데이터로 보여 준다.
 */
export default async function AdminPreview({ searchParams }: { searchParams: Promise<{ view?: string; tab?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const { view, tab: tabStr } = await searchParams;
  const session: Session = {
    userId: "admin-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "admin-preview", email: "preview@example.invalid", role: "admin", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <div className="adm">{view === "request" ? <RequestPreview tab={requestTabOf(tabStr)} today={today} /> : <HomePreview today={today} empty={view === "empty"} />}</div>
      </Shell>
    </AppState>
  );
}

function HomePreview({ today, empty }: { today: string; empty: boolean }) {
  return (
    <>
      <AdminHero f={ADMIN_FUNNEL} stuck={STUCK.map((s) => s.rfq_no)} today={today} actions={<SearchBox q="" placeholder="번호 · 회사 · 시험물질 · 이메일" />} />
      <StuckList rows={STUCK} />
      <AdminSection id="ops" title="이번 주 확인할 것">
        <div className="rs-list">
          <Link href="/design-preview/admin" className="rs-row rs-row--ops"><span className="rs-row__n tnum">2</span><span className="rs-row__main"><b>안내 전 접수</b><span className="rs-row__line">기관에 참여 안내를 보내기 전 요청</span></span><span className="rs-row__go">보기</span></Link>
        </div>
      </AdminSection>
      <AdminSection id="all-requests" title="전체 요청">
        <div className="adm-bar">
          <FilterChips label="요청 상태" items={[["", "전체", 21], ["received", "접수", 2], ["distributed", "참여 안내", 6], ["quoted", "견적 도착", 4], ["compared", "비교표 공개", 3], ["selected", "기관 선택", 3], ["overdue", "기한 지남", 1]].map(([k, label, n]) => ({ href: `/design-preview/admin${k ? `?f=${k}` : ""}`, label: String(label), n: Number(n), on: k === "" }))} />
        </div>
        {empty ? (
          <EmptyState kind="filtered" title="이 상태의 요청이 없습니다" clearHref="/design-preview/admin">검색어나 상태를 바꾸거나 필터를 지우세요.</EmptyState>
        ) : (
          <div className="card tbl-wrap">
            <table className="tbl tbl--stack">
              <thead><tr><th>번호</th><th>의뢰자</th><th>시험물질 · 항목</th><th>상태</th><th>회신</th><th className="num">회신 기한</th><th className="num">접수일</th></tr></thead>
              <tbody>
                {ROWS.map(([no, co, who, sub, cats, st, rep, by, at, late]) => (
                  <tr key={no}>
                    <td className="nowrap"><Link href="/design-preview/admin?view=request" className="tnum strong">{no}</Link></td>
                    <td data-label="의뢰자"><span className="strong">{co}</span><span className="sub">{who}</span></td>
                    <td data-label="시험물질 · 항목"><span className="strong">{sub}</span><span className="sub">{cats}</span></td>
                    <td data-label="상태"><StatusPill tone={st === "selected" ? "ok" : "sf"}>{st === "selected" ? "기관 선택" : "참여 안내"}</StatusPill></td>
                    <td className="tnum" data-label="회신">{rep}</td>
                    <td className="num nowrap" data-label="회신 기한">{by}{late && <span className="sub adm-late">기한 지남</span>}</td>
                    <td className="num" data-label="접수일">{at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </>
  );
}

function RequestPreview({ tab, today }: { tab: ReturnType<typeof requestTabOf>; today: string }) {
  const tags = <><StatusPill tone="sf">참여 안내</StatusPill><span className="tag">IND 제출</span><span className="tag">CDA 필요</span><span className="tag">참여 자리 3곳</span></>;
  const stuck = [{ kind: "no_join" as const, label: "회신 기한 지남 · 참여 0곳", action: "기한 변경 또는 마무리", days: 19 }];
  const invites = [["예시 기관 A", "참여 결정 전", "-", "10-01 14:20"], ["예시 기관 B", "불참", "-", "09-30 09:12"]];
  const body = tab === "dist" ? (
    <section className="card adm-box"><h2 className="adm-box__h">참여 안내 추가</h2><DistributePanel no="DEMO-007" categories={["일반독성"]} defaultReplyBy={today} replyByLocked nomineesOnly={false} orgs={[{ id: "o1", name: "예시 기관 C", categories: ["일반독성"], glp: ["MFDS"], email: "preview@example.invalid", members: 2, invited: false }, { id: "o2", name: "예시 기관 A", categories: ["일반독성"], glp: [], email: "preview@example.invalid", members: 1, invited: true }]} today={today} autoDistribute /></section>
  ) : tab === "cda" ? <CdaPanel no="DEMO-007" invites={[{ id: "i1", cro_name: "예시 기관 A", cda_signed_at: null }]} />
  : tab === "contract" ? (
    <div className="adm-split"><div className="adm-col"><AdminSection title="계약 기록"><ContractRecord awardId="a1" status="pending" reported={false} today={today} minDate={today} note={null} quoteAmount={120000000} /></AdminSection></div>
      <div className="adm-col"><div className="card card--rows"><div className="adm-cap">선정</div><div className="kv"><span className="kv__k">선정 기관</span><span className="kv__v">예시 기관 A</span></div><div className="kv"><span className="kv__k">계약 보고</span><span className="kv__v">없음</span></div></div></div></div>
  ) : tab === "hist" ? (
    <AdminSection title="이력" count={2}><div className="card card--rows adm-events"><div><time>09-26 09:12</time><span><b>요청서 접수</b></span></div><div><time>09-26 10:00</time><span><b>참여 안내</b><span> · 기관 2곳</span></span></div></div></AdminSection>
  ) : (
    <div className="adm-split">
      <div className="adm-col">
        <AdminSection title="회신 현황" count="참여 0/3 · 제출 0 · 안내 2" actions={<><span className="adm-line tnum">기한 10-10<span className="pill pill--warn">지남</span></span><DeadlineForm no="DEMO-007" current="2026-10-10" min={today} /></>}>
          <div className="card tbl-wrap">
            <table className="tbl tbl--stack">
              <thead><tr><th>기관</th><th>상태</th><th>참여</th><th>열람</th><th className="num">총액 · 기간</th><th>링크</th></tr></thead>
              <tbody>
                {invites.map(([n, st, j, o]) => (
                  <tr key={n}><td><span className="strong">{n}</span><span className="sub">preview@example.invalid · 기한 2026-10-10</span></td><td data-label="상태"><span className="pill pill--sf">{st}</span></td><td data-label="참여" className="tnum adm-small">{j}</td><td data-label="열람" className="tnum adm-small">{o}</td><td data-label="총액 · 기간" className="num">-</td><td data-label="링크" className="adm-small"><Link href="/design-preview/admin?view=request">요약 보기</Link></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      </div>
      <div className="adm-col">
        <section className="card adm-box"><h2 className="adm-box__h">진행 관리</h2><RequestTerms no="DEMO-007" croCount="3곳" confidentiality="CDA 필요" /><AdminActions no="DEMO-007" status="distributed" submitted={0} pending={2} early={false} closed={false} note="" award={null} /></section>
        <div className="card card--rows"><div className="adm-cap">의뢰자</div><div className="kv"><span className="kv__k">회사</span><span className="kv__v">예시 의뢰사</span></div><div className="kv"><span className="kv__k">이메일</span><span className="kv__v">preview@example.invalid</span></div></div>
      </div>
    </div>
  );
  return (
    <RequestFrame no="DEMO-007" substance="예시 물질 C" company="예시 의뢰사" createdAt="2026-09-26" tags={tags} stuck={stuck} tab={tab} showCda base="/design-preview/admin?view=request">
      {body}
    </RequestFrame>
  );
}
