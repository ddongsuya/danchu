import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg, listInvitesForOrg } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import Link from "next/link";
import { CRO_PATHS } from "@/components/cro/Pipeline";
import { RequestsBoard, type AwardLite, type BoardQuery, type Tab } from "@/components/cro/RequestsBoard";
import { canUse } from "@/lib/plans";
import { todaySeoul } from "@/lib/format";
import { buildPipeline } from "@/lib/pipeline";
import { getSupabaseAdmin } from "@/lib/supabase";
import { contractConfirmState } from "@/lib/status";
import { GAP_REASON_LABEL, isGapReason } from "@/lib/contract-gap";

export const dynamic = "force-dynamic";

/**
 * 받은 요청 (2026-11-07, 옛 "견적 진행", CRM 1단계에서 /cro → /cro/requests). 받은 요청 · 제출한 견적 · 수주를 요청 하나의 흐름으로 본다.
 * ?sel=<초대 id> 는 오른쪽(휴대폰은 다음 화면) 상세. 빠진 배포는 승인·분야 변경 시점과 매일 크론이 채운다.
 */
type Sp = { sel?: string; tab?: string; q?: string; cat?: string; due?: string; glp?: string; sp?: string };
const one = (v: unknown, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");

export default async function CroRequests({ searchParams }: { searchParams: Promise<Sp> }) {
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
  const sp = await searchParams;
  const tab = (["new", "draft", "sent", "won"] as const).find((t) => t === sp.tab) ?? "all";
  const query: BoardQuery = {
    tab: tab as Tab,
    q: one(sp.q),
    cat: one(sp.cat),
    due: ["7", "14", "30"].includes(one(sp.due)) ? one(sp.due) : "",
    glp: ["GLP", "Non-GLP"].includes(one(sp.glp)) ? one(sp.glp) : "",
    sp: one(sp.sp),
    sel: sp.sel && /^[0-9a-f-]{36}$/.test(sp.sel) ? sp.sel : null,
  };
  const [invites, awards] = dbReady() ? await Promise.all([listInvitesForOrg(org.id), listAwardsForOrg(org.id)]) : [[], []];
  const items = buildPipeline(invites, awards);
  // 선정된 의뢰자 → 고객사 화면 (0038). 아직 고객사로 들어오지 않았으면 고객사 목록으로 (목록을 열면 들어온다)
  // 요금제에 없는 화면(고객사: Pro, 시험 목록: Plus)으로는 링크하지 않는다 (0044)
  const today = todaySeoul();
  const crm = canUse(org, "crm", today);
  const sb = dbReady() && crm ? getSupabaseAdmin() : null;
  const { data: links } = sb ? await sb.from("cro_crm_contacts").select("danchu_key, company_id").eq("org_id", org.id).not("danchu_key", "is", null) : { data: null };
  const companyOf = Object.fromEntries((links ?? []).map((l) => [l.danchu_key as string, l.company_id]));
  const paths = { ...CRO_PATHS, clients: crm ? CRO_PATHS.clients : null, catalog: canUse(org, "tests", today) ? CRO_PATHS.catalog : null };
  if (!items.length && !awards.length) {
    return (
      <>
        <div className="ph"><div><h1>받은 요청</h1></div></div>
        <div className="empty">
          <b>아직 받은 요청이 없어요</b>
          <div style={{ marginTop: 14 }}>{paths.catalog ? <Link href={paths.catalog} className="b2 bsm">시험 목록 보기</Link> : <Link href="/cro/org" className="b2 bsm">수행 분야 보기</Link>}</div>
        </div>
      </>
    );
  }
  // 선정 탭: 선정된 요청 (선정 뒤라 의뢰자 연락처가 열려 있다, identityVisible)
  const awardLite: AwardLite[] = awards.map((a) => ({
    id: a.id,
    inviteId: a.invite_id ?? null,
    no: a.rfq?.rfq_no ?? "",
    title: a.rfq?.substance ?? "",
    awardedAt: a.awarded_at,
    reportedAt: a.contract_reported_at ?? null,
    contractAmount: a.contract_amount ?? null,
    quoteAmount: a.quoteAmount,
    substanceQty: a.substance_qty ?? "",
    substanceWhen: a.substance_when ?? "",
    substanceNote: a.substance_note ?? "",
    substanceAt: a.substance_updated_at ?? null,
    sponsorSigned: a.sponsor_contract_status === "signed",
    contractDate: a.contract_date ?? null,
    gapReason: a.contract_gap_reason && isGapReason(a.contract_gap_reason) ? GAP_REASON_LABEL[a.contract_gap_reason] : "",
    contractNote: a.contract_note ?? "",
    // 기관 화면에는 의뢰자 이의 사유를 보이지 않는다 (includeNote: false)
    confirmLabel: contractConfirmState(a, { includeNote: false })?.label ?? "",
    client: { company: a.rfq?.company ?? "", name: a.rfq?.contact_name ?? "", email: a.rfq?.email ?? "", phone: a.rfq?.phone ?? "" },
  }));
  return <RequestsBoard items={items} awards={awardLite} query={query} paths={paths} companyOf={companyOf} today={today} />;
}
