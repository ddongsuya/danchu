import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { comparisonOpened } from "@/lib/reply-window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quotes/[id]/pdf?token=… — CRO 정식 견적서 PDF (서명 URL로 리다이렉트).
 * 허용: 제출한 CRO(계정 또는 토큰) · 운영자 · 요청 소유 의뢰자(제출된 견적만, 비교표가 열린 뒤에만. 2026-10-20 결정 1, lib/reply-window.ts).
 * 운영자가 거둔 초대(revoked_at, 0021)의 견적은 운영자만 연다. 소유는 user_id 로만 판단한다.
 * 기관(계정·토큰) 경로는 참여 기록이 있는 초대만 (0023. 견적 행은 참여한 초대에만 생기지만 여기서도 확인한다).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const { data: q } = await sb.from("cro_quotes").select("*").eq("id", id).maybeSingle();
  if (!q || !q.pdf_path) return NextResponse.json({ error: "PDF가 없습니다." }, { status: 404 });
  const quote = q;
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", quote.rfq_id).maybeSingle();
  const rfq = r;

  const s = await sessionOrNull();
  const token = new URL(req.url).searchParams.get("token") || "";
  let allowed = false;
  if (s?.profile.role === "admin") allowed = true;
  else {
    const { data: inv } = await sb.from("rfq_invites").select("id, token, revoked_at, joined_at").eq("id", quote.invite_id).maybeSingle();
    if (inv && !inv.revoked_at) {
      if (s?.profile.role === "cro" && s.profile.cro_org_id && quote.cro_org_id === s.profile.cro_org_id && !!inv.joined_at) allowed = true;
      else if (s && rfq && quote.status === "submitted" && !!rfq.user_id && rfq.user_id === s.userId && comparisonOpened(rfq)) allowed = true;
      else if (token && inv.token === token && !!inv.joined_at) allowed = true;
    }
  }
  if (!allowed) return NextResponse.json({ error: "열람 권한이 없습니다." }, { status: 403 });

  const { data: signed, error } = await sb.storage.from("cro-files").createSignedUrl(quote.pdf_path!, 300, { download: quote.pdf_name || "quote.pdf" });
  if (error || !signed) return NextResponse.json({ error: "파일 링크를 만들지 못했습니다." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
