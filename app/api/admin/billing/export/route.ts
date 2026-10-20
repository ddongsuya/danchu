import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { joinStatusNote, monthRangeOf, TIER_LABEL } from "@/lib/billing";
import type { BillingAwardRow, BillingLineRow, BillingSnapshot, BillingSummaryRow } from "@/lib/db-types";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const seoulDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "");
/** 미정은 빈칸이 아니라 "미정"으로 적는다 (0 으로 읽히지 않게) */
const amountOrPending = (v: number | null | undefined) => (v == null ? "미정" : v);

/**
 * GET ?month=YYYY-MM: 그 달 청구 명세 CSV (0020 기준). 엑셀에서 바로 열리게 BOM 을 붙인다.
 * 한 행이 청구 항목 하나다. 구분: 견적 회신(처음 제출한 달, 금액 없이 제출했으면 금액이 들어온 달) · 월 구독료 · 성사수수료 정산(체결 확인한 달) · 성사수수료 예상(선정한 달, 합계 미포함)
 * 마감한 달은 마감 때 저장한 명세를 쓴다.
 */
export async function GET(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });
  const month = new URL(req.url).searchParams.get("month") || undefined;
  const r = monthRangeOf(month);

  const { data: period } = await sb.from("billing_periods").select("snapshot").eq("month", r.from).maybeSingle();
  let view = (period?.snapshot ?? null) as BillingSnapshot | null;
  if (!view) {
    const [{ data: summary, error }, { data: lines }, { data: awards }] = await Promise.all([
      sb.rpc("billing_summary", { p_from: r.from, p_to: r.to }),
      sb.rpc("billing_lines", { p_from: r.from, p_to: r.to }),
      sb.rpc("billing_awards", { p_from: r.from, p_to: r.to }),
    ]);
    if (error) return NextResponse.json({ error: "집계 함수를 불러오지 못했습니다. 0020 마이그레이션이 적용됐는지 확인해 주세요." }, { status: 500 });
    view = { taken_at: new Date().toISOString(), summary: (summary ?? []) as BillingSummaryRow[], lines: (lines ?? []) as BillingLineRow[], awards: (awards ?? []) as BillingAwardRow[] };
  }

  const SOURCE: Record<string, string> = { matched: "매칭", nominated: "지명", manual: "수동" };
  const head = ["구분", "기관", "일자", "요청 번호", "견적 금액(원)", "계약 금액(원)", "구간", "청구 대상", "제외 사유", "입력 주체", "단가(원) 또는 요율", "청구액(원)", "비고"];
  const lines = [head.join(",")];
  const push = (cells: unknown[]) => lines.push(cells.map(csvCell).join(","));

  for (const l of view.lines) {
    const billedAt = l.billing_at ?? l.first_submitted_at;
    const lateAmount = !!l.billing_at && seoulDay(l.billing_at).slice(0, 7) !== seoulDay(l.first_submitted_at).slice(0, 7);
    const note = [SOURCE[l.invite_source] ? `전달 ${SOURCE[l.invite_source]}` : "", l.auto ? "예비 견적(자동 회신)" : "", l.tier === "no_amount" ? "금액 미입력, 청구하지 않음" : "", lateAmount ? `처음 제출 ${seoulDay(l.first_submitted_at)}, 금액 입력한 달에 청구` : "", joinStatusNote(l.join_status)].filter(Boolean).join(" · ");
    push([
      "견적 회신",
      l.org_name,
      seoulDay(billedAt),
      l.rfq_no,
      l.total_amount ?? "",
      "",
      TIER_LABEL[l.tier] ?? l.tier,
      // 0023: 참여 기록이 없거나 참여 기능 전(legacy) 견적은 청구 대상이 아니다. 0023 전 저장본(join_status 없음)은 예전 기준
      l.billable && l.tier !== "no_amount" && (l.join_status ?? "joined") === "joined" ? "Y" : "N",
      l.bill_excluded_reason ?? "",
      l.entry_source === "operator" ? "운영자 대리 입력" : "기관",
      l.chargeable ? amountOrPending(l.per_request_fee) : "",
      l.chargeable ? amountOrPending(l.fee_due) : 0,
      note,
    ]);
  }
  for (const o of view.summary) {
    if (o.monthly_fee == null) continue;
    push(["월 구독료", o.org_name, r.from, "", "", "", "", "Y", "", "", o.monthly_fee, o.monthly_fee, `1,000만 원 미만 견적 ${o.subscription}건 포함`]);
  }
  for (const a of view.awards) {
    const rate = a.fee_rate != null ? `${Math.round(a.fee_rate * 10000) / 100}%` : "미정";
    if (a.kind === "settlement") {
      // 0023: 참여 기록이 없는 초대의 수주는 명세 합계에 넣지 않는다 (billing_summary). 행은 남기고 N 으로 표시
      const joined = a.invite_joined !== false;
      push(["성사수수료 정산", a.org_name, seoulDay(a.contract_reported_at), a.rfq_no, a.quote_amount, a.contract_amount ?? "", "계약 기준", joined ? "Y" : "N", "", "", rate, joined ? amountOrPending(a.fee) : 0, [`체결일 ${a.contract_date ?? "-"} · 체결 확인한 달에 정산`, a.invite_billable === false ? "견적 청구 제외한 초대" : "", joined ? "" : "참여 기록 없음, 청구하지 않음"].filter(Boolean).join(" · ")]);
    } else {
      push(["성사수수료 예상", a.org_name, seoulDay(a.awarded_at), a.rfq_no, a.quote_amount, a.contract_amount ?? "", "견적 기준", "N", "", "", rate, "", `안내용, 합계에 넣지 않음 · 예상 ${a.fee == null ? "미정" : a.fee}원`]);
    }
  }
  const body = "﻿" + lines.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="danchu-billing-${r.from.slice(0, 7)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
