/**
 * 계약서(안) 읽기·보내기 (2026-11-20). 저장하지 않고 선정된 견적·기관·의뢰자 정보로 볼 때마다 만든다.
 * 보내기는 요청 기록(rfq_events kind contract_draft)과 의뢰자 알림. 의뢰자는 보낸 뒤에만 볼 수 있다.
 * 모든 쿼리는 service role. 기관 id 는 부르는 쪽이 세션에서 넘긴다.
 */
import { buildContractDraft, type ContractDraft } from "./contract-draft";
import { loadStyle } from "./quote-doc-db";
import { logEvent, notifyUsers } from "./notify";
import { getSupabaseAdmin } from "./supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CONTRACT_DRAFT_EVENT = "contract_draft";

type AwardLite = { id: string; rfq_id: string; quote_id: string; cro_org_id: string | null; cro_name: string; awarded_at: string; contract_status: string };

/** 선정 한 건으로 계약서(안). 견적·요청을 못 읽으면 null */
export async function draftForAward(award: AwardLite): Promise<ContractDraft | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const [{ data: q }, { data: r }, { data: org }] = await Promise.all([
    sb.from("cro_quotes").select("*, cro_quote_items(*)").eq("id", award.quote_id).maybeSingle(),
    sb.from("rfq_requests").select("rfq_no, company, contact_name, substance").eq("id", award.rfq_id).maybeSingle(),
    award.cro_org_id ? sb.from("cro_orgs").select("id, name, business_no, address, contact_name").eq("id", award.cro_org_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!q || !r) return null;
  const style = award.cro_org_id ? await loadStyle(award.cro_org_id, org?.name ?? award.cro_name).catch(() => null) : null;
  const items = ((q.cro_quote_items ?? []) as { seq: number; name: string; avail: string | null; amount: number | null; weeks: number | null }[]).map((i) => ({ seq: i.seq, name: i.name, avail: i.avail, amount: i.amount, weeks: i.weeks }));
  return buildContractDraft({
    rfqNo: r.rfq_no,
    substance: r.substance ?? "",
    awardedAt: award.awarded_at,
    // 선정 뒤라 의뢰자 회사명·담당자를 넣는다 (선정 전 신원 보호는 선정까지)
    sponsor: { name: r.company, contact: r.contact_name ?? null, bizNo: null, address: null },
    cro: {
      name: style?.supplier.name || org?.name || award.cro_name,
      contact: style?.supplier.person || org?.contact_name || null,
      bizNo: style?.supplier.reg || org?.business_no || null,
      address: style?.supplier.address || org?.address || null,
    },
    items,
    quote: { pay_terms: q.pay_terms, start_date: q.start_date, report_lang: q.report_lang, includes: q.includes, final_weeks: q.final_weeks, revision: q.revision },
    terms: style?.terms ?? null,
  });
}

/** 기관: 우리 기관 선정 한 건 */
export async function awardForOrg(orgId: string, awardId: string): Promise<AwardLite | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(awardId)) return null;
  const { data } = await sb.from("rfq_awards").select("id, rfq_id, quote_id, cro_org_id, cro_name, awarded_at, contract_status").eq("id", awardId).eq("cro_org_id", orgId).maybeSingle();
  return (data as AwardLite | null) ?? null;
}

/** 기관: 요청 번호로 우리 기관 선정 (에이전트 액션) */
export async function awardForOrgByRfq(orgId: string, rfqNo: string): Promise<AwardLite | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: r } = await sb.from("rfq_requests").select("id").eq("rfq_no", rfqNo).maybeSingle();
  if (!r) return null;
  const { data } = await sb.from("rfq_awards").select("id, rfq_id, quote_id, cro_org_id, cro_name, awarded_at, contract_status").eq("rfq_id", r.id).eq("cro_org_id", orgId).maybeSingle();
  return (data as AwardLite | null) ?? null;
}

/** 의뢰자: 이 요청의 선정 */
export async function awardForRfq(rfqId: string): Promise<AwardLite | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_awards").select("id, rfq_id, quote_id, cro_org_id, cro_name, awarded_at, contract_status").eq("rfq_id", rfqId).maybeSingle();
  return (data as AwardLite | null) ?? null;
}

/** 기관이 의뢰자에게 보낸 시각 (가장 최근). 안 보냈으면 null */
export async function draftSentAt(rfqId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("rfq_events").select("created_at").eq("rfq_id", rfqId).eq("kind", CONTRACT_DRAFT_EVENT).order("created_at", { ascending: false }).limit(1);
  return (data?.[0]?.created_at as string | undefined) ?? null;
}

/** 의뢰자에게 계약서(안) 보내기: 요청 기록 + 의뢰자 알림(앱·메일). 계약 결과가 나온 뒤에는 보내지 않는다 */
export async function sendDraft(award: AwardLite, actorId: string): Promise<{ ok: true; sentAt: string } | { ok: false; status: number; error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, status: 503, error: "저장소가 설정되지 않았어요." };
  if (award.contract_status === "signed" || award.contract_status === "not_signed") return { ok: false, status: 409, error: "계약 결과가 나온 요청이에요." };
  const draft = await draftForAward(award);
  if (!draft || !draft.tests.length) return { ok: false, status: 409, error: "계약서(안)을 만들 견적 항목이 없어요." };
  const { data: r } = await sb.from("rfq_requests").select("rfq_no, user_id, email").eq("id", award.rfq_id).maybeSingle();
  await logEvent(award.rfq_id, CONTRACT_DRAFT_EVENT, `${award.cro_name} 계약서(안) 보냄`, undefined, actorId);
  if (r?.user_id) {
    await notifyUsers(
      [r.user_id],
      { kind: "계약", title: `${award.cro_name} 계약서(안) · ${r.rfq_no}`, body: "기관이 계약서(안)을 보냈어요. 요청 화면에서 내용을 확인해 주세요.", href: `/app/r/${r.rfq_no}/contract` },
      r.email ? { to: [r.email] } : undefined,
    );
  }
  return { ok: true, sentAt: new Date().toISOString() };
}
