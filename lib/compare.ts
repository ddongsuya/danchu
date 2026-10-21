import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import { logEvent, notifyUsers } from "./notify";
import { beforeDeadline, pendingInvites } from "./reply-window";
import { captureError } from "./observe";
import { occupiesSeat, undecidedOffer } from "./request-policy";

/** 기한 전 마감을 거절할 때 쓰는 문구 (2026-10-21 결정 2). 운영자 화면과 라우트가 같이 쓴다 */
export const EARLY_CLOSE_REFUSED = "회신 기한 전에는 회신을 마감할 수 없습니다. 비교표는 참여가 마감된 뒤 참여한 기관이 모두 제출하면 바로 열리고, 그렇지 않으면 회신 기한 다음 날 오전 9시에 열립니다.";

export type CloseRepliesResult = { ok: boolean; count: number; pending: number; message: string; /** 아직 회신하지 않은 기관 이름 (운영자 알림용, 의뢰자·기관에는 보내지 않는다) */ pendingNames?: string[] };

/**
 * 비교표가 열린 이유 (2026-10-20 결정, 0025 · 2026-10-21 결정 2).
 * - all: 참여한 기관(철회하지 않은)이 모두 제출했고 더 참여할 자리가 없거나 참여 결정 기한이 지났다. DB 가 save_quote·withdraw_offer·open_comparison_if_ready 안에서 연다
 * - deadline: 회신 기한 다음 날 예약 작업 (제출 1건 이상)
 * - operator: 회신 기한이 지난 요청을 운영자가 예약 작업보다 먼저 연 경우 (deadline 과 같은 조건). 기한 전 운영자 마감은 없다
 */
export type CompareOpenReason = "all" | "deadline" | "operator";
/** 예전 이름 (흐름 재설계 브랜치). false 는 운영자 */
export type AutoPublish = false | "deadline" | "all";

/**
 * 비교표 공개 = rfq_requests.compared_at (2026-10-20 결정이 0019 의 "회신 마감, 실시간 비교"를 대신한다).
 * 비교표가 열리기 전에는 의뢰자에게 진행 현황(참여 n곳, 제출 m곳)만 보이고 기관 이름·금액·견적은 보이지 않는다.
 * 의뢰자가 지명한 기관만 이름과 참여 상태(참여·불참·결정 전)를 보여 줄 수 있다. 선택(select_quote)은 열린 뒤에만 된다 (0025 not_compared).
 * 열리면 아직 내지 않은 기관을 포함해 모든 회신이 닫힌다 (save_quote·join_offer closed).
 * 한 번 열린 비교표는 다시 닫지 않고 회신 기한도 바꾸지 않는다 (2026-10-21 결정 3, 0026 트리거 rfq_requests_compare_lock·cro_quotes_compare_lock).
 *
 * 이 함수는 기한 후 예약 작업(auto = true)과 운영자 "회신 마감"(POST /api/admin/rfqs/[no]/close-replies)이 쓴다. 둘 다 회신 기한이 지난 요청만 연다.
 * 기한 전 마감은 없다 (2026-10-21 결정 2): 의뢰자 요청으로 일찍 마감하던 경로를 없앴고, 기한 전에는 참여가 마감된 뒤 참여 기관이 모두 제출한 경우(all)만 DB 가 연다.
 * 빨리 받아야 하는 의뢰자는 요청서에서 회신 기한을 짧게 정한다.
 * 공개는 한 번만 일어난다 (compared_at 이 비어 있을 때만 갱신). 알림도 그때 한 번 보낸다 (announceCompareOpened).
 * 제출된 견적이 0건이면 열지 않는다 (운영자·의뢰자 안내는 지금처럼 예약 작업이 보낸다).
 */
export async function closeReplies(rfq: RfqRow, actorId: string | null, auto = false): Promise<CloseRepliesResult> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, count: 0, pending: 0, message: "저장소 미설정" };
  if (rfq.compared_at) return { ok: false, count: 0, pending: 0, message: "이미 비교표가 열린 요청입니다." };
  if (!["distributed", "quoted"].includes(rfq.status)) return { ok: false, count: 0, pending: 0, message: "회신을 받는 중인 요청만 마감할 수 있습니다." };
  if (beforeDeadline(rfq.reply_by)) return { ok: false, count: 0, pending: 0, message: EARLY_CLOSE_REFUSED };

  const [{ count }, { data: invites }] = await Promise.all([
    sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id).eq("status", "submitted"),
    sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, cro_name, status, joined_at, withdrawn_at, revoked_at").eq("rfq_id", rfq.id),
  ]);
  if (!count) return { ok: false, count: 0, pending: 0, message: "제출된 견적이 없습니다. 기한을 늘리거나 기관을 추가해 주세요." };
  // 미회신은 참여한 기관 안에서 센다 (0023). 참여 결정 전 안내는 "미회신"이 아니다
  const pending = pendingInvites(invites ?? []);

  // 동시에 cron 과 운영자, 또는 마지막 제출(save_quote)이 함께 열어도 한 번만 열리고 알림도 한 번만 간다
  const { data: done, error: doneError } = await sb
    .from("rfq_requests")
    .update({ compared_at: new Date().toISOString(), status: "compared" })
    .eq("id", rfq.id)
    .is("compared_at", null)
    .is("selected_quote_id", null)
    .in("status", ["distributed", "quoted"])
    .select("id");
  // 저장 오류를 "이미 열림"으로 보이게 하지 않는다
  if (doneError) {
    captureError(doneError, "compare:close", { rfq: rfq.rfq_no });
    return { ok: false, count, pending, message: "비교표 공개를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  if (!done?.length) return { ok: false, count, pending, message: "이미 비교표가 열린 요청입니다." };

  await logEvent(rfq.id, "compared", `비교표 공개 · 견적 ${count}건${auto ? " (기한 후 자동)" : " (기한 후 운영자)"}`, pending ? `미회신 ${pending}곳` : undefined, actorId, { auto, pending });
  await announceCompareOpened(rfq, auto ? "deadline" : "operator", count, { pending });
  const joinedOpen = (invites ?? []).filter((i) => (i.status === "sent" || i.status === "draft") && occupiesSeat(i));
  return { ok: true, count, pending, pendingNames: joinedOpen.map((i) => i.cro_name).filter(Boolean), message: `비교표를 열고 의뢰자에게 알렸습니다 (견적 ${count}건${pending ? `, 미회신 ${pending}곳` : ""}).` };
}

/**
 * 비교표가 열린 뒤 한 번 보내는 알림. compared_at 을 채운 쪽이 부른다 (closeReplies, publishIfAllReplied, save_quote·withdraw_offer 가 compare_opened 를 돌려준 라우트).
 * - 의뢰자: 앱 알림 + 메일 "비교표가 열렸습니다". 이때부터 기관 이름과 금액이 보이고 선택할 수 있다
 * - 기관: 기관마다 따로. 다른 기관의 이름·금액은 넣지 않는다. 앱 알림만 (기한 전 운영자 마감이 없어졌으므로 메일로 따로 알릴 경우가 없다, 2026-10-21 결정 2)
 */
export async function announceCompareOpened(rfqIn: RfqRow | string, reason: CompareOpenReason, countIn?: number, ctx: { pending?: number } = {}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  let rfq: RfqRow | null = typeof rfqIn === "string" ? null : rfqIn;
  if (!rfq) {
    const { data } = await sb.from("rfq_requests").select("*").eq("id", rfqIn as string).maybeSingle();
    rfq = (data as RfqRow | null) ?? null;
  }
  if (!rfq) return;
  const r = rfq;
  const [{ count: submittedCount }, { data: invites }] = await Promise.all([
    countIn == null ? sb.from("cro_quotes").select("id", { count: "exact", head: true }).eq("rfq_id", r.id).eq("status", "submitted") : Promise.resolve({ count: countIn }),
    sb.from("rfq_invites").select("id, token, cro_org_id, cro_email, cro_name, status, joined_at, withdrawn_at, revoked_at, expires_at").eq("rfq_id", r.id),
  ]);
  const count = submittedCount ?? 0;
  const all = invites ?? [];
  const submitted = all.filter((i) => i.status === "submitted" && !i.revoked_at);
  const joinedOpen = all.filter((i) => (i.status === "sent" || i.status === "draft") && occupiesSeat(i));
  const undecided = all.filter((i) => !occupiesSeat(i) && undecidedOffer(i));

  // 앱 알림만 (메일은 선택 결과가 나올 때). 받는 사람은 지금 소속 담당자
  try {
    const groups: { list: typeof all; title: string; body: string }[] = [
      { list: submitted, title: `${r.rfq_no} 비교표가 열려 견적 수정이 닫혔습니다`, body: "의뢰자가 회신을 비교하고 있습니다. 선택 결과는 정해지는 대로 알려 드립니다." },
      { list: joinedOpen, title: `${r.rfq_no} 회신이 닫혔습니다`, body: reason === "all" ? "참여한 다른 기관이 모두 제출해 비교표가 먼저 열렸습니다." : "회신 기한이 지나 비교표가 열렸습니다." },
      { list: undecided, title: `${r.rfq_no} 참여 안내가 마감되었습니다`, body: "비교표가 열려 더는 참여를 받지 않습니다. 안내를 확인해 주셔서 감사합니다." },
    ];
    for (const g of groups) {
      const orgIds = [...new Set(g.list.map((i) => i.cro_org_id).filter((x): x is string => !!x))];
      if (!orgIds.length) continue;
      const { data: ms } = await sb.from("profiles").select("id").in("cro_org_id", orgIds);
      await notifyUsers((ms ?? []).map((m) => m.id), { kind: "비교", title: g.title, body: g.body, href: "/cro" });
    }
  } catch (e) {
    captureError(e, "compare:notify-orgs", { rfq: r.rfq_no });
  }

  const pending = ctx.pending ?? 0;
  const lead = reason === "all" ? "참여한 기관이 모두 견적을 제출해 비교표가 열렸습니다." : "회신 기한이 지나 비교표가 열렸습니다.";
  await notifyUsers(
    r.user_id ? [r.user_id] : [],
    {
      kind: "비교",
      title: `비교표가 열렸습니다 · ${r.rfq_no}`,
      body: `${lead} 견적 ${count}건${pending ? ` · ${pending}곳 미제출` : ""}. 이제 기관 이름과 금액을 나란히 보고 기관을 선택할 수 있습니다. 견적은 더 바뀌지 않습니다.`,
      href: `/app/r/${r.rfq_no}/compare`,
    },
    { to: [r.email], subject: `[단추] ${r.rfq_no} 비교표가 열렸습니다 · 견적 ${count}건` },
  );
}

/** 진행 현황 (비교표가 열리기 전 의뢰자에게 보이는 숫자). joined: 자리를 차지한 참여 기관(철회·취소 제외), submitted: 그중 제출 */
export async function replyTally(rfqId: string): Promise<{ joined: number; submitted: number; pending: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { joined: 0, submitted: 0, pending: 0 };
  const { data } = await sb.from("rfq_invites").select("status, joined_at, withdrawn_at, revoked_at").eq("rfq_id", rfqId);
  const seated = (data ?? []).filter((i) => occupiesSeat(i));
  const submitted = seated.filter((i) => i.status === "submitted").length;
  return { joined: seated.length, submitted, pending: seated.length - submitted };
}

/**
 * 참여한 기관이 모두 제출했으면 기한을 기다리지 않고 비교표를 연다 (0025 open_comparison_if_ready, 요청 행 잠금 안에서 판정).
 * 조건: 제출 1건 이상, 자리를 차지한 참여 기관이 모두 제출, 그리고 더 참여할 수 없음(자리가 다 찼거나 참여 결정 기한이 지남).
 * 마지막 제출(save_quote)·철회(withdraw_offer)는 DB 가 같은 트랜잭션에서 열고 compare_opened 를 돌려준다. 이 함수는 그 밖의 경로(불참, 예약 작업)의 안전망이다.
 * 열었으면 알림을 보내고 true.
 */
export async function publishIfAllReplied(rfqId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { data, error } = await sb.rpc("open_comparison_if_ready", { p_rfq_id: rfqId });
  if (error) {
    captureError(error, "compare:open-if-ready", { rfq: rfqId });
    return false;
  }
  const d = (data ?? {}) as { opened?: boolean; submitted?: number };
  if (!d.opened) return false;
  await logEvent(rfqId, "compared", `비교표 공개 · 견적 ${d.submitted ?? 0}건 (참여 기관 모두 제출)`, undefined, null, { auto: "all" });
  await announceCompareOpened(rfqId, "all", d.submitted);
  return true;
}
