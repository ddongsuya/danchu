import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendMail } from "@/lib/mail";
import { inviteMailHtml, inviteMailSubject } from "@/lib/distribute";
import { logEvent } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST — 배포 메일을 다시 보낸다 (메일 유실·담당자 변경 때). 열린 초대만 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (await rateLimited("invite-resend", id, 3, 3600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const sb = getSupabaseAdmin()!;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("id", id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "전달 기록을 찾을 수 없습니다." }, { status: 404 });
  if (!["sent", "draft"].includes(inv.status)) return NextResponse.json({ error: "회신이 끝났거나 닫힌 초대에는 다시 보낼 수 없습니다." }, { status: 409 });
  if (new Date(inv.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "회신 링크가 만료되었습니다. 회신 기한을 늘린 뒤 다시 보내 주세요." }, { status: 409 });
  const { data: rfq } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

  // 기관 대표 메일이 바뀌었으면 바뀐 주소로. 초대 행의 주소도 맞춰 둔다
  const { data: org } = inv.cro_org_id ? await sb.from("cro_orgs").select("contact_email").eq("id", inv.cro_org_id).maybeSingle() : { data: null };
  const to = (org?.contact_email || inv.cro_email).trim();
  const ok = await sendMail({ to: [to], subject: inviteMailSubject(rfq, inv.reply_by), html: inviteMailHtml(rfq, inv.reply_by, inv.token, inv.id) }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "메일을 보내지 못했습니다. 메일 설정(RESEND_API_KEY)을 확인해 주세요." }, { status: 502 });
  await sb.from("rfq_invites").update({ mailed_at: new Date().toISOString(), cro_email: to }).eq("id", id);
  await logEvent(inv.rfq_id, "resend", `${inv.cro_name} 배포 메일 재발송`, to, s.userId, { inviteId: id });
  await audit({ userId: s.userId, email: s.email }, "invite.resend", { type: "rfq_invite", id, label: `${inv.rfq_no} · ${inv.cro_name}` }, { after: { to } });
  return NextResponse.json({ ok: true, message: `${to} 로 다시 보냈습니다.` });
}
