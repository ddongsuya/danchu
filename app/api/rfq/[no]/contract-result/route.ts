import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { won } from "@/lib/format";
import { rateLimited, TOO_MANY } from "@/lib/rate-limit";
import { SPONSOR_REPORT_ERRORS, sponsorReportContract } from "@/lib/rpc";
import { contractSignals, isSponsorStatus, SPONSOR_STATUS_LABEL } from "@/lib/contract-gap";

export const runtime = "nodejs";

/**
 * POST { status: 'signed'|'negotiating'|'not_signed', amount?, date?, note? }
 * 의뢰자가 선정한 기관과의 계약 결과를 알린다 (0034, 2026-11-03 대표 요구 3: 우회 계약 방지).
 * 기관 보고와 따로 남기고, 서로 다르면 운영자 화면 "확인할 신호"에 뜬다. 계약 확정 뒤에는 바꾸지 않는다.
 * 의뢰자가 계약했다고 알렸는데 기관 보고가 없으면 기관에 보고를 요청한다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (await rateLimited("contract-result:user", s.userId, 20, 10 * 60)) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !ownsRfq(rfq, s.userId)) return NextResponse.json({ error: "요청을 찾을 수 없어요." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = isSponsorStatus(b.status) ? b.status : null;
  if (!status) return NextResponse.json({ error: SPONSOR_REPORT_ERRORS.status.message }, { status: 400 });
  const amount = status === "signed" && typeof b.amount === "string" && /^\d{1,13}$/.test(b.amount) ? Number(b.amount) : null;
  const date = status === "signed" && typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > 500) return NextResponse.json({ error: SPONSOR_REPORT_ERRORS.note.message }, { status: 400 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "지금은 처리할 수 없어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  const { data: award } = await sb.from("rfq_awards").select("id, cro_org_id, cro_name, contract_status, contract_reported_at, contract_amount, contract_confirmed_at, contract_gap_reason, awarded_at").eq("rfq_id", rfq.id).maybeSingle();
  if (!award) return NextResponse.json({ error: SPONSOR_REPORT_ERRORS.not_found.message }, { status: 404 });

  const r = await sponsorReportContract(award.id, s.userId, status, amount, date, note);
  if (!r.ok) {
    const e = SPONSOR_REPORT_ERRORS[r.code];
    return NextResponse.json({ error: e?.message ?? "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: e?.status ?? 500 });
  }

  const detail = [SPONSOR_STATUS_LABEL[status], amount ? won(amount) : "", date ? `계약일 ${date}` : "", note].filter(Boolean).join(" · ");
  await logEvent(rfq.id, "sponsor_contract", "의뢰자가 계약 결과를 알림", detail, s.userId, { status });

  // 기관 보고와 비교한 신호. 하나라도 있으면 운영자에게 바로 알린다 (정산에 걸린 일)
  const signals = contractSignals(
    {
      quoteAmount: r.quote_amount,
      contractAmount: award.contract_amount,
      contractStatus: award.contract_status,
      contractReportedAt: award.contract_reported_at,
      contractConfirmedAt: award.contract_confirmed_at,
      gapReason: award.contract_gap_reason ?? null,
      sponsorStatus: status,
      sponsorAmount: amount,
      awardedAt: award.awarded_at,
    },
    won,
  ).filter((x) => x.kind !== "low_amount");
  if (signals.length || status === "not_signed") {
    await notifyUsers(
      await adminUserIds(),
      { kind: "계약", title: `${rfq.rfq_no} 의뢰자 계약 결과 · ${award.cro_name}`, body: `의뢰자: ${detail}${signals.length ? `\n${signals.map((x) => x.label).join("\n")}` : ""}\n수주·계약 화면에서 확인해 주세요.`, href: "/admin/awards" },
      { to: adminEmails() },
    );
  }

  // 의뢰자는 계약했다는데 기관 보고가 없으면 기관에 보고를 요청한다 (금액은 알리지 않는다)
  if (status === "signed" && !award.contract_reported_at && award.cro_org_id && r.before !== "signed") {
    const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", award.cro_org_id);
    const ids = (ms ?? []).map((m) => m.id);
    if (ids.length) await notifyUsers(ids, { kind: "계약", title: `${rfq.rfq_no} 계약 체결을 보고해 주세요`, body: "의뢰자가 계약했다고 알려 왔어요. 수주 화면에서 체결일과 계약금액을 보고해 주세요.", href: "/cro/awards" });
  }
  return NextResponse.json({ ok: true });
}
