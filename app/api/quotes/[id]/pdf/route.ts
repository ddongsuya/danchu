import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { QuoteRow, RfqRow } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quotes/[id]/pdf?token=… — CRO 정식 견적서 PDF (서명 URL로 리다이렉트).
 * 허용: 제출한 CRO(계정 또는 토큰) · 운영자 · 비교표가 공개된 뒤의 요청 소유 의뢰자.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const { data: q } = await sb.from("cro_quotes").select("*").eq("id", id).maybeSingle();
  if (!q || !(q as QuoteRow).pdf_path) return NextResponse.json({ error: "PDF가 없습니다." }, { status: 404 });
  const quote = q as QuoteRow;
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", quote.rfq_id).maybeSingle();
  const rfq = r as RfqRow | null;

  const s = await sessionOrNull();
  const token = new URL(req.url).searchParams.get("token") || "";
  let allowed = false;
  if (s) {
    if (s.profile.role === "admin") allowed = true;
    else if (s.profile.role === "cro" && s.profile.cro_org_id && quote.cro_org_id === s.profile.cro_org_id) allowed = true;
    else if (rfq && rfq.compared_at && (rfq.user_id === s.userId || rfq.email.toLowerCase() === s.email.toLowerCase())) allowed = true;
  }
  if (!allowed && token) {
    const { data: inv } = await sb.from("rfq_invites").select("id").eq("id", quote.invite_id).eq("token", token).maybeSingle();
    allowed = !!inv;
  }
  if (!allowed) return NextResponse.json({ error: "열람 권한이 없습니다." }, { status: 403 });

  const { data: signed, error } = await sb.storage.from("cro-files").createSignedUrl(quote.pdf_path!, 300, { download: quote.pdf_name || "quote.pdf" });
  if (error || !signed) return NextResponse.json({ error: "파일 링크를 만들지 못했습니다." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
