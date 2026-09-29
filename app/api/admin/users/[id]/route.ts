import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { distributeOpenRfqs } from "@/lib/distribute";
import { notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * POST { role, croOrgId } — 역할·기관 연결 변경 (본인 역할은 바꿀 수 없다).
 * 어떤 변경이든 합류 신청(pending_org_id)은 지운다: 연결했으면 끝난 것이고, 아니면 거절한 것이다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { role?: unknown; croOrgId?: unknown };
  const role = typeof b.role === "string" && ["requester", "cro", "admin"].includes(b.role) ? b.role : "";
  const croOrgId = typeof b.croOrgId === "string" && /^[0-9a-f-]{36}$/.test(b.croOrgId) ? b.croOrgId : null;
  if (!role) return NextResponse.json({ error: "역할이 올바르지 않습니다." }, { status: 400 });
  if (id === s.userId && role !== "admin") return NextResponse.json({ error: "본인의 운영자 권한은 해제할 수 없습니다." }, { status: 400 });
  const sb = getSupabaseAdmin()!;
  const linkOrg = role === "cro" ? croOrgId : null;
  const { data: before } = await sb.from("profiles").select("cro_org_id, pending_org_id").eq("id", id).maybeSingle();
  const { error } = await sb.from("profiles").update({ role, cro_org_id: linkOrg, pending_org_id: null }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  if (linkOrg && before?.cro_org_id !== linkOrg) {
    const { data: org } = await sb.from("cro_orgs").select("name").eq("id", linkOrg).maybeSingle();
    await notifyUsers([id], { kind: "기관", title: `${org?.name ?? "기관"}에 담당자로 연결되었습니다`, body: "이제 기관에 배포된 요청서를 보고 회신할 수 있습니다.", href: "/cro" });
    // 기관 담당자로 연결하면 그 기관이 받을 요청을 바로 채운다
    try {
      await distributeOpenRfqs(linkOrg, s.userId);
    } catch (e) {
      console.error("sync invites", e);
    }
  } else if (!linkOrg && before?.pending_org_id) {
    await notifyUsers([id], { kind: "기관", title: "기관 합류 신청이 처리되지 않았습니다", body: "신청한 기관에 연결되지 않았습니다. 문의는 hello@danchu.kr로 보내주세요.", href: "/cro" });
  }
  return NextResponse.json({ ok: true });
}
