import { notFound, redirect } from "next/navigation";
import { requireSession, viewerLoadOpts } from "@/lib/auth";
import { loadQuote } from "@/lib/quote-load";
import { getInviteById } from "@/lib/data";
import { ReplyForm, type DocFill } from "@/components/cro/ReplyForm";
import { loadDoc } from "@/lib/quote-doc-db";
import { replyExtra, testLines } from "@/lib/quote-doc";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ReplyDone } from "@/components/cro/ReplyDone";
import { canUse } from "@/lib/plans";
import { todaySeoul } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CroReply({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; t?: string; w?: string; doc?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const sp = await searchParams;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  // 참여 전에는 회신 화면을 열지 않는다 (0023). 요청 화면에서 참여를 결정한다
  if (!inv.joined_at) redirect(`/cro/r/${id}`);
  if (sp.done === "1") {
    // 마지막 제출이 비교표를 열었으면 수정하기를 숨긴다 (2026-10-21 결정 3)
    const got = await loadQuote(inv.token, await viewerLoadOpts());
    return <ReplyDone no={inv.rfq_no} replyBy={inv.reply_by} total={Number(sp.t || 0)} weeks={sp.w} editHref={`/cro/r/${id}/reply`} backHref="/cro/quotes" backLabel="제출한 견적" closed={!!got?.closed} />;
  }
  // 견적서 생성 툴(0036): ?doc= 로 오면 그 견적서의 시험별 금액·기간을 채운다. 아니면 이 요청으로 만든 견적서를 열거나 새로 만드는 링크
  let docFill: DocFill | undefined;
  let docLink: { href: string; label: string } | undefined;
  const orgId = inv.cro_org_id;
  // 요금제에 없는 화면(견적서 작성 툴: Pro, 시험 목록: Plus)으로 가는 링크는 두지 않는다 (0044)
  const today = todaySeoul();
  const admin = s.profile.role === "admin";
  const tool = admin || canUse(s.org, "quote_tool", today);
  const tests = admin || canUse(s.org, "tests", today);
  if (orgId && sp.doc && tool) {
    const got = await loadDoc(orgId, sp.doc);
    if (got && got.head.inviteId === inv.id) {
      docFill = {
        docNo: got.head.docNo, href: `/cro/docs/${got.head.id}`, printHref: `/cro/docs/${got.head.id}/print`,
        lines: got.data.tests.filter((t) => typeof t.rfqSeq === "number").map((t) => ({ seq: t.rfqSeq as number, amount: testLines(t).total, weeks: t.weeks, extra: replyExtra(t) })),
      };
    }
  } else if (orgId && !admin && tool) {
    const { data: had } = (await getSupabaseAdmin()?.from("cro_quote_docs").select("id, doc_no").eq("org_id", orgId).eq("invite_id", inv.id).limit(1)) ?? { data: null };
    docLink = had?.[0] ? { href: `/cro/docs/${had[0].id}`, label: `견적서 ${had[0].doc_no} 열기` } : { href: `/cro/docs/new?invite=${inv.id}`, label: "견적서 만들기" };
  }
  return <ReplyForm token={inv.token} backHref={`/cro/r/${id}`} doneHref={`/cro/r/${id}/reply?done=1`} orgCerts={s.org?.glp_certs ?? []} docFill={docFill} docLink={docLink} catalogHref={tests ? "/cro/catalog" : null} />;
}
