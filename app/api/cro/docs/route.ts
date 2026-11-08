import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { createDocFromCatalog, UUID } from "@/lib/quote-doc-db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRefs } from "@/lib/crm";
import { isKind } from "@/lib/study-kinds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { catalogIds: string[], manual?: string[], kind?: 갈래(직접 적은 시험의 갈래), client?, substance?, companyId?, contactId?, dealId? } — 카탈로그 조건으로 새 견적서 (단추 밖 의뢰자용). 만든 견적서 id 를 돌려준다 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { catalogIds?: unknown; client?: unknown; substance?: unknown; manual?: unknown; kind?: unknown; companyId?: unknown; contactId?: unknown; dealId?: unknown };
  const ids = Array.isArray(b.catalogIds) ? b.catalogIds.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 30) : [];
  const client = typeof b.client === "string" ? b.client.trim().slice(0, 200) : "";
  const substance = typeof b.substance === "string" ? b.substance.trim().slice(0, 200) : "";
  // 시험 목록에 없는 시험 이름 (질문 화면에서 직접 적은 시험)
  const manual = Array.isArray(b.manual) ? b.manual.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 10).map((x) => x.trim().slice(0, 120)) : [];
  const kind = isKind(b.kind) ? b.kind : "tox";
  const r = await createDocFromCatalog(orgId, s.org?.name ?? "", s.userId, ids, client, substance, manual, kind);
  if (!r.id) return NextResponse.json({ error: r.error || "견적서를 만들지 못했어요." }, { status: 500 });
  // 고객사 화면에서 만들었으면 그 고객사·담당자에 묶는다 (0038). 묶지 못해도 견적서는 그대로 둔다
  const companyId = typeof b.companyId === "string" && UUID.test(b.companyId) ? b.companyId : null;
  const contactId = typeof b.contactId === "string" && UUID.test(b.contactId) ? b.contactId : null;
  const dealId = typeof b.dealId === "string" && UUID.test(b.dealId) ? b.dealId : null;
  const sb = getSupabaseAdmin();
  if ((companyId || dealId) && sb && !(await checkRefs(sb, orgId, { company_id: companyId, contact_id: contactId, deal_id: dealId }))) {
    await sb.from("cro_quote_docs").update({ company_id: companyId, contact_id: contactId, deal_id: dealId }).eq("id", r.id).eq("org_id", orgId);
  }
  return NextResponse.json({ ok: true, id: r.id });
}
