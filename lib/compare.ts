import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import { logEvent, notifyUsers } from "./notify";
import { notifyInvitedOrgs } from "./distribute";
import { beforeDeadline, pendingInvites } from "./reply-window";
import { captureError } from "./observe";
import { occupiesSeat, undecidedOffer } from "./request-policy";

export type CloseRepliesResult = { ok: boolean; count: number; pending: number; message: string; /** 아직 회신하지 않은 기관 이름 (운영자 알림용, 의뢰자·기관에는 보내지 않는다) */ pendingNames?: string[] };

/**
 * 회신 마감: rfq_requests.compared_at 을 채운다. 비교표 공개가 아니다. 비교표는 첫 견적부터 의뢰자에게 보인다 (lib/reply-window.ts).
 * - cron: 회신 기한 다음 날, 제출된 견적이 1건 이상인 요청 (auto = true)
 * - 운영자: 요청 화면의 "회신 마감" (POST /api/admin/rfqs/[no]/close-replies). 기한 전 마감은 약관 제4조7항의 조건에서만:
 *   참여한 기관이 모두 회신했거나(미회신 0, 0023 부터 참여한 기관 안에서 센다) 의뢰자가 요청한 경우(sponsorRequested). 이때 그 요청의 모든 기관(제출한 기관 포함)에 기관마다 따로 알린다
 * 마감은 한 번만 일어난다 (compared_at 이 비어 있을 때만 갱신). 의뢰자 요약(앱 알림 + 메일)도 그때 한 번 보낸다.
 * 마감하면 아직 내지 않은 기관을 포함해 모든 회신 링크가 닫힌다 (lib/quote-load.ts closed, save_quote). 운영자가 기한을 늘리면 다시 열린다.
 */
export async function closeReplies(rfq: RfqRow, actorId: string | null, auto = false, opts: { sponsorRequested?: boolean } = {}): Promise<CloseRepliesResult> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, count: 0, pending: 0, message: "저장소 미설정" };
  if (rfq.compared_at) return { ok: false, count: 0, pending: 0, message: "이미 회신이 마감된 요청입니다." };
  if (!["distributed", "quoted"].includes(rfq.status)) return { ok: false, count: 0, pending: 0, message: "회신을 받는 중인 요청만 마감할 수 있습니다." };

  const [{ count }, { data: invites }] = await Promise.all([
    sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted"),
    sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, cro_name, status, joined_at, withdrawn_at, revoked_at").eq("rfq_id", rfq.id),
  ]);
  if (!count) return { ok: false, count: 0, pending: 0, message: "제출된 견적이 없습니다. 기한을 늘리거나 기관을 추가해 주세요." };
  const open = (invites ?? []).filter((i) => i.status === "sent" || i.status === "draft");
  // 미회신은 참여한 기관 안에서 센다 (0023). 참여 결정 전 안내는 "미회신"이 아니다
  const joinedOpen = open.filter((i) => occupiesSeat(i));
  const undecided = open.filter((i) => !occupiesSeat(i) && undecidedOffer(i));
  const pending = pendingInvites(invites ?? []);
  const early = beforeDeadline(rfq.reply_by);
  const sponsorRequested = !auto && early && !!opts.sponsorRequested;
  if (!auto && early && pending > 0 && !sponsorRequested)
    return { ok: false, count, pending, message: `참여했지만 아직 제출하지 않은 기관이 ${pending}곳 있어 기한 전에는 마감할 수 없습니다. 의뢰자가 마감을 요청한 경우에만 기한 전에 마감합니다 (이용약관 제4조7항).` };
  const submitted = (invites ?? []).filter((i) => i.status === "submitted");

  // 동시에 cron 과 운영자가 눌러도 한 번만 마감되고 요약도 한 번만 간다
  const { data: done, error: doneError } = await sb
    .from("rfq_requests")
    .update({ compared_at: new Date().toISOString(), status: "compared" })
    .eq("id", rfq.id)
    .is("compared_at", null)
    .in("status", ["distributed", "quoted"])
    .select("id");
  // 저장 오류를 "이미 마감됨"으로 보이게 하지 않는다
  if (doneError) {
    captureError(doneError, "compare:close", { rfq: rfq.rfq_no });
    return { ok: false, count, pending, message: "회신 마감을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (!done?.length) return { ok: false, count, pending, message: "이미 회신이 마감된 요청입니다." };

  const why = early ? (sponsorRequested ? "기한 전 마감 · 의뢰자 요청" : "기한 전 마감 · 전원 회신") : "";
  await logEvent(rfq.id, "compared", `회신 마감 · 견적 ${count}건${auto ? " (기한 후 자동)" : ""}`, [pending ? `미회신 ${pending}곳` : "", why].filter(Boolean).join(" · ") || undefined, actorId, { auto, pending, early, sponsorRequested });

  // 기한 전에 닫으면 아직 쓰고 있던 기관과 기한까지 고칠 수 있다고 안내받은 제출 기관이 모른 채 남는다.
  // 기관마다 따로 알린다 (다른 기관 이름·금액은 넣지 않는다)
  if (!auto && early) {
    if (joinedOpen.length) await notifyInvitedOrgs(joinedOpen, { kind: "견적", title: `${rfq.rfq_no} 회신이 마감되었습니다`, body: `${rfq.substance} · 이 요청의 회신이 기한 전에 마감되어 더는 견적을 받지 않습니다. 참여해 주셔서 감사합니다.`, portalHref: "/cro" });
    // 참여 결정 전 기관에는 시험물질명을 알리지 않는다 (참여 전 요약에 없는 정보, 0023)
    if (undecided.length) await notifyInvitedOrgs(undecided, { kind: "견적", title: `${rfq.rfq_no} 참여 안내가 마감되었습니다`, body: "이 요청의 회신이 기한 전에 마감되어 더는 참여를 받지 않습니다. 안내를 확인해 주셔서 감사합니다.", portalHref: "/cro" });
    if (submitted.length) await notifyInvitedOrgs(submitted, { kind: "견적", title: `${rfq.rfq_no} 회신이 마감되었습니다`, body: `${rfq.substance} · 이 요청의 회신이 기한 전에 마감되어 제출하신 견적은 더 수정할 수 없습니다. 제출하신 견적은 그대로 의뢰자 비교표에 남습니다. 결과는 의뢰자 선정 후 안내해 드립니다.`, portalHref: "/cro" });
  }

  await notifyUsers(
    rfq.user_id ? [rfq.user_id] : [],
    {
      kind: "비교",
      title: auto ? `회신 기한이 지났습니다 · ${rfq.rfq_no}` : `회신이 마감되었습니다 · ${rfq.rfq_no}`,
      body: `견적 ${count}건 도착${pending ? ` · ${pending}곳 미회신` : ""}. 회신이 마감되어 견적은 더 바뀌지 않습니다. 비교표에서 조건을 확인하고 기관을 선정해 주세요.`,
      href: `/app/r/${rfq.rfq_no}/compare`,
    },
    { to: [rfq.email], subject: `[단추] ${rfq.rfq_no} 회신 마감 · 견적 ${count}건` },
  );
  return { ok: true, count, pending, pendingNames: joinedOpen.map((i) => i.cro_name).filter(Boolean), message: `회신을 마감하고 의뢰자에게 요약을 보냈습니다 (견적 ${count}건${pending ? `, 미회신 ${pending}곳` : ""}).` };
}
