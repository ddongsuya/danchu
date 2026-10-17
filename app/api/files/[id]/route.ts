import { anonymousFileLabel, confidentialAccess, identityVisible } from "@/lib/request-policy";
import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { storageHas } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/[id]?token=… RFQ 첨부 파일 다운로드. 의뢰자·운영자·선정된 기관은 서명 URL로 리다이렉트하고, 선정 전 기관에는 서버가 받아 익명 이름으로 흘려 준다.
 * 허용: 요청 소유 의뢰자 · 운영자 · 이 요청의 초대를 받은 CRO(계정 또는 토큰). CDA 마스킹 요청은 CRO에게 열지 않는다.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const { data: f } = await sb.from("rfq_files").select("*").eq("id", id).maybeSingle();
  if (!f) return NextResponse.json({ error: "파일이 없습니다." }, { status: 404 });
  const file = f;
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", file.rfq_id).maybeSingle();
  if (!r) return NextResponse.json({ error: "요청이 없습니다." }, { status: 404 });
  const rfq = r;

  const s = await sessionOrNull();
  const token = new URL(req.url).searchParams.get("token") || "";
  let allowed = false;
  // 기관 열람이면 선정 전까지 파일명을 가린다 (화면 라벨과 같은 규칙, CDA 체결과 무관). 의뢰자·운영자는 원본 이름
  let viaInvite: { id: string; cda_signed_at: string | null } | null = null;
  if (s) {
    if (s.profile.role === "admin") allowed = true;
    else if (rfq.user_id === s.userId || rfq.email.toLowerCase() === s.email.toLowerCase()) allowed = true;
    else if (s.profile.role === "cro" && s.profile.cro_org_id) {
      const { data: inv } = await sb.from("rfq_invites").select("id, cda_signed_at, expires_at, status").eq("rfq_id", rfq.id).eq("cro_org_id", s.profile.cro_org_id).maybeSingle();
      allowed = !!inv && inv.status !== "expired" && new Date(inv.expires_at).getTime() > Date.now() && confidentialAccess(rfq.confidentiality, inv.cda_signed_at);
      if (allowed && inv) viaInvite = inv;
    }
  }
  if (!allowed && token) {
    const { data: inv } = await sb.from("rfq_invites").select("id, cda_signed_at, expires_at, status").eq("rfq_id", rfq.id).eq("token", token).maybeSingle();
    allowed = !!inv && inv.status !== "expired" && new Date(inv.expires_at).getTime() > Date.now() && confidentialAccess(rfq.confidentiality, inv.cda_signed_at);
    if (allowed && inv) viaInvite = inv;
  }
  if (!allowed) return NextResponse.json({ error: "열람 권한이 없습니다." }, { status: 403 });

  let downloadName = file.file_name;
  let asciiName: string | null = null; // 선정 전 기관에 흘려 줄 때의 ASCII 대체 이름. null 이면 리다이렉트
  if (viaInvite) {
    const { data: q } = await sb.from("cro_quotes").select("id").eq("invite_id", viaInvite.id).maybeSingle();
    const awarded = !!q && !!rfq.selected_quote_id && rfq.selected_quote_id === q.id;
    if (!identityVisible({ awarded })) {
      const { data: all } = await sb.from("rfq_files").select("id").eq("rfq_id", rfq.id).order("created_at");
      const idx = Math.max(0, (all ?? []).findIndex((x) => x.id === file.id));
      const ext = file.file_name.includes(".") ? file.file_name.slice(file.file_name.lastIndexOf(".")) : "";
      downloadName = anonymousFileLabel(idx, file.file_name, file.size_bytes).replace(/\s*\(.*\)$/, "") + ext;
      asciiName = `attachment-${idx + 1}${ext.replace(/[^.A-Za-z0-9]/g, "")}`;
    }
  }

  if (!file.uploaded_at) {
    // 접수 직후 확인 API 를 못 탄 파일: 저장소에 있으면 지금 확인 표시, 없으면 아직 안 올라온 것
    const ok = await storageHas(sb, "rfq-files", file.storage_path);
    if (!ok) return NextResponse.json({ error: "아직 업로드되지 않은 파일입니다. 의뢰자가 다시 첨부해야 합니다." }, { status: 404 });
    await sb.from("rfq_files").update({ uploaded_at: new Date().toISOString() }).eq("id", file.id);
  }
  if (asciiName) {
    // 저장 경로(rfq_no/시각-원본이름)와 서명 URL 에는 원본 파일명이 남아 있다. 선정 전 기관에는 URL 을 넘기지 않고 서버가 대신 받아 흘려 준다
    const { data: signed, error } = await sb.storage.from("rfq-files").createSignedUrl(file.storage_path, 60);
    if (error || !signed) return NextResponse.json({ error: "파일 링크를 만들지 못했습니다." }, { status: 500 });
    const upstream = await fetch(signed.signedUrl).catch(() => null);
    if (!upstream?.ok || !upstream.body) return NextResponse.json({ error: "파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    const headers = new Headers({
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    return new NextResponse(upstream.body, { status: 200, headers });
  }
  const { data: signed, error } = await sb.storage.from("rfq-files").createSignedUrl(file.storage_path, 300, { download: downloadName });
  if (error || !signed) return NextResponse.json({ error: "파일 링크를 만들지 못했습니다." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
