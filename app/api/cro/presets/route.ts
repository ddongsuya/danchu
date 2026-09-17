import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { loadOrgPresets, upsertOrgPreset } from "@/lib/catalog-db";
import { presetByKey } from "@/lib/presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 내 기관이 제공한다고 표시한 패키지 */
export async function GET() {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  return NextResponse.json({ presets: await loadOrgPresets(s.profile.cro_org_id) });
}

/** POST { presetKey, offered, packagePrice?, note? } */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  if (!s || !s.profile.cro_org_id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { presetKey?: unknown; offered?: unknown; packagePrice?: unknown; note?: unknown };
  if (typeof b.presetKey !== "string" || !presetByKey(b.presetKey)) return NextResponse.json({ error: "알 수 없는 패키지입니다." }, { status: 400 });
  const ok = await upsertOrgPreset(s.profile.cro_org_id, { preset_key: b.presetKey, offered: b.offered !== false, package_price: b.packagePrice, note: b.note });
  if (!ok) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
