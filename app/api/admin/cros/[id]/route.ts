import { NextResponse } from "next/server";
import { captureError } from "@/lib/observe";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCroOrg } from "@/lib/data";
import { notifyUsers } from "@/lib/notify";
import { distributeOpenRfqs } from "@/lib/distribute";
import { CATS } from "@/lib/rfq-schema";
import { EMAIL_RE } from "@/lib/auth-links";
import type { TablesUpdate } from "@/lib/db-types";
import { audit, diffFields } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST { action: 'approve'|'reject'|'suspend'|'optout', reason? } — CRO 기관 승인 처리.
 * optout: 운영자 관리 기관이 "수신 거부"로 회신했을 때. 중지와 같이 배포를 멈추고 열린 초대를 닫되, 참여한 적 없는 기관이라 중지 안내 메일은 보내지 않는다
 */
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
    approve: { status: "approved", title: `${org.name} 참여가 승인되었습니다`, body: "이제 수행 분야에 맞는 견적 요청의 참여 안내가 갑니다. 요약을 보고 참여하면 요청서 전체가 열립니다. 기관 탭에서 GLP 인증과 수행 분야를 확인해 두세요.", msg: "승인했습니다." },
    reject: { status: "rejected", title: `${org.name} 가입 신청이 반려되었습니다`, body: reason || "자세한 사유는 hello@danchu.kr로 문의해 주세요.", msg: "반려했습니다." },
    suspend: { status: "suspended", title: `${org.name} 참여가 일시 중지되었습니다`, body: reason || "문의는 hello@danchu.kr로 보내주세요.", msg: "중지했습니다." },
    optout: { status: "suspended", title: "", body: "", msg: "수신 거부로 처리했습니다. 이 기관에는 더 이상 요청서가 가지 않습니다." },
  };
  const m = map[action];
  if (!m) return NextResponse.json({ error: "알 수 없는 동작" }, { status: 400 });
  if (action === "optout" && !org.managed) return NextResponse.json({ error: "수신 거부는 운영자 관리 기관에만 씁니다. 참여 기관은 중지로 처리해 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { error } = await sb.from("cro_orgs").update({ status: m.status, approved_at: action === "approve" ? new Date().toISOString() : org.approved_at }).eq("id", id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  const note = action === "optout" ? ["기관이 수신 거부", reason].filter(Boolean).join(" · ") : reason || undefined;
  await audit({ userId: s.userId, email: s.email }, `org.${action}` as "org.approve" | "org.reject" | "org.suspend" | "org.optout", { type: "cro_org", id, label: org.name }, { before: { status: org.status }, after: { status: m.status }, note });

  if (action === "suspend" || action === "optout") {
    // 중지된 기관이 토큰 링크로 계속 제출해 비교표에 오르지 않게 열린 초대를 닫는다 (한도에서도 빠진다).
    // 위 상태 변경에서 DB 트리거가 이 기관의 회신 링크를 제출 건까지 모두 새로 발급했다 (0021). 다시 승인해도 옛 링크는 살아나지 않는다
    // 실패해도 저장(save_quote)은 org_inactive 로 막히지만, 열린 초대가 남은 것을 알 수 있게 오류를 남긴다
    const { error: expireError } = await sb.from("rfq_invites").update({ status: "expired" }).eq("cro_org_id", id).in("status", ["sent", "draft"]);
    if (expireError) captureError(expireError, "org-suspend:expire-invites", { org: id });
  }
  // 운영자 관리 기관은 참여 계약을 맺은 적이 없다. 승인·중지 안내 메일을 보내지 않는다 (수신 거부한 기관에는 더더욱).
  // 자동 배포 대상도 아니라 승인(수신 재개) 뒤 보충 배포도 하지 않는다
  if (org.managed) return NextResponse.json({ ok: true, message: action === "approve" ? "수신을 다시 열었습니다. 요청 화면의 배포 패널에서 골라 보낼 수 있습니다." : m.msg });
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
 * PATCH { name?, perRequestFee?, feeRate?, monthlyFee?, monthlyFeeFrom?, contactEmail?, contactPhone?, categories?, autoReply? } — 약정·운영 설정.
 * monthlyFeeFrom 은 구독 시작 월 'YYYY-MM' (비우면 구독료를 처음 저장한 달. 구독료를 지우면 함께 지워진다, 0020 트리거).
 * 청구 기준(0020): 1,000만 원 미만 견적은 월 구독료(monthlyFee), 1,000만 원 이상은 건당 이용료(perRequestFee),
 * 5,000만 원 이상이 체결되면 성사수수료(feeRate). 약정 값은 서면 합의 뒤 운영자만 적는다. 승인된 기관의 이름도 여기서만 바꾼다.
 * 월 전달 한도는 없앴다. 예전 화면이 monthlyCap 을 보내도 저장하지 않는다.
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
  for (const [key, col, label] of [["perRequestFee", "per_request_fee", "건당 이용료"], ["monthlyFee", "monthly_fee", "월 구독료"]] as const) {
    if (!(key in b)) continue;
    const v = b[key];
    if (v === null || v === "") patch[col] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000_000) patch[col] = v;
    else return NextResponse.json({ error: `${label}는 0 이상 1억 원 이하의 정수(원)로 적어 주세요.` }, { status: 400 });
  }
  if ("monthlyFeeFrom" in b) {
    const v = b.monthlyFeeFrom;
    if (v === null || v === "") patch.monthly_fee_from = null;
    else if (typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) patch.monthly_fee_from = `${v}-01`;
    else return NextResponse.json({ error: "구독 시작 월은 YYYY-MM 형식으로 적어 주세요." }, { status: 400 });
  }
  if ("feeRate" in b) {
    const v = b.feeRate;
    if (v === null || v === "") patch.fee_rate = null;
    else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1) patch.fee_rate = Math.round(v * 10000) / 10000;
    else return NextResponse.json({ error: "성사수수료율은 0~100% 사이여야 합니다." }, { status: 400 });
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
  if (error?.code === "23505") return NextResponse.json({ error: "같은 기관명 또는 사업자등록번호의 기관이 이미 있습니다." }, { status: 409 });
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  const d = diffFields(org as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  if (Object.keys(d.after).length) await audit({ userId: s.userId, email: s.email }, "org.terms", { type: "cro_org", id, label: org.name }, d);

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
