import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { QuoteFill } from "@/components/cro/quote/QuoteFill";
import { DocPages } from "@/components/cro/quote/DocPages";
import { DocEditor } from "@/components/cro/quote/DocEditor";
import { DEFAULT_VISIBLE, EMPTY_SUPPLIER, testFromCatalog, type DocData, type DocHead, type QuoteStyle } from "@/lib/quote-doc";
import { snapFor } from "@/lib/pd-quote";
import type { Session } from "@/lib/auth";
import { PD_ITEMS, PD_MODEL, PD_REQ, PD_ROW } from "../pd-fixtures";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "효력 요청 반영 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/cro/requests", label: "받은 요청", icon: "inbox" },
  { href: "/design-preview/pd-quote", label: "견적서", icon: "quote" },
  { href: "/design-preview/cro-model", label: "시험 목록", icon: "list" },
];

/**
 * 효력 요청 반영 화면과 효력 견적서 4쪽 검토용 (로그인 없이, 저장 안 됨). 미리보기 배포에서만 열린다.
 * 값은 시안 v15 예시이고 실제 기관 단가가 아니다. ?view=doc 이면 견적서 4쪽(PDF 화면과 같은 페이지), ?view=editor 면 견적서 편집 화면
 */
export default async function PdQuotePreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const book = { items: PD_ITEMS, marginPct: 15 };
  const style: QuoteStyle = { brandColor: null, logo: null, logoPos: "left", supplier: { ...EMPTY_SUPPLIER, name: "예시 비임상연구센터", person: "효력시험팀" }, terms: { pay: "계약 시 50%, 최종 보고서 제출 시 50%", extra: "시험물질 운송, 보고서 번역", note: "" } };
  const head: DocHead = { id: "", docNo: "Q-2611-014", title: "DSS 유도 대장염 효력시험", client: "단추 요청 DC-2026-0214 의뢰자", substance: "시험물질 A", issuedOn: "2026-11-18", validUntil: "2026-12-18", inviteId: null, rfqNo: "DC-2026-0214", memo: "", updatedAt: "" };
  const t0 = testFromCatalog(PD_ROW, []);
  const t = {
    ...t0,
    rfqSeq: 1,
    kd: { ...t0.kd, pd: structuredClone(PD_REQ) },
    prices: snapFor(book, PD_MODEL, PD_REQ),
    orig: { lines: [["모델", "DSS 3%, 7일 음수"], ["군 구성", "6군, 군당 10마리\n시험물질 3용량"], ["평가", "체중, DAI, 대장 길이, 조직병리, 혈청 사이토카인 3종"], ["투여", "경구, 1일 1회, D0~D9"]] as [string, string][], groups: 6, perGroup: 10 },
    why: "의뢰자 설계에 맞춰 시험물질 중용량군을 더하고 군당 10마리로 늘렸습니다. 혈청 사이토카인 3종을 부검 시 채혈로 분석합니다.",
    asks: ["양성대조물질 종류와 용량"],
    description: "C57BL/6 수컷 마우스를 7일간 순화한 뒤, 3% DSS를 7일간 음수로 공급하여 급성 대장염을 유발합니다. 정상군(G1)은 일반 음수를 공급합니다.\n유발 시작일(D0)부터 D9까지 부형제, 양성대조물질, 시험물질을 1일 1회 경구 투여합니다.\nD10에 채혈과 부검을 하고 대장 길이를 잽니다. 원위 대장은 조직병리 검사에, 혈청은 사이토카인 분석에 씁니다.",
  };
  const data: DocData = { tests: [t], visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: style.terms, glp: "" };
  const session: Session = {
    userId: "pd-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "pd-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  if (sp.view === "editor") return <AppState><Shell session={session} nav={NAV}><DocEditor head={{ ...head, id: "preview" }} initial={data} style={style} catalog={[PD_ROW]} rates={{}} replyHref={null} /></Shell></AppState>;
  if (sp.view === "doc") return <div className="qprint" style={{ padding: 24 }}><DocPages head={head} data={data} style={style} /></div>;
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        <QuoteFill head={head} initial={data} style={style} catalog={[PD_ROW]} rates={{}} replyHref={null} start="detail" book={book} />
      </Shell>
    </AppState>
  );
}
