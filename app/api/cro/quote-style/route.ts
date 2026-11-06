import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { saveStyle } from "@/lib/quote-doc-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { brandColor, logo (data URL), logoPos, supplier, terms } — 견적서 양식 저장. 다음에 만드는 견적서부터 거래 조건 기본 문구가 들어간다 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "저장할 내용이 없어요." }, { status: 400 });
  const r = await saveStyle(orgId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
