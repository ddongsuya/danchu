import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import type { Session } from "@/lib/auth";
import { IxDemo } from "./IxDemo";
import "./ix-preview.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "상호작용 규칙 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/design-preview/ix", label: "상호작용 규칙", icon: "list", exact: true },
  { href: "/design-preview", label: "디자인 검토", icon: "home", exact: true },
];

/**
 * 시안 v7 상호작용 규칙 검토 화면 (로그인 없이, 저장 안 됨). 미리보기 배포와 DANCHU_DESIGN_PREVIEW=1 에서만 열린다.
 * 버튼 8가지 상태, 처리 중 버튼, 토스트(실행 취소·실패), 확인 창, 이유별 빈·오류 화면, 0.3초 지연 뼈대를 실제 컴포넌트로 보여 준다.
 */
export default function IxPreview() {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const session: Session = {
    userId: "ix-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "ix-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <IxDemo />
      </Shell>
    </AppState>
  );
}
