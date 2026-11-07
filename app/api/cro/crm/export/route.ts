import { sessionOrNull } from "@/lib/auth";
import { loadCrm } from "@/lib/crm";
import { DEAL_KIND, SOURCE_LABEL, STAGE_LABEL, STATUS_LABEL, type Stage, type Status } from "@/lib/crm-deals";
import { personLabel, ymdKst } from "@/lib/crm-shape";
import { workbook, type Cell } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 안건·고객사·담당자 엑셀 (보고서 화면의 "엑셀로 내보내기"). ?from=YYYY-MM-DD&to= 가 있으면 그 기간에 생기거나 끝난 안건만 */
export async function GET(req: Request) {
  const s = await sessionOrNull("cro");
  const orgId = s?.org?.status === "approved" ? s.profile.cro_org_id : null;
  if (!s || !orgId) return new Response("권한이 없어요.", { status: 403 });
  const u = new URL(req.url);
  const from = u.searchParams.get("from") ?? "";
  const to = u.searchParams.get("to") ?? "";
  const ok = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const d = await loadCrm(orgId);
  const co = new Map(d.companies.map((c) => [c.id, c.name]));
  const ct = new Map(d.contacts.map((c) => [c.id, personLabel(c.name, c.title)]));
  const mem = new Map(d.members.map((m) => [m.id, m.name]));
  const inR = (iso: string | null) => !!iso && (!ok(from) || ymdKst(iso) >= from) && (!ok(to) || ymdKst(iso) <= to);
  const deals = d.deals.filter((x) => (!ok(from) && !ok(to)) || inR(x.created_at) || inR(x.closed_at));
  const h = (v: string): Cell => ({ v, bold: true });
  const n = (v: number | null): Cell => (v == null ? null : { v, num: true });
  const sheets = [
    {
      name: "안건",
      widths: [36, 20, 18, 10, 8, 8, 14, 14, 14, 12, 12, 12, 10, 14, 30],
      rows: [
        ["안건", "고객사", "담당자", "단계", "상태", "갈래", "금액", "계약 금액", "실패 사유", "문의일", "끝난 날", "예상 계약", "출처", "단추 요청", "메모"].map(h),
        ...deals.map((x) => [
          x.title, x.company_id ? co.get(x.company_id) ?? "" : "", x.contact_ids.map((id) => ct.get(id) ?? "").filter(Boolean).join(", "), STAGE_LABEL[x.stage as Stage] ?? x.stage, STATUS_LABEL[x.status as Status] ?? x.status,
          DEAL_KIND[x.kind] ?? "", n(x.amount), n(x.won_amount), x.lost_reason, ymdKst(x.created_at), x.closed_at ? ymdKst(x.closed_at) : "", x.expected_on ?? "", SOURCE_LABEL[x.source] ?? x.source, x.rfq_no, x.memo,
        ] as Cell[]),
      ],
    },
    {
      name: "고객사",
      widths: [24, 16, 14, 24, 12, 30],
      rows: [["고객사", "사업자번호", "업종", "다른 표기", "담당 영업", "메모"].map(h), ...d.companies.map((c) => [c.name, c.biz_no, c.industry, c.aliases.join(", "), c.owner ? mem.get(c.owner) ?? "" : "", c.memo] as Cell[])],
    },
    {
      name: "담당자",
      widths: [20, 14, 14, 12, 26, 16],
      rows: [["고객사", "이름", "부서", "직책", "메일", "전화"].map(h), ...d.contacts.map((c) => [co.get(c.company_id) ?? "", c.name, c.dept, c.title, c.email, c.phone || c.mobile] as Cell[])],
    },
  ];
  const bytes = workbook(sheets);
  const name = `단추CRM_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="danchu_crm.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
