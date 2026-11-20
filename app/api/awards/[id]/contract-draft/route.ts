import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { awardForOrg, sendDraft } from "@/lib/contract-draft-db";

export const runtime = "nodejs";

/** POST — 선정된 기관이 계약서(안)을 의뢰자에게 보낸다 (요청 기록 + 의뢰자 알림). 서명은 단추 밖에서 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const award = await awardForOrg(orgId, (await ctx.params).id);
  if (!award) return NextResponse.json({ error: "수주 기록이 없어요." }, { status: 404 });
  const r = await sendDraft(award, s.userId);
  return r.ok ? NextResponse.json({ ok: true, sentAt: r.sentAt }) : NextResponse.json({ error: r.error }, { status: r.status });
}
