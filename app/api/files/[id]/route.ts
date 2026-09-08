import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { FileRow, RfqRow } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/[id]?token=… — RFQ 첨부 파일 다운로드 (서명 URL로 리다이렉트).
 * 허용: 요청 소유 의뢰자 · 운영자 · 이 요청의 초대를 받은 CRO(계정 또는 토큰). CDA 마스킹 요청은 CRO에게 열지 않는다.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const { data: f } = await sb.from("rfq_files").select("*").eq("id", id).maybeSingle();
  if (!f) return NextResponse.json({ error: "파일이 없습니다." }, { status: 404 });
  const file = f as FileRow;
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", file.rfq_id).maybeSingle();
  if (!r) return NextResponse.json({ error: "요청이 없습니다." }, { status: 404 });
  const rfq = r as RfqRow;

  const s = await sessionOrNull();
  const token = new URL(req.url).searchParams.get("token") || "";
  let allowed = false;
  if (s) {
    if (s.profile.role === "admin") allowed = true;
    else if (rfq.user_id === s.userId || rfq.email.toLowerCase() === s.email.toLowerCase()) allowed = true;
    else if (s.profile.role === "cro" && s.profile.cro_org_id && !(rfq.confidentiality || "").startsWith("CDA")) {
      const { data: inv } = await sb.from("rfq_invites").select("id").eq("rfq_id", rfq.id).eq("cro_org_id", s.profile.cro_org_id).maybeSingle();
      allowed = !!inv;
    }
  }
  if (!allowed && token && !(rfq.confidentiality || "").startsWith("CDA")) {
    const { data: inv } = await sb.from("rfq_invites").select("id").eq("rfq_id", rfq.id).eq("token", token).maybeSingle();
    allowed = !!inv;
  }
  if (!allowed) return NextResponse.json({ error: "열람 권한이 없습니다." }, { status: 403 });

  const { data: signed, error } = await sb.storage.from("rfq-files").createSignedUrl(file.storage_path, 300, { download: file.file_name });
  if (error || !signed) return NextResponse.json({ error: "파일 링크를 만들지 못했습니다." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
