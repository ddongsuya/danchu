import type { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "./notify";
import { notifyInvitedOrgs } from "./distribute";
import { captureError } from "./observe";
import { businessDaysBefore, lateJoinOpen, lowParticipation, seatReleased, seatState, undecidedOffer, type SeatInvite } from "./request-policy";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** 참여 단계 cron 이 읽는 초대 열 */
type OfferRow = SeatInvite & { id: string; token: string; cro_org_id: string | null; cro_email: string; cro_name: string; expires_at: string | null };

export type OptInCronResult = {
  /** 참여 결정 기한이 지나 처리한 요청 수 (지명 기관 몫 자리를 푼다) */
  joinDeadlines: number;
  /** 참여 부족으로 운영자에게 알린 요청 수 */
  lowParticipation: number;
  /** 회신 기한 3영업일 전에도 참여가 1곳 이하라 운영자에게 기한 연장 문의를 넘긴 요청 수 */
  extendAsked: number;
  /** "자리가 생겼습니다"를 받은 안내 수 */
  reoffered: number;
  errors: string[];
};

const OFFER_COLUMNS = "id, token, cro_org_id, cro_email, cro_name, status, source, joined_at, withdrawn_at, revoked_at, expires_at";
const EVENT_KINDS = ["join_deadline", "low_participation", "low_participation_cutoff", "seat_release"];

const metaOf = (m: unknown): Record<string, unknown> => (m && typeof m === "object" ? (m as Record<string, unknown>) : {});

/**
 * 매일 cron 의 참여 단계 (설계 규칙표 "지명 기관", "철회와 빈 자리", "참여가 모자랄 때"). 회신을 받는 중인 요청만 본다.
 * 1) 참여 결정 기한 경과: 아직 결정하지 않은 지명 기관 몫 자리를 일반 자리로 푼다 (자리 계산은 offer_seat_state·join_offer 가
 *    join_by 로 이미 바꾸므로 여기서는 이력을 남기고 알린다). 기한마다 한 번 (기한을 늘리면 새 기한에 다시)
 * 2) 참여 부족: 그때 참여가 자리 3곳 기준 2곳 미만(그 밖에는 절반 미만)이면 운영자에게 알리고 의뢰자에게 한 번 안내한다
 * 3) 회신 기한 3영업일 전에도 참여가 1곳 이하면 운영자에게 의뢰자에게 기한 연장을 물어 달라고 알린다 (회신 기한마다 한 번)
 * 4) 빈 자리 재안내: 철회·취소·지명 기관 불참·지명 기관 미결정으로 자리가 비었고, 그 전에는 자리가 찼던 경우
 *    아직 결정하지 않은 안내 기관에 "자리가 생겼습니다"를 보낸다. 다시 먼저 참여한 순서다 (대기 순번 없음).
 *    자리를 비운 초대는 한 번만 센다 (rfq_events seat_release 의 meta.ids)
 * 기관 이름은 운영자 알림에만 쓰고 의뢰자에게는 보내지 않는다. 참여 전 기관에게는 시험물질명을 보내지 않는다.
 */
export async function runOptInSteps(sb: Admin, today: string, now = Date.now()): Promise<OptInCronResult> {
  const out: OptInCronResult = { joinDeadlines: 0, lowParticipation: 0, extendAsked: 0, reoffered: 0, errors: [] };
  const { data: rfqs, error } = await sb.from("rfq_requests").select("*").in("status", ["distributed", "quoted"]).is("compared_at", null).is("selected_quote_id", null);
  if (error) throw new Error(`열린 요청을 조회하지 못했습니다: ${error.message}`);
  for (const rfq of (rfqs ?? []) as RfqRow[]) {
    if (rfq.compared_at || rfq.selected_quote_id) continue;
    try {
      await runForRfq(sb, rfq, today, now, out);
    } catch (e) {
      captureError(e, "cron:opt-in", { rfq: rfq.rfq_no });
      out.errors.push(`opt-in:${rfq.rfq_no}`);
    }
  }
  return out;
}

async function runForRfq(sb: Admin, rfq: RfqRow, today: string, now: number, out: OptInCronResult): Promise<void> {
  const [{ data: inv, error: invError }, { data: ev, error: evError }] = await Promise.all([
    sb.from("rfq_invites").select(OFFER_COLUMNS).eq("rfq_id", rfq.id),
    sb.from("rfq_events").select("kind, meta").eq("rfq_id", rfq.id).in("kind", EVENT_KINDS),
  ]);
  if (invError) throw new Error(`안내 조회 실패: ${invError.message}`);
  if (evError) throw new Error(`이력 조회 실패: ${evError.message}`);
  const invites = (inv ?? []) as OfferRow[];
  if (!invites.length) return;
  const events = (ev ?? []).map((e) => ({ kind: e.kind as string, meta: metaOf(e.meta) }));
  const seats = seatState(rfq.cro_count, rfq.join_by, invites, now);
  const offered = invites.filter((i) => !i.revoked_at).length;
  const seatText = seats.cap == null ? `참여 ${seats.used}곳` : `참여 ${seats.used}/${seats.cap}곳`;
  const admins = await adminUserIds();

  // 1) 참여 결정 기한 경과 + 2) 참여 부족
  if (rfq.join_by && now >= new Date(rfq.join_by).getTime() && !events.some((e) => e.kind === "join_deadline" && e.meta.join_by === rfq.join_by)) {
    const undecidedNominees = invites.filter((i) => i.source === "nominated" && !i.joined_at && i.status === "sent" && !i.revoked_at);
    await logEvent(
      rfq.id,
      "join_deadline",
      `참여 결정 기한 경과 · ${seatText}`,
      undecidedNominees.length ? `결정하지 않은 지명 기관 ${undecidedNominees.length}곳(${undecidedNominees.map((i) => i.cro_name).join(", ")}) 몫 자리를 일반 자리로 풀었습니다` : undefined,
      null,
      { join_by: rfq.join_by, used: seats.used, released: undecidedNominees.length },
    );
    out.joinDeadlines++;
    if (lowParticipation(rfq.cro_count, seats.used, offered)) {
      await notifyUsers(admins, {
        kind: "배포",
        title: `${rfq.rfq_no} 참여 부족 · ${seatText}`,
        body: `참여 결정 기한이 지났지만 참여한 기관이 적습니다 (안내 ${offered}곳). 분야가 맞는 기관에 참여를 권하거나 참여 안내를 추가해 주세요. 회신 기한 3영업일 전까지는 늦은 참여를 받을 수 있습니다.`,
        href: `/admin/r/${rfq.rfq_no}`,
      }, { to: adminEmails() });
      // 의뢰자 안내는 요청마다 한 번 (참여 결정 기한을 늘려도 다시 보내지 않는다).
      // 참여한 기관이 모두 제출했으면 이번 예약 작업(open-ready)이 비교표를 열고 늦은 참여도 닫히므로 늦은 참여 안내를 보내지 않는다 (0025)
      const seated = invites.filter((i) => !i.revoked_at && !i.withdrawn_at && (i.joined_at || i.status === "draft" || i.status === "submitted") && ["sent", "draft", "submitted"].includes(i.status));
      const opensNow = seated.length > 0 && seated.every((i) => i.status === "submitted");
      if (!opensNow && !events.some((e) => e.kind === "low_participation")) {
        await notifyUsers(rfq.user_id ? [rfq.user_id] : [], {
          kind: "배포",
          title: `${rfq.rfq_no} 참여한 기관이 아직 ${seats.used}곳입니다`,
          body: `참여 결정 기한이 지났고 지금 ${seatText}입니다. 운영자가 분야가 맞는 기관에 참여를 권하고 있으며, 회신 기한 3영업일 전까지는 늦게 참여한 기관도 견적을 보낼 수 있습니다. 회신 기한을 늘리고 싶으시면 요청 화면의 문의하기로 알려 주세요.`,
          href: `/app/r/${rfq.rfq_no}`,
        }, { to: [rfq.email] });
      }
      await logEvent(rfq.id, "low_participation", `참여 부족 알림 · ${seatText}`, `안내 ${offered}곳`, null, { used: seats.used, offered, join_by: rfq.join_by });
      out.lowParticipation++;
    }
  }

  // 3) 회신 기한 3영업일 전에도 참여 1곳 이하: 운영자가 의뢰자에게 기한 연장을 묻는다
  if (rfq.reply_by && today <= rfq.reply_by && today >= businessDaysBefore(rfq.reply_by, 3) && seats.used <= 1
      && !events.some((e) => e.kind === "low_participation_cutoff" && e.meta.reply_by === rfq.reply_by)) {
    await notifyUsers(admins, {
      kind: "배포",
      title: `${rfq.rfq_no} 회신 기한 임박 · ${seatText}`,
      body: `회신 기한(${rfq.reply_by})이 3영업일 안인데 참여한 기관이 ${seats.used}곳입니다. 의뢰자에게 회신 기한 연장을 여쭤 보고, 동의하면 회신 기한을 늘려 주세요.`,
      href: `/admin/r/${rfq.rfq_no}`,
    }, { to: adminEmails() });
    await logEvent(rfq.id, "low_participation_cutoff", `회신 기한 연장 문의 필요 · ${seatText}`, `회신 기한 ${rfq.reply_by}`, null, { reply_by: rfq.reply_by, used: seats.used });
    out.extendAsked++;
  }

  // 4) 빈 자리 재안내 (자리 제한이 있는 요청만. 전체는 참여한 기관 모두가 견적을 쓴다)
  out.reoffered += await reofferReleasedSeats(rfq, invites, events, today, now);
}

/**
 * 빈 자리 재안내 (위 4단계). cron 과, 자리가 비는 순간(참여 철회·지명 기관 불참, app/api/quote/[token]/decline)에 같은 판정으로 부른다.
 * 자리를 비운 초대는 rfq_events seat_release 의 meta.ids 로 한 번만 센다 (어느 쪽이 먼저 처리해도 다른 쪽은 다시 알리지 않는다).
 * 알린 안내 수를 돌려준다
 */
async function reofferReleasedSeats(rfq: RfqRow, invites: OfferRow[], events: { kind: string; meta: Record<string, unknown> }[], today: string, now: number): Promise<number> {
  const seats = seatState(rfq.cro_count, rfq.join_by, invites, now);
  let reoffered = 0;
  if (seats.cap != null) {
    const seen = new Set(events.filter((e) => e.kind === "seat_release").flatMap((e) => (Array.isArray(e.meta.ids) ? (e.meta.ids as unknown[]).filter((x): x is string => typeof x === "string") : [])));
    const fresh = invites.filter((i) => seatReleased(i, rfq.join_by, now) && !seen.has(i.id)).map((i) => i.id);
    if (fresh.length) {
      const targets = invites.filter((i) => undecidedOffer(i, now));
      const open = seats.open ?? 0;
      // 비기 전에 자리가 찼던 경우만 "자리가 생겼다"고 알린다. 자리가 남아 있던 중이면 안내받은 기관은 이미 참여할 수 있었다
      const wasFull = seats.used + fresh.length >= seats.cap;
      const late = lateJoinOpen(rfq.reply_by, rfq.join_by, today, now);
      const due = open > 0 && wasFull && late && targets.length > 0;
      const why = open <= 0 ? "그 사이 다른 기관이 참여해 남은 자리가 없습니다"
        : !wasFull ? "자리가 남아 있던 중이라 다시 안내하지 않았습니다"
        : !late ? "늦은 참여 마감(회신 기한 3영업일 전)이 지나 다시 안내하지 않았습니다"
        : "참여를 결정하지 않은 안내 기관이 없습니다";
      if (due) {
        await notifyInvitedOrgs(targets, {
          kind: "배포",
          title: `자리가 생겼습니다 · ${rfq.rfq_no}`,
          body: `${(rfq.categories ?? []).join(" · ")} 견적 요청에 참여 자리 ${open}곳이 생겼습니다. 먼저 참여한 기관부터 자리가 찹니다. 요약을 보고 참여를 결정해 주세요.${rfq.reply_by ? ` 회신 기한 ${rfq.reply_by}.` : ""}`,
        });
        reoffered = targets.length;
      }
      await logEvent(
        rfq.id,
        "seat_release",
        due ? `빈 자리 재안내 · 자리 ${open}곳 · 참여 결정 전 ${targets.length}곳에 안내` : `자리 ${fresh.length}곳 비움`,
        due ? undefined : why,
        null,
        { ids: fresh, open, notified: due ? targets.length : 0 },
      );
    }
  }
  return reoffered;
}

/**
 * 자리가 비는 순간 바로 재안내한다 (참여 철회·지명 기관 불참 직후). cron 을 기다리면 참여 결정 기한이 1영업일인 요청에서
 * 자리가 하루 비고, 그 사이 늦은 참여 마감이 지나 아예 알리지 못할 수 있다. 실패해도 호출한 처리는 그대로 둔다 (cron 이 안전망)
 */
export async function reofferNow(sb: Admin, rfqId: string, today: string, now = Date.now()): Promise<number> {
  const { data: rfq } = await sb.from("rfq_requests").select("*").eq("id", rfqId).maybeSingle();
  if (!rfq || rfq.compared_at || rfq.selected_quote_id || !["distributed", "quoted"].includes(rfq.status)) return 0;
  const [{ data: inv, error: invError }, { data: ev, error: evError }] = await Promise.all([
    sb.from("rfq_invites").select(OFFER_COLUMNS).eq("rfq_id", rfqId),
    sb.from("rfq_events").select("kind, meta").eq("rfq_id", rfqId).eq("kind", "seat_release"),
  ]);
  if (invError || evError) return 0;
  const events = (ev ?? []).map((e) => ({ kind: e.kind as string, meta: metaOf(e.meta) }));
  return reofferReleasedSeats(rfq as RfqRow, (inv ?? []) as OfferRow[], events, today, now);
}
