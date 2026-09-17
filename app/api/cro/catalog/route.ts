import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { loadCatalog, upsertCatalog } from "@/lib/catalog-db";
import { catalogItems } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 내 기관 카탈로그 (조합 행 전체) */
export async function GET() {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  return NextResponse.json({ items: catalogItems(), rows: await loadCatalog(s.profile.cro_org_id) });
}

/** POST { rows: CatalogRow[], removed?: string[] } — 편집한 조합 저장 (대분류 단위로 보낸다). 저장 후 전체 행을 돌려준다 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { rows?: unknown; removed?: unknown };
  if (!Array.isArray(b.rows)) return NextResponse.json({ error: "저장할 내용이 없습니다." }, { status: 400 });
  const r = await upsertCatalog(s.profile.cro_org_id, b.rows, Array.isArray(b.removed) ? b.removed : []);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, saved: r.saved, rows: r.rows });
}
