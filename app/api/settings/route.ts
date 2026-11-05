import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeMobile } from "@/lib/sms";

/** GET: 알림 설정 { email, sms, hasPhone }. sms 는 0033 전 DB 면 null */
export async function GET() {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const sb = getSupabaseAdmin()!;
  const { data, error } = await sb.from("profiles").select("email_notifications, sms_notifications, phone").eq("id", s.userId).single();
  if (error) {
    // 0033 전 DB: 문자 설정 열이 없다. 이메일 설정만 돌려준다
    const { data: old, error: e2 } = await sb.from("profiles").select("email_notifications").eq("id", s.userId).single();
    if (e2) return NextResponse.json({ error: "알림 설정을 불러오지 못했어요." }, { status: 503 });
    return NextResponse.json({ email: old.email_notifications, sms: null, hasPhone: false });
  }
  return NextResponse.json({ email: data.email_notifications, sms: data.sms_notifications ?? true, hasPhone: !!normalizeMobile(data.phone) });
}

/** PUT { email?: boolean, sms?: boolean } */
export async function PUT(req: Request) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { email?: unknown; sms?: unknown };
  const patch: { email_notifications?: boolean; sms_notifications?: boolean } = {};
  if (typeof b.email === "boolean") patch.email_notifications = b.email;
  if (typeof b.sms === "boolean") patch.sms_notifications = b.sms;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "알림 설정을 확인해 주세요." }, { status: 400 });
  const { error } = await getSupabaseAdmin()!.from("profiles").update(patch).eq("id", s.userId);
  if (error) return NextResponse.json({ error: "저장하지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  return NextResponse.json({ ...(patch.email_notifications !== undefined ? { email: patch.email_notifications } : {}), ...(patch.sms_notifications !== undefined ? { sms: patch.sms_notifications } : {}) });
}
