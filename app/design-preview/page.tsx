import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { RequestOverview, type RequestListItem } from "@/components/app/RequestOverview";
import { ThemeSettings } from "@/components/ThemeSettings";
import type { Role, Session } from "@/lib/auth";
import "./preview.css";

export const metadata: Metadata = { title: "단추 디자인 검토", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const REQUESTS: RequestListItem[] = [
  { id: "preview-1", rfq_no: "DEMO-001", status: "compared", substance: "예시 물질 A · 반복투여 독성", categories: ["일반독성", "PK/TK/ADME·생체시료분석"], invites: 3, submitted: 3, reply_by: "2026-10-08", created_at: "2026-09-29" },
  { id: "preview-2", rfq_no: "DEMO-002", status: "distributed", substance: "예시 물질 B · 유전독성", categories: ["유전독성"], invites: 5, submitted: 2, reply_by: "2026-10-12", created_at: "2026-09-28" },
  { id: "preview-3", rfq_no: "DEMO-003", status: "received", substance: "예시 물질 C · 안전성약리", categories: ["안전성약리"], invites: 0, submitted: 0, reply_by: "2026-10-15", created_at: "2026-09-27" },
  { id: "preview-4", rfq_no: "DEMO-004", status: "closed", substance: "예시 물질 D · 조제물분석", categories: ["조제물분석"], invites: 3, submitted: 3, reply_by: "2026-09-20", created_at: "2026-09-16" },
];

/** Isolated visual fixtures. No auth bypass, DB reads, or mutations. Off by default. */
export default async function DesignPreview({ searchParams }: { searchParams: Promise<{ role?: string; empty?: string }> }) {
  if (process.env.DANCHU_DESIGN_PREVIEW !== "1") notFound();
  const params = await searchParams;
  const role: Role = params.role === "cro" || params.role === "admin" ? params.role : "requester";
  const session: Session = { userId: "design-preview", email: "preview@example.invalid", org: null, pendingOrg: null, profile: { id: "design-preview", email: "preview@example.invalid", role, name: "디자인 검토", company: "예시 워크스페이스", dept: null, phone: null, org_type: null, cro_org_id: null } };
  const nav: NavItem[] = role === "requester" ? [
    { href: "/design-preview", label: "내 견적 요청", icon: "home", exact: true }, { href: "/app/new", label: "새 견적 요청", icon: "plus" }, { href: "/app/notifications", label: "알림", icon: "bell" }, { href: "/app/profile", label: "프로필", icon: "user" },
  ] : role === "cro" ? [
    { href: "/design-preview?role=cro", label: "받은 요청", icon: "inbox" }, { href: "/cro/quotes", label: "제출한 견적", icon: "doc" }, { href: "/cro/awards", label: "수주 현황", icon: "award" }, { href: "/cro/org", label: "기관 정보", icon: "org" },
  ] : [
    { href: "/design-preview?role=admin", label: "접수 현황", icon: "list" }, { href: "/admin/cros", label: "기관 관리", icon: "cros" }, { href: "/admin/awards", label: "계약 현황", icon: "award" }, { href: "/admin/users", label: "사용자 관리", icon: "user" },
  ];
  return <AppState><Shell session={session} nav={nav}>
    <div className="preview-banner"><b>디자인 검토용 예시 데이터</b><p>실제 요청·기관·실적이 아닙니다. 업무 링크는 기존 인증 화면으로 연결됩니다.</p><nav aria-label="디자인 검토 화면"><Link href="/design-preview">의뢰자 화면</Link><Link href="/design-preview?empty=1">빈 목록</Link><Link href="/design-preview?role=cro">CRO 공통 UI</Link><Link href="/design-preview?role=admin">운영자 공통 UI</Link><Link href="/">랜딩</Link></nav></div>
    {role === "requester" ? <RequestOverview name="디자인 검토" list={params.empty === "1" ? [] : REQUESTS} /> : <>
      <div className="ph"><div><h1>{role === "cro" ? "CRO" : "운영자"} 공통 UI</h1><p>실제 업무 화면에서 사용하는 공통 셸·폼·표·상태 스타일입니다.</p></div></div>
      <div className="card card--pad"><div className="ph"><div><h2>요청 정보 예시</h2><p>표시 예시이며 저장하거나 제출하지 않습니다.</p></div><span className="pill pill--tint">확인 필요</span></div><div className="grid2"><label className="fld"><span className="fld__lab">시험물질명</span><input className="inp" defaultValue="예시 물질 A" /></label><label className="fld"><span className="fld__lab">시험 분야</span><select className="sel" defaultValue="일반독성"><option>일반독성</option><option>유전독성</option><option>안전성약리</option></select></label></div><div className="tbl-wrap" style={{ marginTop: 24 }}><table className="tbl"><thead><tr><th>시험 항목</th><th>수행 여부</th><th>진행 상태</th></tr></thead><tbody><tr><td>반복투여 독성</td><td>가능</td><td><span className="pill pill--tint">회신 작성 중</span></td></tr><tr><td>생체시료분석</td><td>조건부 가능</td><td><span className="pill pill--warn">조건 확인 필요</span></td></tr></tbody></table></div><div className="ph__actions" style={{ marginTop: 24 }}><button className="b1" disabled>검토용 · 제출 불가</button><Link className="b2" href="/design-preview">의뢰자 화면 보기</Link></div></div>
    </>}
    <div style={{ marginTop: 32 }}><ThemeSettings /></div>
  </Shell></AppState>;
}
