import { NewRequest } from "@/components/NewRequest";
import { CompareBoard } from "@/components/CompareBoard";
import { INC_COLS, INC_ROWS, UX_COLS, UX_ROWS, UX_SCHEDULE } from "./ux-fixtures";
import { ScheduleGantt } from "@/components/ScheduleGantt";
import { planQuote } from "@/lib/schedule";
import { ReplyForm } from "@/components/cro/ReplyForm";
import { PayScheduleField } from "@/components/cro/PayScheduleField";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { RequestOverview, type RequestListItem } from "@/components/app/RequestOverview";
import { ThemeSettings } from "@/components/ThemeSettings";
import type { Role, Session } from "@/lib/auth";
import { StuckList } from "@/components/admin/StuckList";
import { NextStep } from "@/components/app/NextStep";
import { RequestStory } from "@/components/app/RequestStory";
import { ReqColumn, ReqThreads, ReqTop, type ReqThread } from "@/components/app/ReqShell";
import { CompareReport } from "@/components/app/CompareReport";
import { croItems, croStoryFixture, REPORT_COLS, REPORT_ROWS, STORY_FUNNEL } from "./report-fixtures";
import { previewEnabled } from "./cro-crm/fixtures";
import { CroHome } from "@/components/cro/CroHome";
import { CroStory } from "@/components/cro/CroStory";
import type { Loaded } from "@/lib/quote-load";
import "./preview.css";

export const metadata: Metadata = { title: "단추 디자인 검토", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const REQUESTS: RequestListItem[] = [
  { id: "preview-1", rfq_no: "DEMO-001", status: "compared", substance: "예시 물질 A · 반복투여 독성", categories: ["일반독성", "PK/TK/ADME·생체시료분석"], joined: 3, cap: 3, submitted: 3, sent: 5, opened: 4, reply_by: "2026-10-08", created_at: "2026-09-29", compared_at: "2026-10-09T00:00:00Z", selected_quote_id: null, started_at: "2026-09-29" },
  { id: "preview-2", rfq_no: "DEMO-002", status: "distributed", substance: "예시 물질 B · 유전독성", categories: ["유전독성"], joined: 3, cap: 5, submitted: 2, sent: 6, opened: 5, reply_by: "2026-11-12", created_at: "2026-09-28", compared_at: null, selected_quote_id: null, started_at: "2026-09-28" },
  { id: "preview-5", rfq_no: "DEMO-005", status: "distributed", substance: "예시 물질 E · 안전성약리", categories: ["안전성약리"], joined: 0, cap: 3, submitted: 0, sent: 4, opened: 2, reply_by: "2026-10-20", created_at: "2026-10-06", compared_at: null, selected_quote_id: null, started_at: "2026-10-06" },
  { id: "preview-3", rfq_no: "DEMO-003", status: "received", substance: "예시 물질 C · 안전성약리", categories: ["안전성약리"], joined: 0, cap: 3, submitted: 0, sent: 0, opened: 0, reply_by: "2026-11-15", created_at: "2026-09-27", compared_at: null, selected_quote_id: null, started_at: null },
  { id: "preview-4", rfq_no: "DEMO-004", status: "closed", substance: "예시 물질 D · 조제물분석", categories: ["조제물분석"], joined: 3, cap: 3, submitted: 3, sent: 3, opened: 3, reply_by: "2026-09-20", created_at: "2026-09-16", compared_at: "2026-09-21T00:00:00Z", selected_quote_id: "q", started_at: "2026-09-16" },
];

/** Isolated visual fixtures. No auth bypass, DB reads, or mutations. Off by default. */
export default async function DesignPreview({ searchParams }: { searchParams: Promise<{ role?: string; empty?: string; view?: string; q?: string }> }) {
  if (!previewEnabled()) notFound();
  const params = await searchParams;
  // 운영자 홈·요청 상세 배치는 /design-preview/admin 으로 옮겼다 (시안 v7)
  if (params.view === "admin-home") redirect("/design-preview/admin");
  if (params.view === "admin-story") redirect("/design-preview/admin?view=request");
  const role: Role = params.role === "cro" || params.role === "admin" ? params.role : "requester";
  const session: Session = { userId: "design-preview", email: "preview@example.invalid", org: null, pendingOrg: null, profile: { id: "design-preview", email: "preview@example.invalid", role, name: "디자인 검토", company: "예시 워크스페이스", dept: null, phone: null, org_type: null, cro_org_id: null } };
  const nav: NavItem[] = role === "requester" ? [
    { href: "/design-preview", label: "내 견적 요청", icon: "home", exact: true }, { href: "/app/new", label: "새 견적 요청", icon: "plus" }, { href: "/app/notifications", label: "알림", icon: "bell" }, { href: "/app/profile", label: "프로필", icon: "user" },
  ] : role === "cro" ? [
    { href: "/design-preview?role=cro", label: "받은 요청", icon: "inbox" }, { href: "/cro/quotes", label: "제출한 견적", icon: "doc" }, { href: "/cro/awards", label: "수주 현황", icon: "award" }, { href: "/cro/org", label: "기관 정보", icon: "org" },
  ] : [
    { href: "/design-preview?role=admin", label: "접수 현황", icon: "list" }, { href: "/admin/cros", label: "기관 관리", icon: "cros" }, { href: "/admin/awards", label: "계약 현황", icon: "award" }, { href: "/admin/users", label: "사용자 관리", icon: "user" },
  ];
  // 의뢰자: ChatGPT 짜임 (2026-11-26 시안 v7). 사이드바 요청 목록은 예시 요청, 경로는 보는 화면에 맞춘다
  const reqPath = params.view === "story" || params.view === "story-contract" ? "/app/r/DEMO-005" : params.view === "report" ? "/app/r/DEMO-001/compare" : "/app";
  const threads: ReqThread[] = (params.empty === "1" ? [] : REQUESTS).map((r) => ({ no: r.rfq_no, substance: r.substance, categories: r.categories, done: ["closed", "cancelled"].includes(r.status) }));
  const chat = role === "requester" ? { side: <ReqThreads items={threads} path={reqPath} />, top: <ReqTop items={threads} path={reqPath} /> } : undefined;
  const reqNav: NavItem[] = [
    { href: "/app/new", label: "새 견적 요청", icon: "plus" }, { href: "/design-preview?q=", label: "요청 검색", icon: "search" }, { href: "/app/notifications", label: "알림", icon: "bell", badge: 2 }, { href: "/guide/library", label: "가이드라인 자료실", icon: "book" },
  ];
  return <AppState><Shell session={session} nav={chat ? reqNav : nav} tabs={chat ? nav : undefined} chat={chat}><ReqColumn path={chat ? reqPath : "/app/r/x"}>
    <div className="preview-banner"><b>디자인 검토용 예시 데이터</b><p>실제 요청·기관·실적이 아니에요. 업무 링크는 기존 인증 화면으로 연결돼요.</p><nav aria-label="디자인 검토 화면"><Link href="/design-preview">의뢰자 화면</Link><Link href="/design-preview?empty=1">빈 목록</Link><Link href="/design-preview?role=cro">CRO 공통 UI</Link><Link href="/design-preview?role=admin">운영자 공통 UI</Link><Link href="/design-preview?view=request">요청서 개선</Link><Link href="/design-preview?view=compare">견적 비교 개선</Link><Link href="/design-preview?view=story">요청 진행</Link><Link href="/design-preview?view=story-contract">요청 계약 단계</Link><Link href="/design-preview?view=report">비교 보고서</Link><Link href="/design-preview?role=cro&view=cro-home">기관 홈</Link><Link href="/design-preview?role=admin&view=admin-home">운영자 홈</Link><Link href="/design-preview?role=cro&view=cro-story">기관 요청</Link><Link href="/design-preview?role=admin&view=admin-story">운영자 요청</Link><Link href="/design-preview?view=reply">회신 개선</Link><Link href="/design-preview?view=schedule">전체 일정</Link><Link href="/design-preview?view=flow">멈춘 요청·다음 할 일</Link><Link href="/">랜딩</Link></nav></div>
    {params.view === "story" ? <RequestStory no="DEMO-005" substance="예시 물질 A" categories={["일반독성", "PK/TK/ADME·생체시료분석"]} status="distributed" outcome={null} started createdAt="2026-10-26" conditions={["MFDS", "참여 자리 3", "CDA 필요"]} replyBy="2026-11-12" distributedAt="2026-10-27" comparedAt={null} award={null} f={STORY_FUNNEL} canCompare={false} qna={{ total: 3, pending: 1 }} main={<section className="card rq-card"><h2 className="rq-card__h">요청 내용</h2><div className="card--rows rq-card__rows"><div className="kv"><span className="kv__k">의뢰 목적</span><span className="kv__v">IND 제출</span></div><div className="kv"><span className="kv__k">희망 착수</span><span className="kv__v">2027년 1분기</span></div><div className="kv"><span className="kv__k">접수일</span><span className="kv__v tnum">2026-10-26</span></div></div><details className="rq-card__full"><summary>전체 보기 <span className="tnum">12개 항목</span></summary></details></section>}><div className="rs-aside"><p className="rs-aside__p">비교 보고서는 회신 기한(11월 12일) 다음 날 오전 9시에 열려요. 참여 결정이 끝난 뒤 참여한 기관이 모두 내면 더 빨리 열려요. 그 전에는 숫자만 보이고, 기관 이름과 견적은 보고서에서 함께 공개돼요.</p></div></RequestStory>
    : params.view === "story-contract" ? <RequestStory no="DEMO-005" substance="예시 물질 A" categories={["일반독성"]} status="selected" outcome={null} started createdAt="2026-10-26" conditions={["MFDS"]} replyBy="2026-11-12" distributedAt="2026-10-27" comparedAt="2026-11-13T00:00:00Z" award={{ name: "예시 기관 A", at: "2026-11-15", reportedAt: null }} f={{ sent: 5, opened: 5, joined: 3, submitted: 3, rest: 2 }} canCompare qna={{ total: 4, pending: 0 }} next={<div className="rs-next"><NextStep no="DEMO-005" kind="contract" cro="예시 기관 A" croEmail="preview@example.invalid" /></div>} side={<section className="card rq-card"><h2 className="rq-card__h">계약</h2><div className="card--rows rq-card__rows"><div className="kv"><span className="kv__k">선택한 기관</span><span className="kv__v">예시 기관 A</span></div><div className="kv"><span className="kv__k">선택일</span><span className="kv__v tnum">2026-11-15</span></div><div className="kv"><span className="kv__k">상태</span><span className="kv__v">기관과 직접 진행</span></div><div className="kv"><span className="kv__k">시험물질 필요량</span><span className="kv__v">기관이 적으면 보여요</span></div></div><div className="rq-card__acts"><Link href="/design-preview?view=story-contract" className="b2">계약서(안) 보기</Link></div></section>}><div className="rs-aside"><p className="rs-aside__p">참여한 기관 3곳 중 3곳이 견적을 냈어요.</p></div></RequestStory>
    : params.view === "report" ? <CompareReport no="DEMO-006" substance="예시 물질 B" comparedAt="2026-10-29" cols={REPORT_COLS} rows={REPORT_ROWS} vat="금액은 VAT 별도예요." board={<CompareBoard no="DEMO-006" cols={REPORT_COLS} rows={REPORT_ROWS} canSelect={false} />} />
    : params.view === "cro-story" ? <CroStory got={croStoryFixture(Date.now()) as unknown as Loaded} replyHref="/design-preview?role=cro&view=cro-story" />
    : params.view === "cro-home" ? <CroHome orgName="예시 기관 A" now={Date.now()} items={croItems(Date.now())} awards={[{ no: "DEMO-006", substance: "예시 물질 B", days: 30 }]} />
    : params.view === "flow" ? <><div className="ph"><div><h1>접수 현황</h1></div></div><StuckList rows={[{ rfq_no: "DEMO-007", company: "예시 의뢰사", substance: "예시 물질 C", reasons: [{ kind: "mail", label: "참여 안내 메일 미발송 2곳", action: "메일 재발송", days: 31 }, { kind: "no_join", label: "회신 기한 지남 · 참여 0곳", action: "기한 변경 또는 마무리", days: 19 }] }, { rfq_no: "DEMO-006", company: "예시 의뢰사", substance: "예시 물질 B", reasons: [{ kind: "contract", label: "예시 기관 A 선택 후 30일 · 계약 보고 없음", action: "기관에 확인", days: 30 }] }]} /><NextStep no="DEMO-007" kind="no_join" /><NextStep no="DEMO-006" kind="contract" cro="예시 기관 A" croEmail="preview@example.invalid" /></> : params.view === "request" ? <NewRequest userId="design-preview" preview contact={{ company: "예시 의뢰사", name: "검토 담당자", email: "preview@example.invalid", dept: "", phone: "", orgType: "" }} /> : params.view === "compare" ? <CompareBoard no="DEMO-001" cols={UX_COLS} rows={UX_ROWS} canSelect={false} /> : params.view === "compare-inc" ? <CompareBoard no="DEMO-001" cols={INC_COLS} rows={INC_ROWS} canSelect /> : params.view === "schedule" ? <section className="card card--pad stack" style={{ gap: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700 }}>전체 일정</h2><ScheduleGantt plan={planQuote(UX_SCHEDULE)} name="예시 기관 A" startDate="2026-11-16" bestFinal={params.empty === "1" ? null : 17} /></section> : params.view === "reply" ? <ReplyForm token="design-preview-no-live-token" backHref="/design-preview?role=cro" doneHref="/design-preview?role=cro" /> : params.view === "pay" ? <section className="card card--pad stack" style={{ gap: 14 }}><h2 style={{ fontSize: 16, fontWeight: 700 }}>공통 조건</h2><PayScheduleField value={params.empty === "1" ? "" : "착수금 30% 계약 시 · 중도금 40% 중간 보고서 제출 시 · 잔금 30% 최종 보고서 제출 시"} disabled={false} /></section> : role === "requester" ? <RequestOverview today={new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })} name="디자인 검토" list={params.empty === "1" ? [] : REQUESTS} query={params.q} /> : <>
      <div className="ph"><div><h1>{role === "cro" ? "CRO" : "운영자"} 공통 UI</h1><p>실제 업무 화면에서 사용하는 공통 셸·폼·표·상태 스타일이에요.</p></div></div>
      <div className="card card--pad"><div className="ph"><div><h2>요청 정보 예시</h2><p>표시 예시이며 저장하거나 제출하지 않아요.</p></div><span className="pill pill--tint">확인 필요</span></div><div className="grid2"><label className="fld"><span className="fld__lab">시험물질명</span><input className="inp" defaultValue="예시 물질 A" /></label><label className="fld"><span className="fld__lab">시험 분야</span><select className="sel" defaultValue="일반독성"><option>일반독성</option><option>유전독성</option><option>안전성약리</option></select></label></div><div className="tbl-wrap" style={{ marginTop: 24 }}><table className="tbl"><thead><tr><th>시험 항목</th><th>수행 여부</th><th>진행 상태</th></tr></thead><tbody><tr><td>반복투여 독성</td><td>가능</td><td><span className="pill pill--tint">회신 작성 중</span></td></tr><tr><td>생체시료분석</td><td>조건부 가능</td><td><span className="pill pill--warn">조건 확인 필요</span></td></tr></tbody></table></div><div className="ph__actions" style={{ marginTop: 24 }}><button className="b1" disabled>검토용 · 제출 불가</button><Link className="b2" href="/design-preview">의뢰자 화면 보기</Link></div></div>
    </>}
    <div style={{ marginTop: 32 }}><ThemeSettings /></div>
  </ReqColumn></Shell></AppState>;
}
