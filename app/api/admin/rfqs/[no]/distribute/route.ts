import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { distributeTo } from "@/lib/distribute";

export const runtime = "nodejs";

/**
 * POST { orgIds: string[], replyBy: 'YYYY-MM-DD' } — 운영자가 고른 승인 기관에 초대(회신 링크)를 보낸다.
 * 접수 시 자동 배포에서 빠진 기관을 추가하거나, 자동 배포가 없었을 때 쓴다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "종료된 요청입니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { orgIds?: unknown; replyBy?: unknown };
  const orgIds = Array.isArray(b.orgIds) ? (b.orgIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [];
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!orgIds.length || !replyBy) return NextResponse.json({ error: "기관과 회신 기한을 선택해 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { data: orgs } = await sb.from("cro_orgs").select("id, name, contact_email, categories, glp_certs").in("id", orgIds).eq("status", "approved");
  const r = await distributeTo(rfq, orgs ?? [], replyBy, s.userId);
  return NextResponse.json({ ok: true, sent: r.sent, mailed: r.mailed, skipped: r.skipped });
}
