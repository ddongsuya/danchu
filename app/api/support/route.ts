import { NextResponse } from "next/server";
import { sendSupportMail } from "@/lib/mail";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST { email, type, rfqNo?, text } — 운영자 메일로 전달. 성공 응답은 실제 발송 여부를 담는다. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const type = typeof b.type === "string" ? b.type.slice(0, 40) : "기타";
  const rfqNo = typeof b.rfqNo === "string" ? b.rfqNo.slice(0, 20) : "";
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 4000) : "";

  if (!EMAIL.test(email)) return NextResponse.json({ error: "답변 받을 이메일을 확인해 주세요." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "문의 내용을 입력해 주세요." }, { status: 400 });

  const sent = await sendSupportMail({ email, type, rfqNo, text }).catch((e) => {
    console.error("support mail", e);
    return false;
  });
  if (!sent) {
    console.warn("[danchu] 문의 미발송(메일 미설정)", JSON.stringify({ email, type, rfqNo, text }));
    return NextResponse.json({ error: "지금은 문의를 접수할 수 없습니다. hello@danchu.kr로 직접 보내주세요." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
