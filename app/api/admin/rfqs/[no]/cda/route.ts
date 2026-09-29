import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getRfqByNo } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { needsCda } from "@/lib/request-policy";
import { logEvent } from "@/lib/notify";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ no: string }> },
) {
  const s = await sessionOrNull("admin");
  if (!s)
    return NextResponse.json(
      { error: "운영자만 처리할 수 있습니다." },
      { status: 403 },
    );
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !needsCda(rfq.confidentiality))
    return NextResponse.json(
      { error: "CDA 대상 요청이 아닙니다." },
      { status: 400 },
    );
  const b = await req.json().catch(() => ({}));
  const reference =
    typeof b.reference === "string" ? b.reference.trim().slice(0, 500) : "";
  if (
    typeof b.inviteId !== "string" ||
    typeof b.signed !== "boolean" ||
    !reference
  )
    return NextResponse.json(
      { error: "기관과 체결 확인 근거 또는 비공개 전환 사유를 입력해 주세요." },
      { status: 400 },
    );
  const sb = getSupabaseAdmin()!;
  const { data, error } = await sb
    .from("rfq_invites")
    .update({
      cda_signed_at: b.signed ? new Date().toISOString() : null,
      cda_reference: reference,
    })
    .eq("id", b.inviteId)
    .eq("rfq_id", rfq.id)
    .select("cro_name")
    .single();
  if (error || !data)
    return NextResponse.json(
      { error: "CDA 상태를 저장하지 못했습니다." },
      { status: 500 },
    );
  await logEvent(
    rfq.id,
    "cda",
    `${data.cro_name} · ${b.signed ? "체결 확인 후 회사명·첨부 공개" : "회사명·첨부 비공개 전환"}`,
    reference,
    s.userId,
  );
  return NextResponse.json({ ok: true });
}
