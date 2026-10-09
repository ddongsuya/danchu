import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { reason? } — 초대를 거둔다 (잘못 보낸 기관, 담당자 부재). 만료 처리라 초대 한도 자리가 비고 청구에서 빠진다.
 * 제출된 회신이 있는 초대는 거둘 수 없다 (비교표·선정의 근거라서)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 200) : "";

  const sb = getSupabaseAdmin()!;
  const { data: inv } = await sb.from("rfq_invites").select("id, rfq_id, rfq_no, cro_name, cro_org_id, status").eq("id", id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "전달 기록을 찾을 수 없습니다." }, { status: 404 });
  if (!["sent", "draft"].includes(inv.status)) return NextResponse.json({ error: "제출·거절된 초대나 이미 닫힌 초대는 거둘 수 없습니다." }, { status: 409 });

  const { error } = await sb.from("rfq_invites").update({ status: "expired", billable: false, bill_excluded_reason: reason || "운영자 초대 취소" }).eq("id", id).in("status", ["sent", "draft"]);
  if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  await logEvent(inv.rfq_id, "invite_cancelled", `${inv.cro_name} 초대 취소`, reason || undefined, s.userId, { inviteId: id });
  await audit({ userId: s.userId, email: s.email }, "invite.cancel", { type: "rfq_invite", id, label: `${inv.rfq_no} · ${inv.cro_name}` }, { before: { status: inv.status }, after: { status: "expired" }, note: reason || undefined });
  if (inv.cro_org_id) {
    const { data: members } = await sb.from("profiles").select("id").eq("cro_org_id", inv.cro_org_id);
    await notifyUsers((members ?? []).map((m) => m.id as string), { kind: "시스템", title: `${inv.rfq_no} 전달이 취소되었습니다`, body: reason || "운영자가 이 요청의 전달을 거두었습니다. 회신 링크는 더 쓸 수 없습니다.", href: "/cro" });
  }
  return NextResponse.json({ ok: true, message: "초대를 취소했습니다. 빈 자리는 배포 패널에서 채우거나 다음 자동 보충 때 채워집니다." });
}
