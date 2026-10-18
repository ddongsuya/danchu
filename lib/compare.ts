import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import type { TablesUpdate } from "./db-types";
import { logEvent, notifyUsers } from "./notify";

/** 자동 공개 이유. deadline: 회신 마감 다음 날 오전 9시 예약 작업, all: 전달한 기관이 모두 회신(제출 또는 회신하지 않음) */
export type AutoPublish = false | "deadline" | "all";

/**
 * 비교표 공개. 제출된 회신이 1건 이상이어야 한다. 의뢰자에게 알림·메일, 회신한 기관에는 수정이 닫혔다는 앱 알림.
 * 운영자 버튼, 기한 후 자동 공개, 모두 회신 시 즉시 공개가 함께 쓴다.
 * 자동 공개는 compared_at 이 비어 있을 때만 한 번 (동시에 두 기관이 제출해도 한 번만 알린다).
 */
export async function publishCompare(rfq: RfqRow, actorId: string | null, auto: AutoPublish = false): Promise<{ ok: boolean; count: number; message: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, count: 0, message: "저장소 미설정" };
  const { count } = await sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted");
  if (!count) return { ok: false, count: 0, message: "제출된 회신이 없습니다." };

  const first = !rfq.compared_at;
  const patch: TablesUpdate<"rfq_requests"> = { compared_at: new Date().toISOString() };
  if (["received", "distributed", "quoted"].includes(rfq.status)) patch.status = "compared";
  if (auto) {
    const { data: won } = await sb.from("rfq_requests").update(patch).eq("id", rfq.id).is("compared_at", null).select("id").maybeSingle();
    if (!won) return { ok: false, count, message: "이미 공개된 비교표입니다." };
  } else {
    await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
  }
  const why = auto === "all" ? " (모두 회신)" : auto ? " (기한 후 자동)" : "";
  await logEvent(rfq.id, "compared", `${first ? "비교표 공개" : "비교표 재공개"} · ${count}건${why}`, undefined, actorId, { auto });

  if (first) {
    // 회신한 기관: 수정이 닫혔다. 아직 안 낸 기관: 회신이 닫혔다. 메일은 보내지 않는다 (선정되면 그때 메일)
    const { data: invs } = await sb.from("rfq_invites").select("cro_org_id, status").eq("rfq_id", rfq.id).in("status", ["sent", "draft", "submitted"]);
    for (const group of ["submitted", "open"] as const) {
      const orgIds = (invs ?? []).filter((i) => (group === "submitted" ? i.status === "submitted" : i.status !== "submitted")).map((i) => i.cro_org_id).filter((x): x is string => !!x);
      if (!orgIds.length) continue;
      const { data: ms } = await sb.from("profiles").select("id").in("cro_org_id", orgIds);
      await notifyUsers(
        (ms ?? []).map((m) => m.id),
        group === "submitted"
          ? { kind: "비교", title: `${rfq.rfq_no} 비교표가 열려 견적 수정이 닫혔습니다`, body: "의뢰자가 회신을 비교하고 있습니다. 선정 결과는 정해지는 대로 알려 드립니다.", href: "/cro" }
          : { kind: "비교", title: `${rfq.rfq_no} 회신이 닫혔습니다`, body: auto === "all" ? "다른 기관이 모두 회신해 비교표가 먼저 열렸습니다." : "회신 마감이 지나 비교표가 열렸습니다.", href: "/cro" },
      ).catch((e) => console.error("compare notify cro", e));
    }
  }

  await notifyUsers(
    rfq.user_id ? [rfq.user_id] : [],
    { kind: "비교", title: `비교표가 도착했습니다 · ${rfq.rfq_no}`, body: `${count}곳 회신 · 수행 범위와 포함 비용을 견적서 원본과 함께 확인하세요.`, href: `/app/r/${rfq.rfq_no}/compare` },
    { to: [rfq.email], subject: `[단추] ${rfq.rfq_no} 견적 비교표 도착 · ${count}곳 회신` },
  );
  return { ok: true, count, message: `비교표를 공개하고 의뢰자에게 알렸습니다 (${count}건).` };
}

/** 회신 현황. 운영자가 취소한 초대(expired)는 빼고 센다 */
export async function replyTally(rfqId: string): Promise<{ active: number; submitted: number; declined: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { active: 0, submitted: 0, declined: 0 };
  const { data } = await sb.from("rfq_invites").select("status").eq("rfq_id", rfqId).neq("status", "expired");
  const all = data ?? [];
  return { active: all.length, submitted: all.filter((i) => i.status === "submitted").length, declined: all.filter((i) => i.status === "declined").length };
}

/**
 * 전달한 기관이 모두 답했으면(제출 또는 회신하지 않음) 마감을 기다리지 않고 비교표를 연다.
 * 제출된 견적이 하나도 없으면 열지 않는다 (운영자가 다른 기관을 찾는다).
 */
export async function publishIfAllReplied(rfqId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const t = await replyTally(rfqId);
  if (!t.active || !t.submitted || t.submitted + t.declined < t.active) return false;
  const { data: rfq } = await sb.from("rfq_requests").select("*").eq("id", rfqId).maybeSingle();
  if (!rfq || rfq.compared_at || !["distributed", "quoted"].includes(rfq.status)) return false;
  const r = await publishCompare(rfq as RfqRow, null, "all");
  return r.ok;
}
