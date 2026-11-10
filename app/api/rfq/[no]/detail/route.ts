import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { logEvent, notifyUsers } from "@/lib/notify";
import { inviteMailTo, inviteReplyTo, orgMailTargets } from "@/lib/distribute";
import { replyPath } from "@/lib/concierge";
import { DETAIL_REQUEST_ERRORS, sendDetailRequest } from "@/lib/rpc";
import { cleanDetail, detailLines, MAX_DETAIL_TARGETS, PRIVATE_KEYS } from "@/lib/detail-quote";
import type { Values } from "@/lib/rfq-schema";
import { md } from "@/lib/format";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST { quoteIds, detail, replyBy, note } — 의뢰자가 1차 견적을 낸 기관 1~3곳에 상세 조건을 보낸다 (0042).
 * 비교 보고서가 열린 뒤, 선정 전에만. 요청마다 한 번. 받는 기관에만 알리고, 다른 기관에는 알리지 않는다.
 * 예산은 기관에 보내지 않고 요청의 예산 칸에만 남긴다 (요청서와 같은 규칙).
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없어요." }, { status: 404 });
  if (await rateLimited("detail-request", s.userId, 10, 600)) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { quoteIds?: unknown; detail?: unknown; replyBy?: unknown; note?: unknown };
  const quoteIds = Array.isArray(b.quoteIds) ? [...new Set(b.quoteIds.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)))] : [];
  if (quoteIds.length < 1 || quoteIds.length > MAX_DETAIL_TARGETS) return NextResponse.json({ error: DETAIL_REQUEST_ERRORS.bad_targets.message }, { status: 400 });
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!replyBy) return NextResponse.json({ error: DETAIL_REQUEST_ERRORS.bad_date.message }, { status: 400 });
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "";
  const payload = rfq.payload as Values;
  const all = cleanDetail(b.detail, payload, rfq.categories ?? []);
  const budget = typeof all.budget === "string" ? all.budget : "";
  const detail: Values = Object.fromEntries(Object.entries(all).filter(([k]) => !PRIVATE_KEYS.includes(k)));

  const res = await sendDetailRequest(rfq.id, s.userId, quoteIds, detail, replyBy, note);
  if (!res.ok) {
    const e = DETAIL_REQUEST_ERRORS[res.code];
    return NextResponse.json({ error: e?.message ?? "상세 견적 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.", code: res.code }, { status: e?.status ?? 500 });
  }

  const sb = getSupabaseAdmin()!;
  if (budget) await sb.from("rfq_requests").update({ budget }).eq("id", rfq.id);
  const { changed, added } = detailLines(detail, payload, rfq.categories ?? [], { forCro: true });
  await logEvent(rfq.id, "detail", `상세 견적 요청 ${res.targets}곳`, `바뀐 조건 ${changed.length}개 · 새 조건 ${added.length}개 · 회신 기한 ${md(replyBy)}`, s.userId);

  // 받는 기관마다 따로 알린다 (다른 기관 주소가 함께 보이지 않게). 계정 없는 기관은 로그인 없는 링크로
  const { data: targets } = await sb.from("rfq_detail_targets").select("invite_id, cro_org_id").eq("rfq_id", rfq.id);
  const { data: invites } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email").in("id", (targets ?? []).map((t) => t.invite_id));
  const mail = await orgMailTargets(sb, (invites ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x));
  for (const i of invites ?? []) {
    const t = i.cro_org_id ? mail.get(i.cro_org_id) : undefined;
    const members = t?.members ?? [];
    const managed = !!t?.managed;
    await notifyUsers(
      members.map((m) => m.id),
      {
        kind: "견적",
        title: `상세 견적 요청 · ${rfq.rfq_no} ${rfq.substance}`,
        body: `의뢰자가 1차 견적을 본 뒤 상세 조건을 보냈어요. 바뀐 조건 ${changed.length}개, 새 조건 ${added.length}개. ${md(replyBy)}까지 1차 견적을 고쳐 한 번 회신할 수 있어요.`,
        href: `${replyPath(i, { managed, members: members.length })}/detail`,
      },
      { to: inviteMailTo(i, t), replyTo: inviteReplyTo({ managed }) },
    ).catch((e) => console.error("detail notify", e));
  }
  return NextResponse.json({ ok: true, targets: res.targets });
}
