import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadQuote } from "@/lib/quote-load";
import { safeName } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF = 20 * 1024 * 1024;

/** POST { name, size, type } — 정식 견적서 PDF를 올릴 서명 URL 발급. 본문은 브라우저가 직접 올린다. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const got = await loadQuote(token);
  if (!got) return NextResponse.json({ error: "유효하지 않거나 만료된 링크입니다." }, { status: 404 });
  if (got.expired) return NextResponse.json({ error: "링크가 만료되었습니다." }, { status: 403 });
  if (got.locked || got.closed) return NextResponse.json({ error: "지금은 수정할 수 없습니다." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { name?: unknown; size?: unknown; type?: unknown };
  const name = typeof b.name === "string" ? b.name : "";
  const size = typeof b.size === "number" ? b.size : 0;
  const type = typeof b.type === "string" ? b.type : "";
  if (!name || size <= 0) return NextResponse.json({ error: "파일 정보가 올바르지 않습니다." }, { status: 400 });
  if (size > MAX_PDF) return NextResponse.json({ error: "PDF는 20MB 이하만 첨부할 수 있습니다." }, { status: 400 });
  if (type && type !== "application/pdf" && !/\.pdf$/i.test(name)) return NextResponse.json({ error: "PDF 파일만 첨부할 수 있습니다." }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았습니다." }, { status: 503 });
  const path = `${got.rfq.no}/${got.inviteId}/${Date.now()}_${safeName(name)}`;
  const { data, error } = await sb.storage.from("cro-files").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("cro signed upload url", error);
    return NextResponse.json({ error: "업로드 URL을 만들지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl });
}
