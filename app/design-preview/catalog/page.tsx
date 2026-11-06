import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { TestList } from "@/components/cro/catalog/TestList";
import { catalogItems, itemKey, newVariant, type CatalogRow } from "@/lib/catalog";
import type { Session } from "@/lib/auth";
import "@/components/cro/catalog/catalog.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "시험 목록 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/cro", label: "받은 요청", icon: "inbox", exact: true },
  { href: "/cro/quotes", label: "제출한 견적", icon: "doc" },
  { href: "/cro/docs", label: "견적서", icon: "quote" },
  { href: "/design-preview/catalog", label: "시험 목록", icon: "list" },
  { href: "/cro/notifications", label: "알림", icon: "bell" },
  { href: "/cro/org", label: "기관", icon: "org" },
];

/** 화면 설명용 예시 줄. 금액은 실제 기관 값이 아니다 */
function sample(): CatalogRow[] {
  const items = new Map(catalogItems().map((it) => [it.key, it]));
  const mk = (cat: string, item: string, id: string, p: Partial<CatalogRow>) => ({ ...newVariant(items.get(itemKey(cat, item))!, p), id });
  return [
    mk("일반독성", "반복투여 4주", "00000000-0000-4000-8000-000000000001", { source: "manual", species: ["SD 랫드", "Wistar 랫드"], route: "경구(PO)", routes: ["경구(PO)", "정맥(IV)", "피하(SC)"], method: "OECD TG 407 (설치류 28일)", groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: 2, recovery_per_sex: 5, weeks: 14, std_price: 60_000_000, includes: ["임상병리", "조직병리(검경 포함)", "조제물분석", "통계분석", "QA 점검"] }),
    mk("일반독성", "반복투여 2주", "00000000-0000-4000-8000-000000000002", { source: "learned", species: ["비글"], route: "경구(PO)", routes: ["경구(PO)"], method: "OECD TG 409 (비설치류 90일)", groups_ctrl: 1, groups_test: 3, per_sex: 3, weeks: 16, std_price: 180_000_000, last_amount: 180_000_000, last_weeks: 16, last_quoted_at: "2026-10-28T00:00:00Z" }),
    mk("일반독성", "단회(급성)투여독성", "00000000-0000-4000-8000-000000000003", { source: "manual", species: ["SD 랫드", "ICR 마우스"], route: "경구(PO)", routes: ["경구(PO)"], method: "OECD TG 423 급성독성등급법", dosing: "단회, 관찰 14일", weeks: 6 }),
    mk("일반독성", "반복투여 13주", "00000000-0000-4000-8000-000000000004", { source: "manual", available: false, species: ["SD 랫드"], route: "경구(PO)", routes: ["경구(PO)"], groups_ctrl: 1, groups_test: 3, per_sex: 10, weeks: 26 }),
    mk("유전독성", "복귀돌연변이(Ames, TG 471)", "00000000-0000-4000-8000-000000000005", { source: "manual", species: ["in vitro(동물 없음)"], method: "OECD TG 기준", glp: "GLP", weeks: 6, std_price: 8_000_000 }),
  ];
}

/**
 * 시험 목록 검토용 (로그인 없이, 저장 안 됨). Vercel 미리보기 배포에서만 열린다.
 * ?view=list|pick|wizard|empty, ?open=1 이면 첫 줄 서랍을 연다
 */
export default async function CatalogPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const rows = sp.view === "empty" ? [] : sample();
  const session: Session = {
    userId: "catalog-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "catalog-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  const view = sp.view === "pick" || sp.view === "wizard" ? sp.view : "list";
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <Suspense>
          <TestList items={catalogItems()} initialRows={rows} initialRates={{}} orgCategories={["일반독성", "유전독성", "안전성약리"]} readOnly startView={view} />
        </Suspense>
      </Shell>
    </AppState>
  );
}
