import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { QuoteFill } from "@/components/cro/quote/QuoteFill";
import { catalogItems, itemKey, newVariant, type CatalogRow } from "@/lib/catalog";
import { DEFAULT_VISIBLE, EMPTY_SUPPLIER, testFromCatalog, type DocData, type DocHead, type QuoteStyle, type Rate } from "@/lib/quote-doc";
import type { Session } from "@/lib/auth";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "견적서 질문 화면 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/cro", label: "받은 요청", icon: "inbox", exact: true },
  { href: "/cro/quotes", label: "제출한 견적", icon: "doc" },
  { href: "/design-preview/quote-fill", label: "견적서", icon: "quote" },
  { href: "/design-preview/catalog", label: "시험 목록", icon: "list" },
];

/** 화면 설명용 예시. 금액은 실제 기관 값이 아니다 */
function sample(): { rows: CatalogRow[]; rates: Record<string, Rate[]> } {
  const items = new Map(catalogItems().map((it) => [it.key, it]));
  const mk = (cat: string, item: string, id: string, p: Partial<CatalogRow>) => ({ ...newVariant(items.get(itemKey(cat, item))!, p), id });
  const rep = mk("일반독성", "반복투여 13주", "00000000-0000-4000-8000-000000000011", { species: ["SD 랫드", "비글"], route: "경구(PO)", routes: ["경구(PO)", "정맥(IV)"], cond_prices: [{ species: "비글", price: 420_000_000 }], dosing: "13주, 1일 1회", groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: 4, recovery_per_sex: 5, weeks: 30, std_price: 168_000_000, includes: ["일반증상", "체중", "혈액학", "조직병리"], options: [{ name: "TK 병행", amount: 8_400_000 }, { name: "안과검사", amount: 2_000_000 }] });
  const rows = [
    rep,
    mk("일반독성", "단회(급성)투여독성", "00000000-0000-4000-8000-000000000012", { species: ["SD 랫드"], route: "경구(PO)", routes: ["경구(PO)"], dosing: "단회, 관찰 14일", weeks: 6, std_price: 6_000_000 }),
    mk("유전독성", "복귀돌연변이(Ames, TG 471)", "00000000-0000-4000-8000-000000000013", { species: ["in vitro(동물 없음)"], weeks: 6, std_price: 8_000_000 }),
    mk("유전독성", "염색체이상 in vitro(TG 473)", "00000000-0000-4000-8000-000000000014", { species: ["in vitro(동물 없음)"], weeks: 8 }),
    mk("유전독성", "소핵 in vivo(마우스)", "00000000-0000-4000-8000-000000000015", { species: ["ICR 마우스"], route: "경구(PO)", routes: ["경구(PO)"], weeks: 8 }),
  ];
  const rates: Record<string, Rate[]> = {
    [rep.item_key]: [
      { id: "animal", kind: "animal", label: "본시험 동물 수", unit: "마리", add: 400_000, deduct: 300_000, shown: "동물 수 추가 / 차감", bySpecies: { 비글: { add: 3_500_000, deduct: null } } },
      { id: "recovery", kind: "recovery", label: "회복군", unit: "마리", add: 450_000, deduct: null, shown: "회복군 추가 / 제외" },
      { id: "group", kind: "group", label: "투여군", unit: "군", add: 9_000_000, deduct: null, shown: "투여군 추가 / 제외" },
    ],
  };
  return { rows, rates };
}

/**
 * 견적서 질문 화면 검토용 (로그인 없이, 저장 안 됨). Vercel 미리보기 배포에서만 열린다.
 * ?step=client|tests|price|change|detail|terms|review, ?new=1 이면 새 견적서
 */
export default async function QuoteFillPreview({ searchParams }: { searchParams: Promise<{ step?: string; new?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const { rows, rates } = sample();
  const style: QuoteStyle = { brandColor: null, logo: null, logoPos: "left", supplier: { ...EMPTY_SUPPLIER, name: "테스트기관" }, terms: { pay: "계약 시 50%, 최종 보고서 제출 시 50%", extra: "", note: "" } };
  const head: DocHead = { id: "", docNo: "Q-2611-002", title: "견적서", client: "단추 요청 DC-2026-0201 의뢰자", substance: "시험물질 A", issuedOn: "2026-11-07", validUntil: null, inviteId: null, rfqNo: null, memo: "", updatedAt: "" };
  const data: DocData = { tests: rows.map((r) => testFromCatalog(r, rates[r.item_key] ?? [])), visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: style.terms, glp: "" };
  const session: Session = {
    userId: "quote-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "quote-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <QuoteFill head={sp.new ? null : head} initial={sp.new ? null : data} style={style} catalog={rows} rates={rates} replyHref={null} start={sp.step} />
      </Shell>
    </AppState>
  );
}
