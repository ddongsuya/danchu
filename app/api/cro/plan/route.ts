import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { captureError } from "@/lib/observe";
import { todaySeoul } from "@/lib/format";
import { PLANS, isPlanId, planChange, planOn, seatLimit } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * POST { plan: 'free'|'plus'|'pro' } — 기관 대표 담당자가 요금제를 바꾼다 (0044, lib/plans.ts).
 * 시범 운영 중에는 2028-01-01 예약, 정식 뒤 올리기는 오늘부터, 내리기는 다음 달 1일부터.
 * 카드 결제는 PG 연동 뒤 붙는다. 지금은 변경 기록에 차액만 남긴다.
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const org = s?.org;
  if (!s || !org || org.status !== "approved") return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  if (s.demo) return NextResponse.json({ error: "둘러보기 화면에서는 저장되지 않아요." }, { status: 403 });
  if (s.profile.org_role !== "owner") return NextResponse.json({ error: "요금제는 기관 대표 담당자만 바꿀 수 있어요." }, { status: 403 });
  if (await rateLimited("cro-plan", s.userId, 10, 600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { plan?: unknown };
  if (!isPlanId(b.plan)) return NextResponse.json({ error: "요금제를 골라 주세요." }, { status: 400 });
  const to = b.plan;
  const today = todaySeoul();
  const c = planChange(org, to, today);
  if (c.kind === "same") return NextResponse.json({ ok: true, message: `이미 ${PLANS[to].name} 요금제예요.` });

  const sb = getSupabaseAdmin()!;
  // 내리기는 담당자 수가 새 한도 안이어야 한다 (정식 뒤에만. 시범 운영 중 예약은 적용일 전에 정리하면 된다)
  if (c.kind === "downgrade") {
    const limit = PLANS[to].seats;
    if (limit != null && seatLimit(org, today) !== null) {
      const { count } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("cro_org_id", org.id);
      if ((count ?? 0) > limit) return NextResponse.json({ error: `${PLANS[to].name} 요금제는 담당자 ${limit}명까지예요. 기관 화면에서 담당자를 ${limit}명으로 줄인 뒤 바꿔 주세요.` }, { status: 409 });
    }
  }

  const cur = planOn(org, today);
  const patch =
    c.kind === "reserve" ? { plan_next: to, plan_next_from: c.from }
    : c.kind === "downgrade" ? { plan: cur, plan_next: to, plan_next_from: c.from }
    : { plan: to, plan_next: null, plan_next_from: null }; // upgrade, cancel
  const { error } = await sb.from("cro_orgs").update(patch).eq("id", org.id);
  if (error) {
    captureError(error, "cro-plan:update", { org: org.id });
    return NextResponse.json({ error: "요금제를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
  const { error: le } = await sb.from("cro_plan_changes").insert({
    org_id: org.id,
    from_plan: c.kind === "reserve" ? org.plan_next ?? cur : cur,
    to_plan: to,
    effective_from: c.kind === "cancel" ? today : c.from,
    prorated_amount: c.kind === "upgrade" ? c.prorated : 0,
    requested_by: s.userId,
  });
  if (le) captureError(le, "cro-plan:log", { org: org.id });

  const name = PLANS[to].name;
  const day = (d: string) => `${Number(d.slice(0, 4))}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
  const message =
    c.kind === "reserve" ? `${day(c.from)}부터 ${name} 요금제로 예약했어요.`
    : c.kind === "upgrade" ? `오늘부터 ${name} 요금제예요.`
    : c.kind === "downgrade" ? `${day(c.from)}부터 ${name} 요금제로 바뀌어요.`
    : `${name} 요금제를 그대로 써요. 예약한 변경을 취소했어요.`;
  return NextResponse.json({ ok: true, message });
}
