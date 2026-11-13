import { sessionOrNull } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { comparisonOpened } from "@/lib/reply-window";
import { loadCompare } from "@/lib/compare-data";
import { compareSheets } from "@/lib/compare-xlsx";
import { workbook } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — 비교표 엑셀 내려받기 (비교견적표 · 시험별 상세).
 * 허용: 요청 소유 의뢰자(비교표가 열린 뒤에만) · 운영자. 화면(/app/r/[no]/compare)과 같은 조건이다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return new Response("로그인이 필요해요.", { status: 401 });
  const rfq = await getRfqByNo((await params).no);
  const admin = s.profile.role === "admin";
  if (!rfq || !(admin || (s.profile.role === "requester" && ownsRfq(rfq, s.userId)))) return new Response("요청을 찾지 못했어요.", { status: 404 });
  if (!admin && !comparisonOpened(rfq)) return new Response("비교 보고서가 아직 열리지 않았어요.", { status: 403 });
  const { cols, rows, authorities } = await loadCompare(rfq, await getRfqDetail(rfq));
  if (!cols.length) return new Response("도착한 견적이 없어요.", { status: 404 });
  const bytes = workbook(compareSheets({ no: rfq.rfq_no, substance: rfq.substance, comparedAt: rfq.compared_at, authorities, cols, rows }));
  const name = `비교견적표_${rfq.rfq_no}.xlsx`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="compare_${rfq.rfq_no}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
