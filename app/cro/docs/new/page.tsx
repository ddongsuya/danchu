import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady, getInviteById } from "@/lib/data";
import { loadCatalog } from "@/lib/catalog-db";
import { createDocFromRequest, loadRates, loadStyle } from "@/lib/quote-doc-db";
import { rfqViewOf } from "@/lib/quote-load";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { QuoteFill } from "@/components/cro/quote/QuoteFill";
import type { Values } from "@/lib/rfq-schema";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/**
 * 새 견적서.
 * ?invite=<초대 id> 면 그 단추 요청의 시험마다 가장 가까운 카탈로그 조건으로 채워 바로 편집 화면으로 보낸다 (이미 있으면 그것을 연다).
 * 아니면 질문 화면에서 의뢰자와 시험을 고르면 단추 밖 의뢰자용 견적서를 만든다 (QuoteFill).
 */
export default async function NewDocPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") return <PendingOrg org={org} pendingOrg={s.pendingOrg} />;
  const sp = await searchParams;
  if (sp.invite && dbReady()) {
    const inv = await getInviteById(sp.invite);
    if (!inv || inv.cro_org_id !== org.id) notFound();
    if (!inv.joined_at) redirect(`/cro/r/${inv.id}`);
    const sb = getSupabaseAdmin()!;
    const { data: r } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
    if (!r) notFound();
    const view = rfqViewOf(r, inv, [], false);
    const got = await createDocFromRequest(org.id, org.name, s.userId, { inviteId: inv.id, rfqNo: inv.rfq_no, substance: view.substance, rows: view.rows, payload: r.payload as Values });
    if (got.id) redirect(`/cro/docs/${got.id}/fill`);
    return <div className="note note--err">{got.error || "견적서를 만들지 못했어요."}</div>;
  }
  const [catalog, rates, style] = dbReady() ? await Promise.all([loadCatalog(org.id), loadRates(org.id), loadStyle(org.id, org.name)]) : [[], new Map(), null];
  if (!style) notFound();
  return <QuoteFill head={null} initial={null} style={style} catalog={catalog.filter((c) => c.available)} rates={Object.fromEntries(rates)} replyHref={null} readOnly={!!s.demo} />;
}
