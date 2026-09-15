import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import { logEvent, notifyUsers } from "./notify";

/**
 * 비교표 공개. 제출된 회신이 1건 이상이어야 한다. 의뢰자에게 알림·메일.
 * 운영자 버튼과 기한 후 자동 공개가 함께 쓴다.
 */
export async function publishCompare(rfq: RfqRow, actorId: string | null, auto = false): Promise<{ ok: boolean; count: number; message: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, count: 0, message: "저장소 미설정" };
  const { count } = await sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted");
  if (!count) return { ok: false, count: 0, message: "제출된 회신이 없습니다." };

  const first = !rfq.compared_at;
  const patch: Record<string, unknown> = { compared_at: new Date().toISOString() };
  if (["received", "distributed", "quoted"].includes(rfq.status)) patch.status = "compared";
  await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
  await logEvent(rfq.id, "compared", `${first ? "비교표 공개" : "비교표 재공개"} · ${count}건${auto ? " (기한 후 자동)" : ""}`, undefined, actorId, { auto });

  await notifyUsers(
    rfq.user_id ? [rfq.user_id] : [],
    { kind: "비교", title: `비교표가 도착했습니다 · ${rfq.rfq_no}`, body: `${count}곳 회신 · 총액 오름차순으로 정리했습니다. 정본 PDF와 함께 확인하세요.`, href: `/app/r/${rfq.rfq_no}/compare` },
    { to: [rfq.email], subject: `[단추] ${rfq.rfq_no} 견적 비교표 도착 · ${count}곳 회신` },
  );
  return { ok: true, count, message: `비교표를 공개하고 의뢰자에게 알렸습니다 (${count}건).` };
}
