import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { safeName } from "@/lib/upload";
import { rateLimited } from "@/lib/rate-limit";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ no: string }> },
) {
  const s = await sessionOrNull();
  if (!s)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin"))
    return NextResponse.json(
      { error: "요청을 찾을 수 없습니다." },
      { status: 404 },
    );
  if (["closed", "cancelled"].includes(rfq.status))
    return NextResponse.json(
      { error: "종료된 요청에는 첨부할 수 없습니다." },
      { status: 409 },
    );
  if (await rateLimited("file-retry", s.userId, 30, 600))
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  const b = await req.json().catch(() => ({}));
  if (
    typeof b.name !== "string" ||
    b.name.length > 200 ||
    !/\.(pdf|png|jpe?g|docx?|xlsx?|hwp)$/i.test(b.name) ||
    !Number.isInteger(b.size) ||
    b.size <= 0 ||
    b.size > 20 * 1024 * 1024
  )
    return NextResponse.json(
      { error: "지원하는 형식의 20MB 이하 파일을 선택해 주세요." },
      { status: 400 },
    );
  const sb = getSupabaseAdmin()!;
  const { data: files, error } = await sb
    .from("rfq_files")
    .select("*")
    .eq("rfq_id", rfq.id);
  if (error)
    return NextResponse.json(
      { error: "첨부 목록을 불러오지 못했습니다." },
      { status: 503 },
    );
  const existing = files.find(
    (f) => f.file_name === b.name && f.size_bytes === b.size,
  );
  if (existing?.uploaded_at) return NextResponse.json({ uploaded: true });
  if (!existing && files.length >= 10)
    return NextResponse.json(
      { error: "첨부는 최대 10개입니다." },
      { status: 400 },
    );
  const path =
    existing?.storage_path ||
    `${no}/${crypto.randomUUID()}-${safeName(b.name)}`;
  if (!existing) {
    const { error: insertError } = await sb
      .from("rfq_files")
      .insert({
        rfq_id: rfq.id,
        storage_path: path,
        file_name: b.name,
        size_bytes: b.size,
        mime_type: typeof b.type === "string" ? b.type.slice(0, 100) : null,
      });
    if (insertError)
      return NextResponse.json(
        { error: "첨부 정보를 저장하지 못했습니다." },
        { status: 500 },
      );
  }
  const { data: ticket, error: signError } = await sb.storage
    .from("rfq-files")
    .createSignedUploadUrl(path, { upsert: true });
  if (signError || !ticket)
    return NextResponse.json(
      { error: "업로드를 준비하지 못했습니다. 다시 시도해 주세요." },
      { status: 500 },
    );
  return NextResponse.json({ name: b.name, path, signedUrl: ticket.signedUrl });
}
