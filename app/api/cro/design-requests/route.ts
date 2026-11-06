import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { safeName } from "@/lib/upload";
import { DESIGN_DIR } from "@/lib/quote-doc-db";
import { esc, sendMail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 20 * 1024 * 1024;
const OK_TYPE = /^(application\/pdf|image\/(png|jpeg|webp)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel|application\/msword)$/;
const OK_EXT = /\.(pdf|png|jpe?g|webp|xlsx?|docx?)$/i;

/**
 * 견적서 양식 제작 요청 (0036).
 * POST { action: "upload-url", name, size, type } → 첨부를 올릴 서명 URL (cro-files/quote-design/<기관>/…)
 * POST { action: "create", note, files: [{path, name, size}] } → 요청 접수, 운영자에게 메일
 * 진행 중인 요청(접수·제작 중·검토)이 있으면 새 요청을 받지 않는다.
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았어요." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "upload-url") {
    const name = typeof b.name === "string" ? b.name : "";
    const size = typeof b.size === "number" ? b.size : 0;
    const type = typeof b.type === "string" ? b.type : "";
    if (!name || size <= 0) return NextResponse.json({ error: "파일 정보가 올바르지 않아요." }, { status: 400 });
    if (size > MAX_FILE) return NextResponse.json({ error: "파일은 20MB 이하만 올릴 수 있어요." }, { status: 400 });
    if (!OK_EXT.test(name) || (type && !OK_TYPE.test(type))) return NextResponse.json({ error: "PDF·엑셀·워드·이미지 파일만 올릴 수 있어요." }, { status: 400 });
    const path = `${DESIGN_DIR}/${orgId}/${Date.now()}_${safeName(name)}`;
    const { data, error } = await sb.storage.from("cro-files").createSignedUploadUrl(path);
    if (error || !data) {
      console.error("design upload url", error);
      return NextResponse.json({ error: "업로드 주소를 만들지 못했어요." }, { status: 500 });
    }
    return NextResponse.json({ path, signedUrl: data.signedUrl });
  }

  if (b.action === "create") {
    const { data: open } = await sb.from("cro_quote_design_requests").select("id").eq("org_id", orgId).in("status", ["received", "making", "review"]).limit(1);
    if (open?.length) return NextResponse.json({ error: "진행 중인 요청이 있어요. 적용된 뒤에 새로 요청할 수 있어요." }, { status: 409 });
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "";
    const prefix = `${DESIGN_DIR}/${orgId}/`;
    const files = (Array.isArray(b.files) ? b.files : []).slice(0, 10)
      .filter((f): f is { path: string; name: string; size: number } => !!f && typeof f === "object" && typeof (f as { path?: unknown }).path === "string" && (f as { path: string }).path.startsWith(prefix))
      .map((f) => ({ path: f.path, name: String(f.name ?? "파일").slice(0, 200), size: Number(f.size) || 0 }));
    if (!files.length && !note) return NextResponse.json({ error: "지금 쓰는 견적서 파일을 올리거나 요청 내용을 적어 주세요." }, { status: 400 });
    const { data, error } = await sb.from("cro_quote_design_requests").insert({ org_id: orgId, note, files, created_by: s.userId }).select("id").single();
    if (error || !data) {
      console.error("design request insert", error);
      return NextResponse.json({ error: "요청을 접수하지 못했어요." }, { status: 500 });
    }
    const admin = (process.env.ADMIN_EMAIL || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (admin.length) {
      await sendMail({
        to: admin,
        subject: `[단추] 견적서 양식 제작 요청 · ${s.org?.name ?? "기관"}`,
        html: `<p>${esc(s.org?.name ?? "기관")}에서 견적서 양식 제작을 요청했어요.</p><p>첨부 ${files.length}개${note ? `<br>요청 내용: ${esc(note)}` : ""}</p><p>운영자 화면 "견적서 양식 요청"에서 확인해요.</p>`,
      });
    }
    return NextResponse.json({ ok: true, id: data.id });
  }

  return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
}
