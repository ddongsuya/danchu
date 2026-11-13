import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg, listInvitesForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { CRO_PATHS, Pipeline } from "@/components/cro/Pipeline";
import { canUse } from "@/lib/plans";
import { todaySeoul } from "@/lib/format";
import { buildPipeline } from "@/lib/pipeline";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * 받은 요청 (2026-11-07, 옛 "견적 진행", CRM 1단계에서 /cro → /cro/requests). 받은 요청 · 제출한 견적 · 수주를 요청 하나의 흐름으로 본다.
 * ?sel=<초대 id> 는 오른쪽(휴대폰은 다음 화면) 상세. 빠진 배포는 승인·분야 변경 시점과 매일 크론이 채운다.
 */
export default async function CroRequests({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") {
    return (
      <>
        <div className="ph"><div><h1>받은 요청</h1></div></div>
        <PendingOrg org={org} pendingOrg={s.pendingOrg} />
      </>
    );
  }
  const { sel } = await searchParams;
  const [invites, awards] = dbReady() ? await Promise.all([listInvitesForOrg(org.id), listAwardsForOrg(org.id)]) : [[], []];
  const items = buildPipeline(invites, awards);
  // 선정된 의뢰자 → 고객사 화면 (0038). 아직 고객사로 들어오지 않았으면 고객사 목록으로 (목록을 열면 들어온다)
  // 요금제에 없는 화면(고객사: Pro, 시험 목록: Plus)으로는 링크하지 않는다 (0044)
  const today = todaySeoul();
  const crm = canUse(org, "crm", today);
  const sb = dbReady() && crm ? getSupabaseAdmin() : null;
  const { data: links } = sb ? await sb.from("cro_crm_contacts").select("danchu_key, company_id").eq("org_id", org.id).not("danchu_key", "is", null) : { data: null };
  const companyOf = Object.fromEntries((links ?? []).map((l) => [l.danchu_key as string, l.company_id]));
  return <Pipeline items={items} sel={sel && /^[0-9a-f-]{36}$/.test(sel) ? sel : null} companyOf={companyOf} paths={{ ...CRO_PATHS, clients: crm ? CRO_PATHS.clients : null, catalog: canUse(org, "tests", today) ? CRO_PATHS.catalog : null }} />;
}
