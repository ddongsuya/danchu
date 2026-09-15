import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { loadCatalog, upsertCatalog } from "@/lib/catalog-db";
import { catalogItems } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 내 기관 카탈로그 (모든 항목, 빈 행 포함) */
export async function GET() {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  return NextResponse.json({ items: catalogItems(), rows: await loadCatalog(s.profile.cro_org_id) });
}

/** POST { rows: CatalogRow[] } — 편집한 행 저장 (대분류 단위로 보낸다) */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { rows?: unknown };
  if (!Array.isArray(b.rows)) return NextResponse.json({ error: "저장할 내용이 없습니다." }, { status: 400 });
  const r = await upsertCatalog(s.profile.cro_org_id, b.rows);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, saved: r.saved });
}
