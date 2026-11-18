import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppState } from "@/components/app/AppState";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { QuoteFill } from "@/components/cro/quote/QuoteFill";
import type { Session } from "@/lib/auth";
import "@/components/cro/quote/quote.css";
import { DocEditor } from "@/components/cro/quote/DocEditor";
import { quoteSample } from "../quote-fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "견적서 질문 화면 검토 · 단추", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/cro/requests", label: "받은 요청", icon: "inbox" },
  { href: "/cro/quotes", label: "제출한 견적", icon: "doc" },
  { href: "/design-preview/quote-fill", label: "견적서", icon: "quote" },
  { href: "/design-preview/catalog", label: "시험 목록", icon: "list" },
];

/**
 * 견적서 질문 화면 검토용 (로그인 없이, 저장 안 됨). Vercel 미리보기 배포에서만 열린다.
 * ?step=kind|client|tests|price|change|detail|terms|review, ?new=1 이면 새 견적서, ?kind=pd|pk|other 면 그 갈래의 받은 요청 견적서,
 * ?view=edit 면 같은 견적서를 직접 편집 화면으로 (자동 저장은 실패로 표시된다)
 */
export default async function QuoteFillPreview({ searchParams }: { searchParams: Promise<{ step?: string; new?: string; kind?: string; view?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const { rows, rates, style, head, kind, data } = quoteSample(sp.kind);
  const session: Session = {
    userId: "quote-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
    profile: { id: "quote-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
  };
  return (
    <AppState>
      <Shell session={session} nav={NAV}>
        {sp.view === "edit" ? <DocEditor head={{ ...head, id: "preview", rfqNo: kind ? "DC-2026-0201" : null }} initial={data} style={style} catalog={rows} rates={rates} replyHref={null} /> : <QuoteFill head={sp.new ? null : kind ? { ...head, rfqNo: "DC-2026-0201" } : head} initial={sp.new ? null : data} style={style} catalog={rows} rates={rates} replyHref={null} start={sp.step} />}
      </Shell>
    </AppState>
  );
}
