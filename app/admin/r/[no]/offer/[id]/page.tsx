import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadQuote } from "@/lib/quote-load";
import { loadOptsFor, proxyEntryAllowed } from "@/lib/concierge";
import { Crumb } from "@/components/app/ui";
import { RequestView } from "@/components/cro/RequestView";

export const dynamic = "force-dynamic";

/**
 * 운영자 전용 참여 전 요약 (0023). 기관이 참여하기 전에는 운영자 화면에 회신 링크(/q/{token})를 내보내지 않는다.
 * 링크를 로그아웃한 창에서 열면 기관 본인의 링크 참여와 구별되지 않는 기록이 남을 수 있기 때문이다 (참여는 기관 본인만, 청구 동의 증거).
 * 이 화면은 운영자 세션에서만 열리고 토큰을 화면에 넣지 않는다. 기관이 알린 불참은 초대 id 로 기록한다 (/api/admin/invites/[id]/decline).
 * 기관이 참여한 뒤에는 대리 입력을 위해 회신 링크로 보낸다.
 */
export default async function OperatorOfferSummary({ params }: { params: Promise<{ no: string; id: string }> }) {
  await requireSession("admin");
  const { no, id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sb = getSupabaseAdmin();
  if (!sb) notFound();
  const { data: inv } = await sb.from("rfq_invites").select("id, token, rfq_no, joined_at, revoked_at").eq("id", id).maybeSingle();
  if (!inv || inv.rfq_no !== no || inv.revoked_at) notFound();
  if (proxyEntryAllowed(inv)) redirect(`/q/${inv.token}`);
  const got = await loadQuote(inv.token, loadOptsFor("admin"));
  if (!got) notFound();
  // 화면(클라이언트 컴포넌트 포함)에는 토큰을 넘기지 않는다
  const view = { ...got, token: "" };
  return (
    <>
      <Crumb href={`/admin/r/${no}`} label={`${no} 요청으로`} />
      <RequestView got={view} replyHref={`/admin/r/${no}`} afterDeclineHref={`/admin/r/${no}`} declineEndpoint={`/api/admin/invites/${inv.id}/decline`} />
    </>
  );
}
