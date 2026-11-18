import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { loadCatalog } from "@/lib/catalog-db";
import { loadDoc, loadRates, loadStyle } from "@/lib/quote-doc-db";
import { featureError } from "@/lib/plan-usage";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { DocEditor } from "@/components/cro/quote/DocEditor";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  if (!dbReady()) notFound();
  const { id } = await params;
  const [got, catalog, rates, style] = await Promise.all([loadDoc(org.id, id), loadCatalog(org.id), loadRates(org.id), loadStyle(org.id, org.name)]);
  if (!got) notFound();
  // 판 고르기는 Pro(branding). 잠겨 있으면 단추 기본 판으로
  const lock = !!featureError(org, "branding");
  const replyHref = got.head.inviteId ? `/cro/r/${got.head.inviteId}/reply?doc=${got.head.id}` : null;
  return <DocEditor head={got.head} initial={lock ? { ...got.data, layout: null } : got.data} style={lock ? { ...style, layout: "basic" } : style} canLayout={!lock} catalog={catalog} rates={Object.fromEntries(rates)} replyHref={replyHref} readOnly={!!s.demo} />;
}
