import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPages } from "@/components/cro/quote/DocPages";
import { StyleEditor } from "@/components/cro/quote/StyleEditor";
import { AppState } from "@/components/app/AppState";
import { Shell } from "@/components/shell/Shell";
import type { Session } from "@/lib/auth";
import { isLayout, type QuoteStyle } from "@/lib/quote-doc";
import "@/components/cro/quote/quote.css";
import { quoteSample } from "../quote-fixtures";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "견적서 판 검토 · 단추", robots: { index: false, follow: false } };

/**
 * 견적서 판 검토용 (로그인 없이). Vercel 미리보기 배포에서만 열린다.
 * ?layout=basic|summary|sentence|steps|side|sign, ?kind=pd|pk|other (없으면 독성), ?view=style 이면 견적서 양식 화면. 공급자 정보는 예시 값이다.
 */
export default async function QuoteLayoutsPreview({ searchParams }: { searchParams: Promise<{ layout?: string; kind?: string; view?: string }> }) {
  const enabled = process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
  if (!enabled) notFound();
  const sp = await searchParams;
  const { head, data, style: base } = quoteSample(sp.kind);
  const style: QuoteStyle = {
    ...base,
    layout: isLayout(sp.layout) ? sp.layout : "basic",
    supplier: { name: "테스트기관", reg: "000-00-00000", ceo: "대표자", address: "기관 주소", contact: "000-0000-0000", person: "담당자", email: "quote@example.invalid" },
  };
  if (sp.view === "style") {
    const session: Session = {
      userId: "quote-preview", email: "preview@example.invalid", org: null, pendingOrg: null,
      profile: { id: "quote-preview", email: "preview@example.invalid", role: "cro", name: "검토 계정", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
    };
    return (
      <AppState>
        <Shell session={session} nav={[{ href: "/design-preview/quote-layouts?view=style", label: "견적서", icon: "quote" }]}>
          <StyleEditor initial={style} sample={{ head: { ...head, validUntil: "2026-12-07" }, data }} sampleIsReal requests={[]} />
        </Shell>
      </AppState>
    );
  }
  return (
    <div className="qprint" style={{ padding: "24px 0", background: "#e9e9e4" }}>
      <DocPages head={{ ...head, validUntil: "2026-12-07" }} data={data} style={style} />
    </div>
  );
}
