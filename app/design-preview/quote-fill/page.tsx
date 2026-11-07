import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { QuoteFill } from "@/components/cro/quote/QuoteFill";
import { catalogItems, itemKey, newVariant, type CatalogRow } from "@/lib/catalog";
import { DEFAULT_VISIBLE, EMPTY_SUPPLIER, testFromCatalog, type DocData, type DocHead, type QuoteStyle, type Rate } from "@/lib/quote-doc";
import type { Session } from "@/lib/auth";
import { kindOfCategory } from "@/lib/kind-design";
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
  // 효력·약동학·개별 분석 (2026-11-07 갈래별 견적서)
  const pd = mk("효력시험(약효)", "소화기", "00000000-0000-4000-8000-000000000021", {
    species: ["C57BL/6 마우스"], route: "경구(PO)", routes: ["경구(PO)"], method: "대장염(DSS)", weeks: 6,
    kd: { pd: {
      model: "대장염(DSS)", induction: "DSS 3% 음수 7일", endpoints: ["체중", "질병활성지수(DAI)", "대장 길이", "조직병리 점수"],
      groups: [
        { id: "g1", label: "정상군", role: "normal", treat: "유발 없음", n: 8, dose: "" },
        { id: "g2", label: "부형제군", role: "vehicle", treat: "DSS 유발 후 부형제", n: 8, dose: "" },
        { id: "g3", label: "양성대조군", role: "positive", treat: "DSS 유발 후 기준물질", n: 8, dose: "" },
        { id: "g4", label: "시험물질군", role: "test", treat: "DSS 유발 후 시험물질", n: 8, dose: "" },
      ],
      lanes: [{ id: "l1", name: "순화", start: 0, weeks: 1 }, { id: "l2", name: "유발 (DSS)", start: 1, weeks: 1 }, { id: "l3", name: "투여", start: 1, weeks: 2 }, { id: "l4", name: "부검", start: 3, weeks: 1, point: true }],
      costs: { cost_animal: 7_200_000, cost_dosing: 4_000_000, cost_eval: 3_600_000, cost_path: 4_800_000, cost_report: 3_000_000 },
      perGroup: { cost_animal: null, cost_dosing: 1_000_000, cost_eval: null, cost_path: 1_200_000, cost_report: null },
      perAnimal: 60_000,
    } },
    options: [{ name: "사이토카인 5종", amount: 3_000_000 }],
  });
  const pk = mk("PK/TK/ADME·생체시료분석", "PK(약물동태)", "00000000-0000-4000-8000-000000000022", {
    species: ["SD 랫드"], route: "경구(PO)", routes: ["경구(PO)", "정맥(IV)"], weeks: 8, unit: "per_sample",
    kd: { pk: { types: ["단회 PK"], groups: [{ id: "g1", label: "정맥군", route: "정맥(IV)", dose: "1 mg/kg", n: 3 }, { id: "g2", label: "경구군", route: "경구(PO)", dose: "10 mg/kg", n: 3 }], times: ["5분", "15분", "30분", "1시간", "2시간", "4시간", "8시간", "24시간"], matrix: ["혈장"], method: "", params: ["Cmax", "Tmax", "AUC", "T½"], animal: 6_000_000, perSample: 45_000, dev: 6_000_000, report: 2_500_000 } },
  });
  const other = mk("기타(임상병리·조직병리 등)", "조직병리", "00000000-0000-4000-8000-000000000023", { species: ["SD 랫드"], weeks: 4, unit: "per_sample", kd: { other: { sample: "랫드 간·신장", n: 20, perSample: 60_000, setup: 300_000, report: 800_000 } } });
  const otherNew = mk("기타(임상병리·조직병리 등)", "임상병리", "00000000-0000-4000-8000-000000000024", { species: ["SD 랫드"], weeks: 3, unit: "per_sample" });
  const rows = [
    rep, pd, pk, other, otherNew,
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
 * ?step=kind|client|tests|price|change|detail|terms|review, ?new=1 이면 새 견적서, ?kind=pd|pk|other 면 그 갈래의 받은 요청 견적서
 */
export default async function QuoteFillPreview({ searchParams }: { searchParams: Promise<{ step?: string; new?: string; kind?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const { rows, rates } = sample();
  const style: QuoteStyle = { brandColor: null, logo: null, logoPos: "left", supplier: { ...EMPTY_SUPPLIER, name: "테스트기관" }, terms: { pay: "계약 시 50%, 최종 보고서 제출 시 50%", extra: "", note: "" } };
  const head: DocHead = { id: "", docNo: "Q-2611-002", title: "견적서", client: "단추 요청 DC-2026-0201 의뢰자", substance: "시험물질 A", issuedOn: "2026-11-07", validUntil: null, inviteId: null, rfqNo: null, memo: "", updatedAt: "" };
  // ?kind=pd|pk|other: 받은 요청에서 만든 그 갈래 견적서 (의뢰자 원안 포함)
  const kind = sp.kind === "pd" || sp.kind === "pk" || sp.kind === "other" ? sp.kind : null;
  const pick = (c: string) => rows.filter((r) => kindOfCategory(r.category) === c);
  const tests = kind ? pick(kind).map((r) => testFromCatalog(r, rates[r.item_key] ?? [])).map((t) => {
    if (kind === "pd") return { ...t, rfqSeq: 1, orig: { lines: [["질환 모델", "DSS 유도 대장염"], ["군 구성", "5군, 군당 10마리"], ["양성 대조군", "필요"], ["평가 지표", "체중, DAI, 대장 길이, 사이토카인"]] as [string, string][], groups: 5, perGroup: 10 },
      kd: { pd: { ...t.kd!.pd!, groups: [...t.kd!.pd!.groups.map((g) => ({ ...g, n: 10 })), { id: "gx", label: "시험물질군 고", role: "test" as const, treat: "DSS 유발 후 시험물질", n: 10, dose: "" }] } } };
    if (kind === "pk") return { ...t, rfqSeq: 1, orig: { lines: [["설계", "단회"], ["검체", "혈장"], ["채혈 시기·횟수", "0.25, 0.5, 1, 2, 4, 8h · 총 6회"]] as [string, string][], times: 6 } };
    return { ...t, rfqSeq: 1, orig: { lines: [["시료 종류와 수", "랫드 간·신장, 40개"]] as [string, string][], samples: 40 }, kd: t.kd?.other ? { other: { ...t.kd.other, n: 40 } } : t.kd };
  }) : rows.filter((r) => kindOfCategory(r.category) === "tox").map((r) => testFromCatalog(r, rates[r.item_key] ?? []));
  const data: DocData = { tests, visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: style.terms, glp: "" };
  const session: Session = {
    userId: "quote-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "quote-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <QuoteFill head={sp.new ? null : kind ? { ...head, rfqNo: "DC-2026-0201" } : head} initial={sp.new ? null : data} style={style} catalog={rows} rates={rates} replyHref={null} start={sp.step} />
      </Shell>
    </AppState>
  );
}
