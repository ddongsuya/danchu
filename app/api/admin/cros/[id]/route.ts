import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCroOrg } from "@/lib/data";
import { notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";

/** POST { action: 'approve'|'reject'|'suspend', reason? } — CRO 기관 승인 처리 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  const org = await getCroOrg(id);
  if (!org) return NextResponse.json({ error: "기관이 없습니다." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  const action = typeof b.action === "string" ? b.action : "";
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  const map: Record<string, { status: string; title: string; body: string; msg: string }> = {
    approve: { status: "approved", title: `${org.name} 참여가 승인되었습니다`, body: "이제 수행 분야에 맞는 견적 요청서가 배포됩니다. 기관 탭에서 GLP 인증과 수행 분야를 확인해 두세요.", msg: "승인했습니다." },
    reject: { status: "rejected", title: `${org.name} 가입 신청이 반려되었습니다`, body: reason || "자세한 사유는 hello@danchu.kr로 문의해 주세요.", msg: "반려했습니다." },
    suspend: { status: "suspended", title: `${org.name} 참여가 일시 중지되었습니다`, body: reason || "문의는 hello@danchu.kr로 보내주세요.", msg: "중지했습니다." },
  };
  const m = map[action];
  if (!m) return NextResponse.json({ error: "알 수 없는 동작" }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from("cro_orgs").update({ status: m.status, approved_at: action === "approve" ? new Date().toISOString() : org.approved_at }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  const { data: members } = await sb.from("profiles").select("id, email").eq("cro_org_id", id);
  const ids = (members ?? []).map((x) => x.id as string);
  const mails = [...new Set([...(members ?? []).map((x) => x.email as string), org.contact_email].filter((x): x is string => !!x))];
  await notifyUsers(ids, { kind: "기관", title: m.title, body: m.body, href: "/cro" }, { to: mails });
  return NextResponse.json({ ok: true, message: m.msg });
}
