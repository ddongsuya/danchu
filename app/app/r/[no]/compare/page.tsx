import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { glpCoverage } from "@/lib/quote-items";
import { designSummary, explainOf } from "@/lib/catalog";
import { Crumb } from "@/components/app/ui";
import { CompareBoard, type CompareCol } from "@/components/CompareBoard";
import { md } from "@/lib/format";
import { comparisonOpened, pendingInvites, repliesClosed } from "@/lib/reply-window";
import { occupiesSeat } from "@/lib/request-policy";
import { captureError } from "@/lib/observe";
import { hasSchedule } from "@/lib/quote-schedule";

export const dynamic = "force-dynamic";

export default async function Compare({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  // 비교표 공개 전 (2026-10-20 결정 1): 의뢰자에게는 진행 숫자만 보인다. 기관명·금액·견적은 열릴 때 함께 공개한다
  const open = !repliesClosed(rfq);
  // 참여한 기관 중 아직 제출하지 않은 곳만 센다 (0023). 참여 결정 전 안내는 의뢰자에게 보이지 않는다
  const pending = pendingInvites(d.invites);
  if (!comparisonOpened(rfq) && s.profile.role !== "admin") {
    const joined = d.invites.filter((i) => occupiesSeat(i)).length;
    const submittedCount = d.invites.filter((i) => occupiesSeat(i) && i.status === "submitted").length;
    const ended = ["closed", "cancelled"].includes(rfq.status);
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
        <div className="ph">
          <div>
            <h1>견적 비교</h1>
            <p>{rfq.substance}</p>
          </div>
        </div>
        <dl className="compare-status" aria-label="회신 현황">
          <div><dt>참여</dt><dd className="tnum">{joined}곳</dd></div>
          <div><dt>제출</dt><dd className="tnum">{submittedCount}곳</dd></div>
          <div><dt>회신 기한</dt><dd className="tnum">{rfq.reply_by ? md(rfq.reply_by) : "미정"}</dd></div>
        </dl>
        <div className="empty">
          <b>{ended ? "비교표가 열리기 전에 마무리한 요청입니다" : "비교표가 아직 열리지 않았습니다"}</b>
          {ended
            ? "비교표가 열리지 않아 기관 이름과 견적은 공개되지 않습니다."
            : `비교표는 ${rfq.reply_by ? `회신 기한(${md(rfq.reply_by)}) 다음 날 오전 9시에 열리고, ` : ""}참여 결정이 끝난 뒤 참여한 기관이 모두 제출하면 더 빨리 열립니다. 열리면 기관 이름과 견적을 함께 보여 드리고 알림으로 알려 드립니다.`}
          <div style={{ marginTop: 14 }}>
            <Link href={`/app/r/${rfq.rfq_no}`} className="b2">요청 상세로 돌아가기</Link>
          </div>
        </div>
      </>
    );
  }

  // 의뢰자 본인이 열린 비교표를 연 기록 (0028). 운영자가 연 것은 세지 않는다. 기록이 실패해도 화면은 그대로 보여 준다
  if (s.profile.role !== "admin") {
    const rfqId = rfq.id;
    after(async () => {
      const { error } = await getSupabaseAdmin()!.rpc("record_compare_view", { p_rfq: rfqId });
      if (error) captureError(error, "compare.record_view", { rfq: rfq.rfq_no });
    });
  }

  // 금액 오름차순, 같으면 기관명 순. 정렬이 없으면 새로 고칠 때마다 열 순서가 바뀐다
  const quotes = d.quotes.filter((q) => q.status === "submitted").sort((a, b) => (a.total_amount ?? 0) - (b.total_amount ?? 0) || a.cro_name.localeCompare(b.cro_name, "ko"));
  const orgIds = quotes.map((q) => q.cro_org_id).filter((x): x is string => !!x);
  const sb = getSupabaseAdmin()!;
  const { data: orgs } = orgIds.length ? await sb.from("cro_orgs").select("id, glp_certs, aaalac").in("id", orgIds) : { data: [] };
  const certsOf = new Map((orgs ?? []).map((o) => [o.id as string, (o.glp_certs ?? []) as string[]]));
  const authorities = Array.isArray(rfq.payload.authority) ? (rfq.payload.authority as string[]) : [];
  // 행은 첫 견적이 아니라 모든 견적의 항목 합집합 (어느 기관이 항목을 빠뜨려도 행이 사라지지 않게)
  const rowMap = new Map<number, { seq: number; name: string; category: string }>();
  for (const q of quotes) for (const it of q.cro_quote_items ?? []) if (!rowMap.has(it.seq)) rowMap.set(it.seq, { seq: it.seq, name: it.name, category: it.category });
  const rows = [...rowMap.values()].sort((a, b) => a.seq - b.seq);

  const cols: CompareCol[] = quotes.map((q) => {
    const cov = glpCoverage(authorities, certsOf.get(q.cro_org_id ?? "") ?? []);
    const items = q.cro_quote_items ?? [];
    const unavailable = items.filter((i) => i.avail === "불가").map((i) => i.name);
    return {
      id: q.id,
      name: q.cro_name,
      total: q.total_amount ?? 0,
      weeks: q.total_weeks ?? 0,
      final: hasSchedule(q) ? q.final_weeks : null,
      finalReport: hasSchedule(q) ? (q.final_report_weeks ?? q.final_weeks) : null,
      start: q.start_date,
      valid: q.valid_until,
      pay: q.pay_terms,
      includes: q.includes ?? [],
      note: q.note,
      glpOk: cov.ok,
      glpMissing: cov.missing,
      glp: certsOf.get(q.cro_org_id ?? "") ?? [],
      unavailable,
      conditional: items.filter((i) => i.avail === "조건부 가능").length,
      items: items.map((i) => ({ seq: i.seq, avail: i.avail ?? "", amount: i.amount, weeks: i.weeks, design: designOf(i.design), note: [i.reason, i.design && typeof i.design.note === "string" ? i.design.note : ""].filter(Boolean).join(" · ") || undefined, explain: explainOf(rows.find((r) => r.seq === i.seq)?.category ?? "", i.design?.extra) })),
      hasPdf: !!q.pdf_path,
      selected: rfq.selected_quote_id === q.id,
      auto: !!q.auto,
      operator: q.entry_source === "operator",
    };
  });

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
      <div className="ph">
        <div>
          <h1>견적 비교</h1>
          <p>
            {rfq.substance} · 금액은 VAT 별도{authorities.length ? ` · 제출처 ${authorities.join(", ")}` : ""}
          </p>
        </div>
      </div>
      {/* 회신이 마감되면 "아직 제출하지 않은 기관"은 의미가 없어 칸을 뺀다 (값 자리에 "마감"이 들어가던 문제) */}
      <dl className={`compare-status${open ? "" : " compare-status--2"}`} aria-label="회신 현황">
        <div><dt>도착한 견적</dt><dd className="tnum">{quotes.length}건</dd></div>
        {open && <div><dt>참여했지만 아직 제출하지 않은 기관</dt><dd className="tnum">{pending}곳</dd></div>}
        <div><dt>회신 기한</dt><dd className="tnum">{rfq.reply_by ? md(rfq.reply_by) : "미정"}{!open ? " · 마감" : ""}</dd></div>
      </dl>
      {rfq.selected_quote_id ? null : comparisonOpened(rfq) ? (
        <p className="note" style={{ marginBottom: 16 }}>비교표가 열려 회신이 마감되었습니다. 견적은 더 바뀌지 않습니다. 비교한 뒤 진행할 기관을 선택해 주세요.</p>
      ) : (
        <p className="note note--warn" style={{ marginBottom: 16 }}>운영자 보기입니다. 비교표가 열리기 전이라 의뢰자에게는 이 표가 보이지 않고, 기관은 아직 견적을 고칠 수 있습니다.</p>
      )}
      {cols.length === 0 ? (
        <div className="empty">
          <b>아직 도착한 견적이 없습니다</b>
          제출한 기관이 없어 비교할 견적이 없습니다. 운영자가 기한 연장이나 참여 안내 추가를 안내합니다.
        </div>
      ) : (
        <CompareBoard no={rfq.rfq_no} cols={cols} rows={rows} canSelect={comparisonOpened(rfq) && !rfq.selected_quote_id && !["closed", "cancelled"].includes(rfq.status)} />
      )}
    </>
  );
}

/** 저장된 설계 jsonb → 한 줄 요약 */
function designOf(d: Record<string, unknown> | null | undefined): string | undefined {
  if (!d || typeof d !== "object") return undefined;
  const n = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
  const s = designSummary({
    species: Array.isArray(d.species) ? (d.species as string[]) : [],
    groups_ctrl: n("groups_ctrl"), groups_test: n("groups_test"), per_sex: n("per_sex"),
    recovery_weeks: n("recovery_weeks"), recovery_per_sex: n("recovery_per_sex"),
    route: typeof d.route === "string" ? d.route : null, dosing: typeof d.dosing === "string" ? d.dosing : null,
    method: typeof d.method === "string" ? d.method : null,
  });
  return s || undefined;
}
