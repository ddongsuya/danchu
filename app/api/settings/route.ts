import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
export async function GET() {
  const s = await sessionOrNull();
  if (!s)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  const { data, error } = await getSupabaseAdmin()!
    .from("profiles")
    .select("email_notifications")
    .eq("id", s.userId)
    .single();
  if (error)
    return NextResponse.json(
      { error: "알림 설정을 불러오지 못했습니다." },
      { status: 503 },
    );
  return NextResponse.json({ email: data.email_notifications });
}
export async function PUT(req: Request) {
  const s = await sessionOrNull();
  if (!s)
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  const b = await req.json().catch(() => ({}));
  if (typeof b.email !== "boolean")
    return NextResponse.json(
      { error: "알림 설정을 확인해 주세요." },
      { status: 400 },
    );
  const { error } = await getSupabaseAdmin()!
    .from("profiles")
    .update({ email_notifications: b.email })
    .eq("id", s.userId);
  if (error)
    return NextResponse.json(
      { error: "저장하지 못했습니다. 다시 시도해 주세요." },
      { status: 500 },
    );
  return NextResponse.json({ email: b.email });
}
