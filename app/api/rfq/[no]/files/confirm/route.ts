import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { storageHas } from "@/lib/upload";
import { logEvent } from "@/lib/notify";
import { notifyInvitedOrgs } from "@/lib/distribute";
import { occupiesSeat } from "@/lib/request-policy";

export const runtime = "nodejs";

/**
 * POST { paths: string[] } — 브라우저가 서명 URL로 올린 첨부를 서버가 확인해 uploaded_at 을 찍는다.
 * 접수 직후 위자드가 부른다. 못 불러도 내려받을 때 다시 확인하므로 접수 자체는 유효하다.
 * 참여 안내가 나간 뒤에 올라온 첨부(요청 화면에서 다시 올린 것)는 참여해 회신 중인 기관에 알린다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull();
  if (!s) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });

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
  // 참여 안내가 나간 뒤 다시 올린 첨부: 참여해 회신 중인 기관에만 기관마다 따로 알린다 (다른 기관 주소가 함께 보이지 않게, 0023).
  // 참여 결정 전 기관은 요약에 첨부 개수만 보이므로 알리지 않는다. 비교표가 열린 뒤에는 견적을 고칠 수 없어 알리지 않는다
  if (confirmed && rfq.started_at && !rfq.compared_at && !["closed", "cancelled", "selected", "contracting"].includes(rfq.status)) {
    const { data: open } = await sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, status, joined_at, withdrawn_at, revoked_at").eq("rfq_id", rfq.id).in("status", ["sent", "draft", "submitted"]).is("revoked_at", null);
    const joined = (open ?? []).filter((i) => occupiesSeat(i));
    await notifyInvitedOrgs(joined, { kind: "견적", title: `${rfq.rfq_no} 첨부가 추가되었습니다`, body: `의뢰자가 첨부 ${confirmed}개를 더 올렸습니다. 견적에 반영할 내용이 있는지 확인해 주세요. 제출한 견적은 비교표가 열리기 전까지 고칠 수 있습니다.`, portalHref: "/cro" }).catch((e) => console.error("file notify", e));
    await logEvent(rfq.id, "files", `첨부 ${confirmed}개 추가`, undefined, s.userId);
  }
  const complete = verified?.length === new Set(paths).size && verified.every((f) => !!f.uploaded_at);
  return NextResponse.json({ confirmed, complete });
}
