import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { storageHas } from "@/lib/upload";

export const runtime = "nodejs";

/**
 * POST { paths: string[] } — 브라우저가 서명 URL로 올린 첨부를 서버가 확인해 uploaded_at 을 찍는다.
 * 접수 직후 위자드가 부른다. 못 불러도 내려받을 때 다시 확인하므로 접수 자체는 유효하다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { paths?: unknown };
  const paths = Array.isArray(b.paths) ? (b.paths as unknown[]).filter((x): x is string => typeof x === "string" && x.startsWith(`${rfq.rfq_no}/`)).slice(0, 20) : [];
  if (!paths.length) return NextResponse.json({ confirmed: 0 });

  const sb = getSupabaseAdmin()!;
  const { data } = await sb.from("rfq_files").select("*").eq("rfq_id", rfq.id).in("storage_path", paths).is("uploaded_at", null);
  let confirmed = 0;
  for (const f of data ?? []) {
    if (await storageHas(sb, "rfq-files", f.storage_path)) {
      await sb.from("rfq_files").update({ uploaded_at: new Date().toISOString() }).eq("id", f.id);
      confirmed++;
    }
  }
  const { data: verified } = await sb.from("rfq_files").select("storage_path, uploaded_at").eq("rfq_id", rfq.id).in("storage_path", paths);
  const complete = verified?.length === new Set(paths).size && verified.every((f) => !!f.uploaded_at);
  return NextResponse.json({ confirmed, complete });
}
