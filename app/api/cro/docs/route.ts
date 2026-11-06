import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { createDocFromCatalog, UUID } from "@/lib/quote-doc-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { catalogIds: string[], client?, substance? } — 카탈로그 조건으로 새 견적서 (단추 밖 의뢰자용). 만든 견적서 id 를 돌려준다 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { catalogIds?: unknown; client?: unknown; substance?: unknown };
  const ids = Array.isArray(b.catalogIds) ? b.catalogIds.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 30) : [];
  const client = typeof b.client === "string" ? b.client.trim().slice(0, 200) : "";
  const substance = typeof b.substance === "string" ? b.substance.trim().slice(0, 200) : "";
  const r = await createDocFromCatalog(orgId, s.org?.name ?? "", s.userId, ids, client, substance);
  if (!r.id) return NextResponse.json({ error: r.error || "견적서를 만들지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true, id: r.id });
}
