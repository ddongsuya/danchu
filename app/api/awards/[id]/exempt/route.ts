import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { addBusinessDays } from "@/lib/dates";
import { EXEMPT_CLAIM_BUSINESS_DAYS } from "@/lib/request-policy";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST { note } — 선정된 기관이 "이 의뢰자는 우리 기존 고객"이라고 신고한다 (성사수수료 면제 요청).
 * 선정일부터 10영업일 안에만 받는다. 확정은 운영자가 한다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("cro");
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (await rateLimited("exempt-claim", s.userId, 10, 3600)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const sb = getSupabaseAdmin()!;
  const { data: a } = await sb.from("rfq_awards").select("id, rfq_id, cro_org_id, cro_name, awarded_at, fee_exempt, fee_exempt_at, existing_client_claim").eq("id", id).maybeSingle();
  if (!a) return NextResponse.json({ error: "수주 기록이 없습니다." }, { status: 404 });
  if (s.profile.role !== "admin" && (!s.profile.cro_org_id || a.cro_org_id !== s.profile.cro_org_id)) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  if (a.fee_exempt_at) return NextResponse.json({ error: "이미 운영자가 판단한 건입니다. 이의가 있으면 단추(hello@danchu.kr)에 알려 주세요." }, { status: 409 });
  const deadline = addBusinessDays(new Date(new Date(a.awarded_at).toLocaleString("en-US", { timeZone: "Asia/Seoul" })), EXEMPT_CLAIM_BUSINESS_DAYS);
  if (new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })) > deadline) return NextResponse.json({ error: `기존 고객 신고는 선정일부터 ${EXEMPT_CLAIM_BUSINESS_DAYS}영업일 안에만 할 수 있습니다.` }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  if (note.length < 5) return NextResponse.json({ error: "근거를 적어 주세요 (마지막 계약 시기, 계약 건명 등)." }, { status: 400 });
  const claim = `기관 신고: ${note}`;
  const { error } = await sb.from("rfq_awards").update({ existing_client_claim: claim, existing_client_claimed_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  const { data: rfq } = await sb.from("rfq_requests").select("rfq_no, company").eq("id", a.rfq_id).maybeSingle();
  await logEvent(a.rfq_id, "exempt_claim", `${a.cro_name} 기존 고객 신고`, note, s.userId);
  await notifyUsers(await adminUserIds(), { kind: "계약", title: `${rfq?.rfq_no} 기존 고객 면제 요청 · ${a.cro_name}`, body: `${rfq?.company} · ${note}\n증빙을 확인하고 수주·계약 화면에서 승인 또는 반려해 주세요.`, href: "/admin/awards" }, { to: adminEmails() });
  return NextResponse.json({ ok: true, message: "신고했습니다. 운영자가 확인 뒤 알려 드립니다. 증빙(계약서 표지, 세금계산서 등)은 hello@danchu.kr 로 보내 주세요." });
}
