import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCroOrg } from "@/lib/data";
import { notifyUsers } from "@/lib/notify";
import { distributeOpenRfqs } from "@/lib/distribute";
import { CATS } from "@/lib/rfq-schema";
import { EMAIL_RE } from "@/lib/auth-links";
import type { TablesUpdate } from "@/lib/db-types";

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

  if (action === "suspend") {
    // 중지된 기관이 토큰 링크로 계속 제출해 비교표에 오르지 않게 열린 초대를 닫는다 (한도에서도 빠진다)
    await sb.from("rfq_invites").update({ status: "expired" }).eq("cro_org_id", id).in("status", ["sent", "draft"]);
  }
  const { data: members } = await sb.from("profiles").select("id, email").eq("cro_org_id", id);
  const ids = (members ?? []).map((x) => x.id as string);
  const mails = [...new Set([...(members ?? []).map((x) => x.email as string), org.contact_email].filter((x): x is string => !!x))];
  await notifyUsers(ids, { kind: "기관", title: m.title, body: m.body, href: "/cro" }, { to: mails });
  // 승인하면 아직 열려 있는 요청서를 이 기관에도 배포한다
  let extra = "";
  if (action === "approve") {
    try {
      const d = await distributeOpenRfqs(id, s.userId);
      if (d.invites) extra = ` 진행 중인 요청 ${d.invites}건을 함께 배포했습니다.`;
    } catch (e) {
      console.error("distribute open rfqs", e);
    }
  }
  return NextResponse.json({ ok: true, message: m.msg + extra });
}

/**
 * PATCH { name?, perRequestFee?, monthlyCap?, contactEmail?, contactPhone?, categories?, autoReply? } — 약정·운영 설정.
 * 전달 1건 = 청구 1건이라 단가·월 한도는 운영자만 적는다. 승인된 기관의 이름도 여기서만 바꾼다.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { id } = await ctx.params;
  const org = await getCroOrg(id);
  if (!org) return NextResponse.json({ error: "기관이 없습니다." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: TablesUpdate<"cro_orgs"> = {};

  if (typeof b.name === "string") {
    const name = b.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "기관명을 입력해 주세요." }, { status: 400 });
    patch.name = name;
  }
  for (const [key, col] of [["perRequestFee", "per_request_fee"], ["monthlyCap", "monthly_cap"]] as const) {
    if (!(key in b)) continue;
    const v = b[key];
    if (v === null || v === "") patch[col] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000_000) patch[col] = v;
    else return NextResponse.json({ error: `${key === "perRequestFee" ? "이용료" : "월 한도"}는 0 이상의 정수여야 합니다.` }, { status: 400 });
  }
  if (typeof b.contactEmail === "string") {
    const e = b.contactEmail.trim().toLowerCase().slice(0, 200);
    if (e && !EMAIL_RE.test(e)) return NextResponse.json({ error: "대표 이메일 형식을 확인해 주세요." }, { status: 400 });
    patch.contact_email = e || null;
  }
  if (typeof b.contactPhone === "string") patch.contact_phone = b.contactPhone.trim().slice(0, 40) || null;
  if (Array.isArray(b.categories)) {
    const cats = (b.categories as unknown[]).filter((x): x is string => typeof x === "string" && (CATS as readonly string[]).includes(x));
    if (!cats.length) return NextResponse.json({ error: "수행 분야를 하나 이상 선택해 주세요." }, { status: 400 });
    patch.categories = cats;
  }
  if (typeof b.autoReply === "boolean") patch.auto_reply = b.autoReply;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "바꿀 내용이 없습니다." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from("cro_orgs").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  let extra = "";
  if (patch.categories && org.status === "approved") {
    try {
      const d = await distributeOpenRfqs(id, s.userId);
      if (d.invites) extra = ` 새로 맞는 요청 ${d.invites}건을 배포했습니다.`;
    } catch (e) {
      console.error("distribute open rfqs", e);
    }
  }
  return NextResponse.json({ ok: true, message: "저장했습니다." + extra });
}
