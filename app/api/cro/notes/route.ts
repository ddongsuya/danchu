import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listAwardsForOrg } from "@/lib/data";
import { clientKeyOf } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 고객 메모 (0038). 이 기관을 선정한 의뢰자에게만 남길 수 있다.
 * POST { clientKey, body, remindOn? } → 메모 저장. remindOn(YYYY-MM-DD)이 오면 그날 매일 작업이 작성자에게 알린다
 * DELETE { id } → 이 기관의 메모 삭제
 */
async function ctx() {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  const sb = getSupabaseAdmin();
  return { s, orgId, sb };
}

export async function POST(req: Request) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았어요." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientKey = typeof b.clientKey === "string" ? b.clientKey.slice(0, 240) : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 2000) : "";
  const remindOn = typeof b.remindOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.remindOn) ? b.remindOn : null;
  if (!body) return NextResponse.json({ error: "메모 내용을 적어 주세요." }, { status: 400 });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  if (remindOn && remindOn < today) return NextResponse.json({ error: "알림 날짜는 오늘 이후로 골라 주세요." }, { status: 400 });
  const awards = await listAwardsForOrg(orgId);
  if (!awards.some((a) => clientKeyOf(a.rfq) === clientKey)) return NextResponse.json({ error: "이 기관을 선정한 의뢰자에게만 메모를 남길 수 있어요." }, { status: 404 });
  const { data, error } = await sb.from("cro_client_notes").insert({ org_id: orgId, client_key: clientKey, body, remind_on: remindOn, created_by: s.userId }).select("id").single();
  if (error || !data) {
    console.error("client note insert", error);
    return NextResponse.json({ error: "메모를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: Request) {
  const { s, orgId, sb } = await ctx();
  if (!s || !orgId) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  if (!sb) return NextResponse.json({ error: "저장소가 설정되지 않았어요." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" && /^[0-9a-f-]{36}$/.test(b.id) ? b.id : "";
  if (!id) return NextResponse.json({ error: "지울 메모를 찾지 못했어요." }, { status: 400 });
  const { error } = await sb.from("cro_client_notes").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: "메모를 지우지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
