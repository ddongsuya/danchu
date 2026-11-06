import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { UUID } from "@/lib/quote-doc-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = ["received", "making", "review", "applied", "cancelled"];
type Ctx = { params: Promise<{ id: string }> };

/** GET ?file=0 — 운영자: 양식 제작 요청 첨부 내려받기 (5분 서명 주소로 보낸다) */
export async function GET(req: Request, { params }: Ctx) {
  const s = await sessionOrNull("admin");
  if (!s || s.profile.role !== "admin") return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const { id } = await params;
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(id)) return NextResponse.json({ error: "찾지 못했어요." }, { status: 404 });
  const i = Number(new URL(req.url).searchParams.get("file") ?? 0);
  const { data } = await sb.from("cro_quote_design_requests").select("files").eq("id", id).maybeSingle();
  const files = Array.isArray(data?.files) ? (data.files as { path?: string; name?: string }[]) : [];
  const f = files[Number.isInteger(i) ? i : -1];
  if (!f?.path) return NextResponse.json({ error: "파일이 없어요." }, { status: 404 });
  const { data: signed, error } = await sb.storage.from("cro-files").createSignedUrl(f.path, 300, { download: f.name || "file" });
  if (error || !signed) return NextResponse.json({ error: "파일을 열지 못했어요. 올리는 중에 끊긴 파일일 수 있어요." }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}

/** POST { status, reply } — 운영자: 진행 단계와 기관에 보일 답 */
export async function POST(req: Request, { params }: Ctx) {
  const s = await sessionOrNull("admin");
  if (!s || s.profile.role !== "admin") return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const { id } = await params;
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(id)) return NextResponse.json({ error: "찾지 못했어요." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { status?: unknown; reply?: unknown };
  const patch: { status?: string; reply?: string } = {};
  if (typeof b.status === "string" && STATUS.includes(b.status)) patch.status = b.status;
  if (typeof b.reply === "string") patch.reply = b.reply.trim().slice(0, 2000);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "바꿀 내용이 없어요." }, { status: 400 });
  const { error } = await sb.from("cro_quote_design_requests").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
