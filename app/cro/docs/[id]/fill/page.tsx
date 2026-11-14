import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { loadCatalog } from "@/lib/catalog-db";
import { loadDoc, loadRates, loadStyle } from "@/lib/quote-doc-db";
import { featureError } from "@/lib/plan-usage";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { QuoteFill } from "@/components/cro/quote/QuoteFill";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/** 견적서 질문 화면. ?step= 로 시작 질문을 정한다 (새 견적서를 만든 직후 "price" 또는 "change") */
export default async function FillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  if (!dbReady()) notFound();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [got, catalog, rates, style] = await Promise.all([loadDoc(org.id, id), loadCatalog(org.id), loadRates(org.id), loadStyle(org.id, org.name)]);
  if (!got) notFound();
  const lock = !!featureError(org, "branding");
  const replyHref = got.head.inviteId ? `/cro/r/${got.head.inviteId}/reply?doc=${got.head.id}` : null;
  return <QuoteFill head={got.head} initial={lock ? { ...got.data, layout: null } : got.data} style={lock ? { ...style, layout: "basic" } : style} catalog={catalog.filter((c) => c.available)} rates={Object.fromEntries(rates)} replyHref={replyHref} start={sp.step} readOnly={!!s.demo} />;
}
