import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyUsers } from "@/lib/notify";
import { distributeOpenRfqs } from "@/lib/distribute";
import { captureError } from "@/lib/observe";

export const runtime = "nodejs";

/**
 * POST { userId, action: 'approve'|'reject'|'remove' } — 기관 대표 담당자(owner)의 담당자 관리.
 * - approve: 이 기관에 합류 신청한 계정을 연결한다 (운영자 개입 없이)
 * - reject: 합류 신청을 비운다. 계정은 남는다
 * - remove: 담당자를 기관에서 뺀다. 그 기관의 열린 회신 링크를 새로 발급해 퇴사자가 받은 메일 링크를 무효화한다
 */
export async function POST(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  if (s.profile.org_role !== "owner") return NextResponse.json({ error: "담당자 관리는 기관 대표 담당자만 할 수 있습니다." }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { userId?: unknown; action?: unknown };
  const userId = typeof b.userId === "string" && /^[0-9a-f-]{36}$/.test(b.userId) ? b.userId : "";
  const action = typeof b.action === "string" ? b.action : "";
  if (!userId || !["approve", "reject", "remove"].includes(action)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (userId === s.userId) return NextResponse.json({ error: "본인은 처리할 수 없습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { data: target } = await sb.from("profiles").select("id, email, name, role, cro_org_id, pending_org_id, org_role").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  const orgName = s.org?.name ?? "기관";

  if (action === "approve" || action === "reject") {
    if (target.pending_org_id !== orgId || target.cro_org_id) return NextResponse.json({ error: "이 기관에 합류를 신청한 계정이 아닙니다." }, { status: 400 });
    const patch = action === "approve" ? { cro_org_id: orgId, pending_org_id: null, role: "cro", org_role: "member" } : { pending_org_id: null };
    const { error } = await sb.from("profiles").update(patch).eq("id", userId);
    if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
    if (action === "approve") {
      await notifyUsers([userId], { kind: "기관", title: `${orgName}에 담당자로 연결되었습니다`, body: "이제 기관에 배포된 요청서를 보고 회신할 수 있습니다.", href: "/cro" }, { to: [target.email] });
      try { await distributeOpenRfqs(orgId, s.userId); } catch (e) { captureError(e, "org-members:distribute"); }
      return NextResponse.json({ ok: true, message: "담당자로 연결했습니다." });
    }
    await notifyUsers([userId], { kind: "기관", title: `${orgName} 합류 신청이 처리되지 않았습니다`, body: "기관 대표 담당자가 연결하지 않았습니다. 소속이 맞다면 기관 담당자에게 확인해 주세요.", href: "/cro" }, { to: [target.email] });
    return NextResponse.json({ ok: true, message: "합류 신청을 거절했습니다." });
  }

  // remove
  if (target.cro_org_id !== orgId) return NextResponse.json({ error: "이 기관의 담당자가 아닙니다." }, { status: 400 });
  if (target.org_role === "owner") return NextResponse.json({ error: "대표 담당자는 내보낼 수 없습니다. 운영자에게 대표 변경을 요청해 주세요." }, { status: 400 });
  const { error } = await sb.from("profiles").update({ cro_org_id: null, pending_org_id: null }).eq("id", userId);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  let rotated = 0;
  const { data: n, error: re } = await sb.rpc("rotate_org_invite_tokens", { p_org: orgId });
  if (re) captureError(re, "org-members:rotate", { org: orgId });
  else rotated = n ?? 0;

  await notifyUsers([userId], { kind: "기관", title: `${orgName} 담당자에서 제외되었습니다`, body: "더 이상 이 기관의 요청서를 볼 수 없습니다. 잘못된 처리라면 기관 대표 담당자에게 확인해 주세요.", href: "/cro" }, { to: [target.email] });
  const { data: rest } = await sb.from("profiles").select("id").eq("cro_org_id", orgId);
  if (rotated) {
    await notifyUsers((rest ?? []).map((m) => m.id), { kind: "시스템", title: `회신 링크가 새로 발급되었습니다 · ${rotated}건`, body: `${target.name || target.email} 담당자를 내보내면서 이전 메일의 회신 링크를 무효화했습니다. 진행 중인 요청은 받은 요청 화면에서 그대로 이어서 작성할 수 있습니다.`, href: "/cro" });
  }
  return NextResponse.json({ ok: true, message: `담당자를 내보냈습니다.${rotated ? ` 열린 회신 링크 ${rotated}건을 새로 발급했습니다.` : ""}` });
}
