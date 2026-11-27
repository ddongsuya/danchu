import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import type { Session } from "@/lib/auth";
import type { RfqSummary } from "@/lib/data";
import type { Stuck } from "@/lib/stuck";
import { StatusPill } from "@/components/app/ui";
import { IntakeBoard, type IntakeQuery, type IntakeTab } from "@/components/admin/IntakeBoard";
import { RequestFrame, requestTabOf } from "@/components/admin/RequestFrame";
import { AdminActions, MemoForm } from "@/components/admin/AdminActions";
import { AdminSection, FilterChips } from "@/components/admin/Blocks";
import { RequestTerms } from "@/components/admin/RequestTerms";
import { DeadlineForm } from "@/components/admin/DeadlineForm";
import { DistributePanel } from "@/components/admin/DistributePanel";
import { ContractRecord } from "@/components/admin/ContractRecord";
import { CdaPanel } from "@/components/admin/CdaPanel";
import { LoadError } from "@/components/admin/LoadError";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import "@/components/admin/layout-admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "운영자 화면 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/design-preview/admin", label: "접수", icon: "list", exact: true, group: "운영" },
  { href: "/design-preview/admin?view=request", label: "요청 상세", icon: "doc", group: "운영" },
  { href: "/design-preview/admin?view=cros", label: "기관", icon: "cros", group: "운영", badge: 2 },
  { href: "/design-preview", label: "디자인 검토", icon: "home", exact: true, group: "요청·기록" },
];

// 예시 데이터 (검토용 가상 값, 실제 화면은 DB 를 읽는다)
const ROW = (no: string, status: string, sent: number, joined: number, extra: Partial<RfqSummary> = {}): RfqSummary => ({
  id: no, rfq_no: no, company: "예시 의뢰사", contact_name: "검토 담당", substance: "예시 물질", status, outcome: null, payload: {}, created_at: "2026-11-10T00:00:00Z",
  reply_by: "2026-11-20", distributed_at: "2026-11-10T01:00:00Z", compared_at: null, cro_count: "3곳", sent, joined, cap: 3, submitted: 0, opened: 1, ...extra,
}) as unknown as RfqSummary;
const LIST: RfqSummary[] = [
  ROW("DEMO-0021", "distributed", 3, 1),
  ROW("DEMO-0019", "quoted", 3, 3, { submitted: 1 }),
  ROW("DEMO-0012", "selected", 3, 3, { submitted: 3 }),
  ROW("DEMO-0007", "distributed", 3, 0, { reply_by: "2026-11-08" }),
];
const STUCK = new Map<string, Stuck[]>([["DEMO-0007", [{ kind: "no_join", label: "회신 기한 지남 · 참여 0곳", action: "기한 변경 또는 마무리", days: 19 }]]]);

/**
 * 운영자 화면 검토 (시안 검토판 a-intake · a-r · a-cros, 로그인 없이, 저장 안 됨). 미리보기 배포와 DANCHU_DESIGN_PREVIEW=1 에서만 열린다.
 * 실제 화면과 같은 부품(IntakeBoard · RequestFrame · 패널)에 예시 데이터를 넣는다. ?state= 로 빈 상태 · 검색 0건 · 불러오기 실패 · 뼈대를 본다.
 */
export default async function AdminPreview({ searchParams }: { searchParams: Promise<{ view?: string; tab?: string; state?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const { view, tab: tabStr, state = "" } = await searchParams;
  const session: Session = {
    userId: "admin-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "admin-preview", email: "preview@example.invalid", role: "admin", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const body = state === "load" ? <AdminSkeleton kind={view === "cros" ? "list" : "split"} />
    : view === "request" ? <RequestPreview tab={requestTabOf(tabStr)} today={today} failed={state === "err"} />
    : view === "cros" ? <CrosPreview state={state} />
    : <IntakePreview state={state} />;
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <div className="adm">{body}</div>
      </Shell>
    </AppState>
  );
}

function IntakePreview({ state }: { state: string }) {
  const tab: IntakeTab = state === "stuck0" ? "stuck" : "all";
  const query: IntakeQuery = { tab, q: state === "zero" ? "KR-0932" : "", status: "", sel: "DEMO-0007", page: 1 };
  const list = state === "zero" || state === "stuck0" || state === "err" ? [] : LIST;
  return <IntakeBoard list={list} hasMore={false} query={query} counts={{ stuck: state === "stuck0" ? 0 : 1, live: 4, won: 1, all: 5, byStatus: { distributed: 2, quoted: 1, selected: 1 } }} stuck={STUCK} failed={state === "err"} />;
}

function CrosPreview({ state }: { state: string }) {
  const rows = [["예시 기관 E", "일반독성 · 유전독성", "11-09"], ["예시 기관 F", "효력시험(약효)", "11-12"]];
  return (
    <>
      <div className="ph"><div><h1>기관</h1></div><div className="ph__actions"><button type="button" className="b1 bsm">기관 추가</button></div></div>
      <div className="adm-bar">
        <FilterChips label="기관 상태" items={[["", "전체", 6], ["pending", "승인 대기", 2], ["approved", "참여 중", 4]].map(([k, label, n]) => ({ href: `/design-preview/admin?view=cros${k ? `&f=${k}` : ""}`, label: String(label), n: Number(n), on: k === "pending" }))} />
      </div>
      {state === "zero" ? <EmptyState kind="filtered" title="'예시 기관 Z'와 맞는 기관이 없어요" action={<Link href="/design-preview/admin?view=cros" className="b2 bsm">검색 지우기</Link>} />
        : state === "fz" ? <EmptyState kind="filtered" title="승인 대기 기관이 없어요" action={<Link href="/design-preview/admin?view=cros" className="b2 bsm">전체 보기</Link>} />
        : state === "err" ? <LoadError title="기관 목록을 불러오지 못했어요" />
        : (
          <div className="card tbl-wrap">
            <table className="tbl tbl--stack">
              <thead><tr><th>기관</th><th>상태</th><th>수행 분야</th><th>담당자</th><th className="num">신청일</th><th><span className="sr-only">상세</span></th></tr></thead>
              <tbody>
                {rows.map(([n, c, d]) => (
                  <tr key={n}><td><span className="strong">{n}</span><span className="sub">preview@example.invalid</span></td><td data-label="상태"><span className="pill pill--warn">승인 대기</span></td><td data-label="수행 분야" className="adm-small">{c}</td><td data-label="담당자" className="adm-small">대표 계정</td><td className="num tnum" data-label="신청일">{d}</td><td className="tbl__act"><span className="b2 bsm">상세</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

function RequestPreview({ tab, today, failed }: { tab: ReturnType<typeof requestTabOf>; today: string; failed: boolean }) {
  const tags = <><StatusPill tone="sf">견적 도착</StatusPill><span className="tag">허가자료 제출용</span><span className="tag">CDA 필요</span><span className="tag">참여 자리 3곳</span></>;
  const stuck: Stuck[] = [];
  const invites = [["예시 기관 A", "작성 중", "11-11 10:02 · 링크", "11-10 14:20", "-", true], ["예시 기관 B", "제출", "11-11 09:40 · 기관 계정", "11-10 09:12", "34,000,000 · 8주", false], ["예시 기관 C", "작성 중", "11-12 16:00 · 링크", "11-11 11:05", "-", true]] as const;
  const manage: [string, string][] = [["상태", "견적 도착"], ["회신 기한", "11월 20일 (D-2)"], ["참여 결정 기한", "11월 12일"], ["보낸 기관", "3곳"], ["참여 자리", "자리 3곳 모두 찼어요"], ["기밀 등급", "CDA 필요"]];
  const deadline = <DeadlineForm no="DEMO-0019" current="2026-11-20" min="2026-11-21" invited={3} distributed />;
  const body = failed ? <LoadError title="요청을 불러오지 못했어요" />
    : tab === "dist" ? (
      <DistributePanel no="DEMO-0019" categories={["유전독성"]} defaultReplyBy="2026-11-20" replyByLocked orgs={[
        { id: "o1", name: "예시 기관 C", categories: ["일반독성", "유전독성"], glp: ["MFDS"], email: "preview@example.invalid", members: 2, invited: true, sentAt: "2026-11-10T01:00:00Z", openedAt: null },
        { id: "o2", name: "예시 기관 A", categories: ["일반독성", "유전독성", "안전성약리"], glp: [], email: "preview@example.invalid", members: 1, invited: false },
        { id: "o3", name: "예시 기관 D", categories: ["안전성약리"], glp: [], email: null, members: 1, invited: false },
      ]} today={today} autoDistribute />
    ) : tab === "cda" ? <CdaPanel no="DEMO-0019" files={2} invites={[{ id: "i1", cro_name: "예시 기관 D", cda_signed_at: null, joined_at: "2026-11-14T00:00:00Z" }, { id: "i2", cro_name: "예시 기관 A", cda_signed_at: null, joined_at: null }]} />
    : tab === "contract" ? (
      <div className="adm-split">
        <div className="adm-col"><AdminSection id="contract" title="계약 기록"><ContractRecord awardId="a1" status="pending" reported={false} today={today} minDate="2026-11-12" note={null} quoteAmount={112000000} /></AdminSection></div>
        <div className="adm-col">
          <div className="card card--rows">{[["선정 기관", "예시 기관 A"], ["선정일", "11월 12일"], ["선정 금액", "112,000,000원"], ["계약 보고 기한", "11월 26일 (D-8)"], ["계약 보고", "없음"]].map(([k, v]) => <div key={k} className="kv"><span className="kv__k">{k}</span><span className="kv__v tnum">{v}</span></div>)}</div>
          <section className="card adm-box"><h2 className="adm-box__h">조치</h2><div className="kv"><span><b className="strong">기관에 확인</b><span className="adm-sub">예시 기관 A</span></span><span className="b2 bsm">기관에 메일</span></div></section>
        </div>
      </div>
    ) : tab === "hist" ? (
      <AdminSection id="history" title="이력" count={3} actions={<span className="adm-head-acts"><span className="b2 bsm">질의응답 기록</span><DeadlineForm no="DEMO-0019" current="2026-11-20" min="2026-11-21" invited={3} distributed primary /></span>}>
        <div className="card card--rows adm-events"><div><time>11월 10일 09:20</time><span><b>요청서 접수</b></span></div><div><time>11월 10일 09:20</time><span><b>기관 3곳 참여 안내</b></span></div><div><time>11월 11일 11:02</time><span><b>예시 기관 D 요약 열람</b></span></div></div>
      </AdminSection>
    ) : (
      <div className="adm-split">
        <div className="adm-col">
          <AdminSection id="replies" title="회신 현황" count="참여 3/3곳 · 제출 1 · 안내 3">
            <div className="card tbl-wrap">
              <table className="tbl tbl--stack">
                <thead><tr><th>기관</th><th>상태</th><th>참여</th><th>열람</th><th className="num">총액 · 기간</th><th>링크</th></tr></thead>
                <tbody>
                  {invites.map(([n, st, j, o, t, proxy]) => (
                    <tr key={n}><td><span className="strong">{n}</span><span className="sub">preview@example.invalid · 기한 2026-11-20</span></td><td data-label="상태"><span className={`pill ${st === "제출" ? "pill--ok" : "pill--warn"}`}>{st}</span></td><td data-label="참여" className="tnum adm-small">{j}</td><td data-label="열람" className="tnum adm-small">{o}</td><td data-label="총액 · 기간" className="num">{t}</td><td data-label="링크" className="adm-small">{proxy ? <span className="adm-link">대신 입력</span> : null}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminSection>
        </div>
        <div className="adm-col">
          <section className="card adm-box"><h2 className="adm-box__h">진행 관리</h2><dl className="adm-dl">{manage.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>)}</dl><RequestTerms no="DEMO-0019" croCount="3곳" confidentiality="CDA 필요" /><AdminActions no="DEMO-0019" status="quoted" submitted={1} pending={2} early closed={false} award={null} /></section>
          <section className="card adm-box"><h2 className="adm-box__h">운영 메모 (내부용)</h2><MemoForm no="DEMO-0019" note="예시 기관 C는 견적서 PDF를 메일로 보냄" /></section>
        </div>
      </div>
    );
  return (
    <RequestFrame no="DEMO-0019" substance="복귀돌연변이(Ames, TG 471) 외 2" company="예시 의뢰사" createdAt="2026-11-10" tags={failed ? null : tags} stuck={stuck} tab={tab} showCda actions={tab === "hist" ? null : deadline} base="/design-preview/admin?view=request">
      {body}
    </RequestFrame>
  );
}
