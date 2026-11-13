import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { saveRates } from "@/lib/quote-doc-db";
import { featureError } from "@/lib/plan-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { itemKey, prices: [{id, std_price}], rates: Rate[] } — 시험 하나의 조건별 표준가와 추가 비용 단가 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  { const pe = featureError(s.org, "tests"); if (pe) return NextResponse.json({ error: pe }, { status: 403 }); }
  const b = (await req.json().catch(() => ({}))) as { itemKey?: unknown; prices?: unknown; rates?: unknown };
  if (typeof b.itemKey !== "string" || !b.itemKey.includes("::")) return NextResponse.json({ error: "시험을 고르세요." }, { status: 400 });
  const r = await saveRates(orgId, b.itemKey, b.prices, b.rates);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
