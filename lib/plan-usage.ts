import { getSupabaseAdmin } from "./supabase";
import { seoulMonthRange } from "./request-policy";
import { SUBSCRIPTION_MAX_EXCL } from "./billing";
import { todaySeoul } from "./format";
import { FEATURE_LABEL, PLANS, canUse, monthlyQuoteLimit, planFor, seatLimit, type PlanFeature } from "./plans";

/** 서울 날짜의 그 달 첫날 0시를 UTC ISO 로 */
function seoulMidnightIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

/**
 * 이번 달(서울) 처음 제출한 5,000만 원 미만 견적 수. 무료 요금제 월 5건 한도에 센다.
 * 재제출·수정은 처음 제출한 달에 한 번만 센다 (first_submitted_at). exceptQuoteId 는 지금 제출하는 견적
 */
export async function quotesThisMonth(orgId: string, exceptQuoteId?: string | null): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { from, to } = seoulMonthRange();
  let q = sb
    .from("cro_quotes")
    .select("id", { count: "exact", head: true })
    .eq("cro_org_id", orgId)
    .not("first_submitted_at", "is", null)
    .gte("first_submitted_at", seoulMidnightIso(from))
    .lt("first_submitted_at", seoulMidnightIso(to))
    .or(`total_amount.is.null,total_amount.lt.${SUBSCRIPTION_MAX_EXCL}`);
  if (exceptQuoteId) q = q.neq("id", exceptQuoteId);
  const { count } = await q;
  return count ?? 0;
}

/** 기관 담당자 계정 수 */
export async function seatsUsed(orgId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { count } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("cro_org_id", orgId);
  return count ?? 0;
}

type OrgPlan = { id: string; plan?: string | null; plan_next?: string | null; plan_next_from?: string | null };

/** 처음 제출하는 5,000만 원 미만 견적이 이번 달 한도를 넘는지. 넘으면 오류 문구 */
export async function quoteQuotaError(org: OrgPlan, total: number, firstSubmit: boolean, quoteId?: string | null): Promise<string | null> {
  if (!firstSubmit || total >= SUBSCRIPTION_MAX_EXCL) return null;
  const limit = monthlyQuoteLimit(org, todaySeoul());
  if (limit == null) return null;
  const used = await quotesThisMonth(org.id, quoteId);
  if (used < limit) return null;
  return `무료 요금제의 이번 달 5,000만 원 미만 견적 ${limit}건을 모두 보냈어요. 다음 달 1일에 다시 ${limit}건이 되고, Plus·Pro 요금제는 무제한이에요. 요금제는 요금제·결제 화면에서 바꿀 수 있어요.`;
}

/** 담당자를 한 명 더 연결할 수 있는지. 안 되면 오류 문구 */
export async function seatError(org: OrgPlan): Promise<string | null> {
  const limit = seatLimit(org, todaySeoul());
  if (limit == null) return null;
  if ((await seatsUsed(org.id)) < limit) return null;
  const name = PLANS[(["free", "plus", "pro"] as const).find((id) => PLANS[id].seats === limit) ?? "free"].name;
  return `${name} 요금제는 담당자 ${limit}명까지예요. 요금제·결제 화면에서 요금제를 올리면 더 연결할 수 있어요.`;
}

/** API 에서 요금제 기능을 막을 때 쓰는 오류 문구. 쓸 수 있으면 null */
export function featureError(org: OrgPlan | null | undefined, feature: PlanFeature): string | null {
  if (canUse(org, feature, todaySeoul())) return null;
  const label = FEATURE_LABEL[feature];
  const c = label.charCodeAt(label.length - 1) - 0xac00;
  const topic = c >= 0 && c < 11172 && c % 28 ? "은" : "는";
  return `${label}${topic} ${PLANS[planFor(feature)].name} 요금제부터 쓸 수 있어요.`;
}
