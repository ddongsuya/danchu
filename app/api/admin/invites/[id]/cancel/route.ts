import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logEvent, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { reason? } — 초대를 거둔다 (잘못 보낸 기관, 담당자 부재). 만료 처리라 초대 한도 자리가 비고 청구에서 빠진다.
 * 제출된 회신이 있는 초대는 거둘 수 없다 (비교표·선정의 근거라서)
 * revoke_invite(0021)가 철회 표식(revoked_at)을 남기고 토큰을 바꾼다. 요청을 다시 열어도 이 초대는 닫힌 채로 남는다
 * 비교표가 열리기 전, 참여한 초대(joined_at 또는 작성 중 draft)는 거둘 수 없다 (409). 거두면 참여 수에서 빠져
 * "참여 기관 전원 제출" 조건이 기한 전에 채워질 수 있어서다 (2026-10-21 결정 2: 운영자 조기 마감 없음). 기관이 알린 철회는 /decline 으로 기록한다
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 200) : "";

  const sb = getSupabaseAdmin()!;
  const { data: inv } = await sb.from("rfq_invites").select("id, rfq_id, rfq_no, cro_name, cro_org_id, status, joined_at").eq("id", id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "전달 기록을 찾을 수 없습니다." }, { status: 404 });
  if (!["sent", "draft"].includes(inv.status)) return NextResponse.json({ error: "제출·거절된 초대나 이미 닫힌 초대는 거둘 수 없습니다." }, { status: 409 });
  if (inv.joined_at || inv.status === "draft") {
    const { data: rq } = await sb.from("rfq_requests").select("compared_at").eq("id", inv.rfq_id).maybeSingle();
    if (!rq?.compared_at) return NextResponse.json({ error: "참여한 기관의 초대는 비교표가 열리기 전에 취소할 수 없습니다. 기관이 철회를 알려 오면 회신 링크 화면에서 철회로 기록해 주세요.", code: "joined" }, { status: 409 });
  }

  const { data: rv, error } = await sb.rpc("revoke_invite", { p_invite_id: id, p_reason: reason || "운영자 초대 취소" });
  if (error) return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 500 });
  const res = rv as { ok?: boolean; code?: string; already?: boolean } | null;
  // 화면을 연 사이 기관이 제출했으면 거두지 않는다
  if (!res?.ok) return NextResponse.json({ error: "제출·거절된 초대나 이미 닫힌 초대는 거둘 수 없습니다." }, { status: 409 });
  if (res.already) return NextResponse.json({ ok: true, message: "이미 취소한 초대입니다." });
  await logEvent(inv.rfq_id, "invite_cancelled", `${inv.cro_name} 초대 취소`, reason || undefined, s.userId, { inviteId: id });
  await audit({ userId: s.userId, email: s.email }, "invite.cancel", { type: "rfq_invite", id, label: `${inv.rfq_no} · ${inv.cro_name}` }, { before: { status: inv.status }, after: { status: "expired" }, note: reason || undefined });
  if (inv.cro_org_id) {
    const { data: members } = await sb.from("profiles").select("id").eq("cro_org_id", inv.cro_org_id);
    await notifyUsers((members ?? []).map((m) => m.id as string), { kind: "시스템", title: `${inv.rfq_no} 전달이 취소되었습니다`, body: reason || "운영자가 이 요청의 전달을 거두었습니다. 회신 링크는 더 쓸 수 없습니다.", href: "/cro" });
  }
  return NextResponse.json({ ok: true, message: "초대를 취소했습니다. 빈 자리는 배포 패널에서 채우거나 다음 자동 보충 때 채워집니다." });
}
