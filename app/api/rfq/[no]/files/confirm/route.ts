import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { storageHas } from "@/lib/upload";
import { logEvent, notifyUsers } from "@/lib/notify";

export const runtime = "nodejs";

/**
 * POST { paths: string[] } — 브라우저가 서명 URL로 올린 첨부를 서버가 확인해 uploaded_at 을 찍는다.
 * 접수 직후 위자드가 부른다. 못 불러도 내려받을 때 다시 확인하므로 접수 자체는 유효하다.
 * 기관 전달이 시작된 뒤에 올라온 첨부(요청 화면에서 다시 올린 것)는 회신 중인 기관에 알린다.
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
  if (confirmed && rfq.started_at && !["closed", "cancelled", "selected", "contracting"].includes(rfq.status)) {
    const { data: open } = await sb.from("rfq_invites").select("cro_org_id, cro_email").eq("rfq_id", rfq.id).in("status", ["sent", "draft", "submitted"]);
    const orgIds = (open ?? []).map((i) => i.cro_org_id).filter((x): x is string => !!x);
    const { data: ms } = orgIds.length ? await sb.from("profiles").select("id").in("cro_org_id", orgIds) : { data: [] as { id: string }[] };
    if ((open ?? []).length) {
      await notifyUsers(
        (ms ?? []).map((m) => m.id),
        { kind: "시스템", title: `${rfq.rfq_no} 첨부가 추가되었습니다`, body: `의뢰자가 첨부 ${confirmed}개를 더 올렸습니다. 견적에 반영할 내용이 있는지 확인해 주세요.`, href: "/cro" },
        { to: (open ?? []).map((i) => i.cro_email) },
      ).catch((e) => console.error("file notify", e));
    }
    await logEvent(rfq.id, "files", `첨부 ${confirmed}개 추가`, undefined, s.userId);
  }
  const complete = verified?.length === new Set(paths).size && verified.every((f) => !!f.uploaded_at);
  return NextResponse.json({ confirmed, complete });
}
