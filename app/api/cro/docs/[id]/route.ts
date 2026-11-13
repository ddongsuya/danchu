import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { copyDoc, deleteDoc, loadDoc, saveDoc } from "@/lib/quote-doc-db";
import { featureError } from "@/lib/plan-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function org() {
  const s = await sessionOrNull("cro");
  return s?.profile.cro_org_id && !featureError(s.org, "quote_tool") ? { s, orgId: s.profile.cro_org_id } : null;
}
const denied = () => NextResponse.json({ error: "권한이 없어요." }, { status: 403 });

/** GET — 견적서 한 부 */
export async function GET(_req: Request, { params }: Ctx) {
  const o = await org();
  if (!o) return denied();
  const got = await loadDoc(o.orgId, (await params).id);
  if (!got) return NextResponse.json({ error: "견적서를 찾지 못했어요." }, { status: 404 });
  return NextResponse.json(got);
}

/** PUT { client, substance, issuedOn, validUntil, memo, data } — 자동 저장 */
export async function PUT(req: Request, { params }: Ctx) {
  const o = await org();
  if (!o) return denied();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "저장할 내용이 없어요." }, { status: 400 });
  const r = await saveDoc(o.orgId, (await params).id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt: r.updatedAt });
}

/** POST { action: "copy" } — 복제 */
export async function POST(req: Request, { params }: Ctx) {
  const o = await org();
  if (!o) return denied();
  const b = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (b.action !== "copy") return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
  const r = await copyDoc(o.orgId, o.s.userId, (await params).id);
  if (!r.id) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, id: r.id });
}

/** DELETE — 삭제 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const o = await org();
  if (!o) return denied();
  const ok = await deleteDoc(o.orgId, (await params).id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "삭제하지 못했어요." }, { status: 500 });
}
