import { sessionOrNull } from "@/lib/auth";
import { loadDoc, loadStyle } from "@/lib/quote-doc-db";
import { docSheets } from "@/lib/quote-doc-xlsx";
import { workbook } from "@/lib/xlsx";
import { featureError } from "@/lib/plan-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — 견적서 엑셀 내려받기 (견적서 · 시험 상세 · 일정표 3장) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await sessionOrNull("cro");
  const orgId = s?.profile.cro_org_id;
  if (!s || !orgId) return new Response("권한이 없어요.", { status: 403 });
  { const pe = featureError(s.org, "quote_tool"); if (pe) return new Response(pe, { status: 403 }); }
  const got = await loadDoc(orgId, (await params).id);
  if (!got) return new Response("견적서를 찾지 못했어요.", { status: 404 });
  const style = await loadStyle(orgId, s.org?.name ?? "");
  const bytes = workbook(docSheets(got.head, got.data, style));
  const name = `견적서_${got.head.docNo}.xlsx`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quote_${got.head.docNo}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
