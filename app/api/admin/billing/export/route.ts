import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { monthRangeOf } from "@/lib/billing";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET ?month=YYYY-MM — 그 달 전달 기록 CSV (기관 청구서의 원천). 엑셀에서 바로 열리게 BOM 을 붙인다 */
export async function GET(req: Request) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });
  const month = new URL(req.url).searchParams.get("month") || undefined;
  const r = monthRangeOf(month);

  const { data: invites } = await sb
    .from("rfq_invites")
    .select("rfq_no, cro_name, cro_org_id, sent_at, status, source, billable, bill_excluded_reason")
    .gte("sent_at", `${r.from}T00:00:00+09:00`).lt("sent_at", `${r.to}T00:00:00+09:00`)
    .order("cro_name").order("sent_at")
    .limit(5000);
  const orgIds = [...new Set((invites ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x))];
  const { data: orgs } = orgIds.length ? await sb.from("cro_orgs").select("id, per_request_fee").in("id", orgIds) : { data: [] as { id: string; per_request_fee: number | null }[] };
  const fee = new Map((orgs ?? []).map((o) => [o.id, o.per_request_fee]));

  const SOURCE: Record<string, string> = { matched: "매칭", nominated: "지명", manual: "수동" };
  const STATUS: Record<string, string> = { submitted: "제출", declined: "회신 안 함", sent: "미회신", draft: "작성 중", expired: "만료" };
  const head = ["기관", "전달일", "요청 번호", "출처", "회신", "청구 대상", "제외 사유", "약정 단가(원)", "청구액(원)"];
  const lines = [head.join(",")];
  for (const i of invites ?? []) {
    const unit = i.cro_org_id ? fee.get(i.cro_org_id) ?? null : null;
    lines.push([
      i.cro_name,
      new Date(i.sent_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
      i.rfq_no,
      SOURCE[i.source] ?? i.source,
      STATUS[i.status] ?? i.status,
      i.billable ? "Y" : "N",
      i.bill_excluded_reason ?? "",
      unit ?? "",
      i.billable && unit != null ? unit : i.billable ? "" : 0,
    ].map(csvCell).join(","));
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
