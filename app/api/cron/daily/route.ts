import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { adminEmails, adminUserIds, logEvent, notifyUsers, operatorReplyTo, siteUrl } from "@/lib/notify";
import { announceCompareOpened, closeReplies } from "@/lib/compare";
import { distributeOpenRfqs, inviteMailTo, inviteReplyTo, orgMailTargets, resendUnmailedInvites } from "@/lib/distribute";
import { todaySeoul, won } from "@/lib/format";
import { captureError } from "@/lib/observe";
import { isProduction } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";
import { runRetention } from "@/lib/retention";
import { purgeLeftOrgCrm } from "@/lib/crm-purge";
import { cronPart, stepInPart } from "@/lib/cron-parts";
import { EARLY_OPEN_DATE, earlyOpenSms, type EarlyRole } from "@/lib/early";
import { smsPhone } from "@/lib/sms";
import { daysSince, reminderStage } from "@/lib/contract-reminder";
import { shouldAskSponsor } from "@/lib/contract-gap";
import { contractFollowupMail, esc, mailWrap, sendMail } from "@/lib/mail";
import { notificationRecipients } from "@/lib/mail-preferences";
import { needsContractReminder, replyPath } from "@/lib/concierge";
import { closeRepliesDue, noReplyNotified, repliesClosed } from "@/lib/reply-window";
import { occupiesSeat } from "@/lib/request-policy";
import { runOptInSteps } from "@/lib/opt-in-cron";
import { startRfq } from "@/lib/rfq-create";
import { cleanupPending } from "@/lib/rfq-pending";
import { deliverInvoice, reminderStageFor } from "@/lib/invoices";
import type { BillingInvoiceRow } from "@/lib/db-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return !isProduction();
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** 오류가 나도 다음 단계로 넘어가도록 단계마다 감싼다. 실패한 단계 이름은 끝에 운영자에게 알린다 */
async function step(name: string, errors: string[], fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    captureError(e, `cron:${name}`);
    errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/**
 * 매일 09:00 KST 실행 (vercel.json crons). 09:00 에 flow, 09:10 에 upkeep 묶음이 따로 돈다 (cronPart).
 * 0) 위자드가 시작하지 못한 접수(첨부 업로드 중 창을 닫는 등)를 대신 시작, 빠진 참여 안내 보충, 안 간 안내 메일 재발송
 * 0-2) 참여 단계 (0023, lib/opt-in-cron.ts): 참여 결정 기한 경과 처리(지명 기관 몫 자리 풀기), 참여 부족 알림(운영자 + 의뢰자 1회),
 *      회신 기한 3영업일 전 참여 1곳 이하 알림(운영자), 빈 자리 재안내("자리가 생겼습니다")
 * 0-3) 비교표 열기 (0025 open_ready_comparisons): 참여한 기관이 모두 제출했는데 참여 결정 기한이 지나 이제 더 참여할 수 없게 된 요청
 * 1) 참여한 기관 중 아직 제출하지 않은 곳에 D-2·당일 리마인더 (참여 결정 전 안내에는 보내지 않는다)
 * 2) 회신 기한이 지난 요청의 비교표 공개 (제출 1건 이상, lib/compare.ts closeReplies). 제출 0건이면 열지 않고 운영자·의뢰자에게 알린다.
 *    비교표가 열리기 전 의뢰자에게는 진행 현황만 보인다 (2026-10-20 결정 1)
 * 4) 선정 여부 확인, 계약 보고 리마인더, 계약 보고 7일 뒤 이의가 없으면 자동 확정 (0025 auto_confirm_contracts)
 * 5) 인증하지 않고 끝난 임시 요청서와 첨부 정리, 보존기간 정리
 * 6) 운영자에게 하루치 요약 메일 한 통 (견적 제출·불참·참여는 실시간으로는 앱 알림만 간다)
 * 자동 회신(기관 카탈로그 초안을 기한 당일 예비 견적으로 제출)은 0023 에서 없앴다. 견적은 참여한 기관만 낼 수 있고,
 * 참여는 기관 본인이 눌러야 한다 (save_quote 가 참여 기록 없는 초대를 not_joined 로 거절한다)
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    // 운영에서 CRON_SECRET 이 비어 있으면 Vercel 호출이 매일 조용히 401 로 끝난다. 그 경우만 운영자에게 알린다
    if (isProduction() && !(process.env.CRON_SECRET || "").trim()) {
      captureError(new Error("CRON_SECRET 미설정"), "cron:auth");
      // 이 경로는 인증 없이 열려 있으므로 알림은 하루 한 번만
      if (!(await rateLimited("cron-secret-missing", "global", 1, 86400))) await notifyUsers(await adminUserIds(), { kind: "시스템", title: "예약 작업이 실행되지 않았어요 · CRON_SECRET 미설정", body: "Vercel 환경변수에 CRON_SECRET 을 넣고 다시 배포해 주세요. 리마인더·회신 마감이 멈춰 있어요.", href: "/admin" }, { to: adminEmails() }).catch(() => {});
      return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const today = todaySeoul();
  const part = cronPart(req.url);
  const run = (name: string, fn: () => Promise<void>): Promise<void> => (stepInPart(name, part) ? step(name, out.errors, fn) : Promise.resolve());
  const out = {
    started: 0,
    reminded: 0,
    compared: 0,
    distributed: 0,
    outcomeAsked: 0,
    resent: 0,
    contractReminded: 0,
    contractConfirmed: 0,
    invoiceReminded: 0,
    joinDeadlines: 0,
    lowParticipation: 0,
    extendAsked: 0,
    reoffered: 0,
    pendingCleaned: 0,
    earlyOpenSms: 0,
    crmReminders: 0,
    crmPurge: { marked: 0, cleared: 0, purgedOrgs: 0, rows: 0 },
    digest: false,
    retention: { accessLogs: 0, requests: 0, files: 0, notifications: 0 },
    errors: [] as string[],
  };

  // 속도 제한 카운터 정리 (함수가 아직 없으면 무시)
  await sb.rpc("rate_limit_cleanup").then(({ error }) => { if (error) console.warn("rate_limit_cleanup", error.message); });

  // 0-0) 접수했지만 기관 전달을 시작하지 못한 요청 (위자드가 첨부를 올리다 창을 닫은 경우). 30분 넘게 지난 것만
  await run("start", async () => {
    const before = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: idle } = await sb.from("rfq_requests").select("id").is("started_at", null).eq("status", "received").lt("created_at", before).limit(50);
    for (const r of idle ?? []) if ((await startRfq(r.id)).started) out.started++;
  });

  // 0) 빠진 배포 보충: 승인된 기관 중 열린 요청을 아직 받지 못한 곳
  await run("distribute", async () => {
    out.distributed = (await distributeOpenRfqs()).invites;
  });

  // 0-1) 배포 메일이 안 간 초대 재발송 (Resend 장애 뒤 복구)
  await run("resend", async () => {
    out.resent = (await resendUnmailedInvites()).sent;
  });

  // 0-2) 참여 단계: 참여 결정 기한, 참여 부족, 빈 자리 재안내 (lib/opt-in-cron.ts)
  await run("opt-in", async () => {
    const r = await runOptInSteps(sb, today);
    out.joinDeadlines = r.joinDeadlines;
    out.lowParticipation = r.lowParticipation;
    out.extendAsked = r.extendAsked;
    out.reoffered = r.reoffered;
    out.errors.push(...r.errors);
  });

  // 0-3) 참여한 기관이 모두 제출했고 이제 더 참여할 수 없는 요청의 비교표를 연다 (0025, 2026-10-20 결정 1).
  //      마지막 제출 뒤에 참여 결정 기한이 지난 경우다. DB 가 요청 행을 잠그고 한 번만 연다. 알림도 그때 한 번
  await run("open-ready", async () => {
    const { data: opened, error } = await sb.rpc("open_ready_comparisons");
    if (error) throw new Error(error.message);
    for (const o of opened ?? []) {
      await logEvent(o.rfq_id, "compared", `비교표 공개 · 견적 ${o.submitted}건 (참여 기관 모두 제출)`, undefined, null, { auto: "all" });
      await announceCompareOpened(o.rfq_id, "all", o.submitted);
      out.compared++;
    }
  });

  // 1) 리마인더: 참여한 기관 중 아직 제출하지 않은 곳만 (참여 결정 전 안내·철회·취소에는 보내지 않는다, 0023)
  await run("remind", async () => {
  for (const [kind, day] of [["d2", addDays(today, 2)], ["d0", today]] as const) {
    const { data: invites } = await sb.from("rfq_invites").select("*").eq("reply_by", day).in("status", ["sent", "draft"]);
    for (const inv of (invites ?? []).filter((i) => occupiesSeat(i))) {
      const { data: done } = await sb.from("invite_reminders").select("invite_id").eq("invite_id", inv.id).eq("kind", kind).maybeSingle();
      if (done) continue;
      const { data: rfq } = await sb.from("rfq_requests").select("substance, status, compared_at").eq("id", inv.rfq_id).maybeSingle();
      // 비교표가 열렸거나(compared_at) 선정·종료된 요청에는 "회신해 주세요"를 보내지 않는다
      if (!rfq || repliesClosed(rfq)) continue;
      // 받는 사람은 지금의 대표 메일 + 지금 소속 담당자. 초대의 cro_email(배포 당시 주소)은 떠난 담당자일 수 있어 쓰지 않는다
      const t = inv.cro_org_id ? (await orgMailTargets(sb, [inv.cro_org_id])).get(inv.cro_org_id) : undefined;
      const ids = (t?.members ?? []).map((m) => m.id);
      const mails = inviteMailTo(inv, t);
      const managed = !!t?.managed;
      // 담당자 계정이 없는 기관(운영자 관리 포함)은 로그인 없는 회신 링크로. 계정이 있으면 포털 링크 그대로
      const href = replyPath(inv, { managed, members: ids.length });
      // 운영자 관리 기관의 초안은 운영자가 PDF 를 옮겨 적다 저장한 것일 수 있고, 기관은 PDF 를 이미 메일로 보냈을 수 있다. 초안 여부로 문구를 나누지 않는다
      // 받는 기관은 모두 참여한 기관이므로 시험물질명을 적어도 된다. 제출이 어려우면 철회를 안내한다 (철회하면 청구 없음, 자리는 다른 기관에)
      const withdrawHint = "제출이 어려우면 요청 화면에서 참여를 철회해 주세요. 철회하면 청구하지 않고 자리는 다른 기관에 돌아가요.";
      const body = managed
        ? `참여하신 요청에 아직 제출된 견적이 없어요. 아래 버튼의 회신 링크에서 직접 회신하시거나, 정식 견적서 PDF를 이 메일에 회신으로 보내 주시면 단추가 비교표에 옮겨 적어요. 이미 PDF를 보내셨다면 이 안내는 넘기셔도 돼요. ${withdrawHint}`
        : inv.status === "draft" ? `작성 중인 초안이 있어요. 확인하고 제출해 주세요. ${withdrawHint}` : `참여하신 요청의 견적을 아직 작성하지 않았어요. ${withdrawHint}`;
      await notifyUsers(
        ids,
        { kind: "견적", title: kind === "d2" ? `회신 기한 이틀 전 · ${inv.rfq_no} ${rfq.substance}` : `오늘이 회신 기한이에요 · ${inv.rfq_no} ${rfq.substance}`, body, href },
        { to: mails, replyTo: inviteReplyTo({ managed }) },
      );
      await sb.from("invite_reminders").insert({ invite_id: inv.id, kind });
      out.reminded++;
    }
  }
  });

  // 2) 기한 후 회신 마감 + 의뢰자 요약 (한 번만, lib/compare.ts closeReplies). 제출 0건이면 마감하지 않는다
  await run("close-replies", async () => {
  const { data: rfqs } = await sb.from("rfq_requests").select("*").in("status", ["distributed", "quoted"]).is("compared_at", null).lt("reply_by", today);
  for (const rfq of rfqs ?? []) {
    if (!closeRepliesDue(rfq, today)) continue;
    const r = await closeReplies(rfq, null, true);
    if (r.failed) {
      // 견적 수를 읽지 못했으면 "견적 없음"으로 알리지 않고 다음 실행에 다시 본다
      out.errors.push(`close-replies ${rfq.rfq_no}: ${r.message}`);
      continue;
    }
    if (r.ok) {
      out.compared++;
      // 참여했지만 내지 않은 기관 이름을 적는다 (운영자 앱 알림만, 하루 요약 메일에 모인다).
      // 비교표가 열린 뒤에는 다시 열거나 기한을 늘릴 수 없으므로(2026-10-21 결정 3) 늦게 온 견적서 PDF 는 옮겨 적지 않는다
      const names = r.pendingNames?.length ? `미회신: ${r.pendingNames.join(", ")}. 비교표가 열린 뒤 도착한 견적서 PDF는 비교표에 옮겨 적지 않아요.` : undefined;
      await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 비교표 공개 · 견적 ${r.count}건${r.pending ? ` · 미회신 ${r.pending}곳` : ""}`, body: names, href: `/admin/r/${rfq.rfq_no}` });
    } else if (!r.count) {
      // 회신이 하나도 없으면 열지 않고(늦은 회신을 받을 수 있게) 운영자에게 판단을 넘긴다. 같은 기한에는 한 번만 (기한을 늘렸다 다시 지나면 다시 알린다)
      // 0019 전 기록은 meta 에 기한이 없다. 기한이 지난 뒤 남은 기록이면 같은 기한의 안내로 본다 (lib/reply-window.ts noReplyNotified)
      const { data: ev, error: evErr } = await sb.from("rfq_events").select("created_at, meta").eq("rfq_id", rfq.id).eq("kind", "no_reply");
      if (evErr) {
        out.errors.push(`close-replies ${rfq.rfq_no}: ${evErr.message}`);
        continue;
      }
      if (!noReplyNotified(ev ?? [], rfq.reply_by ?? "")) {
        await logEvent(rfq.id, "no_reply", "기한 경과 · 회신 없음", "참여 안내 추가 또는 기한 연장 판단 필요", null, { reply_by: rfq.reply_by });
        await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 기한 경과 · 회신 없음`, body: "제출된 견적이 없어 비교표를 열지 않았어요. 의뢰자와 상의해 회신 기한을 늘리고, 필요하면 참여 안내를 추가해 주세요.", href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
        // 의뢰자에게도 한 번: 기다리는 이유와 선택지
        await notifyUsers(rfq.user_id ? [rfq.user_id] : [], { kind: "비교", title: `${rfq.rfq_no} 회신 기한이 지났지만 아직 견적이 없어요`, body: `${rfq.substance} · 운영자가 회신 기한 연장과 참여 안내 추가를 안내해요. 진행을 원하지 않으시면 요청 화면에서 마무리할 수 있어요.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
      }
    }
  }
  });

  // 4) 회신 마감 14일 뒤에도 선정도 마무리도 없는 요청: 의뢰자에게 한 번 묻는다
  //    선정 버튼을 누르지 않은 요청이 어디로 갔는지 알아야 청구 명세의 선정률과 성사수수료가 맞는다
  await run("outcome-ask", async () => {
  const asked = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: idle } = await sb.from("rfq_requests").select("id, rfq_no, user_id, substance").eq("status", "compared").is("selected_quote_id", null).is("outcome", null).lt("compared_at", asked);
  for (const rfq of idle ?? []) {
    const { data: ev } = await sb.from("rfq_events").select("id").eq("rfq_id", rfq.id).eq("kind", "outcome_asked").maybeSingle();
    if (ev || !rfq.user_id) continue;
    await notifyUsers([rfq.user_id], { kind: "비교", title: `${rfq.rfq_no} 기관을 정하셨나요?`, body: `${rfq.substance} 회신이 마감된 지 2주가 지났어요. 비교표에서 기관을 선정하거나, 다른 경로로 진행·보류하신 경우 요청 화면에서 알려 주세요.`, href: `/app/r/${rfq.rfq_no}` });
    await logEvent(rfq.id, "outcome_asked", "선정 여부 확인 요청", "회신 마감 14일 경과", null);
    out.outcomeAsked++;
  }
  });

  // 4-1) 선정 뒤 계약 보고가 없는 수주: 기관에 14·30일 리마인더, 45일에는 운영자·의뢰자에게 진행 여부를 묻는다
  //      성사수수료는 선정 견적 5,000만 원 이상이 체결(signed)로 확인된 계약에만, 계약 금액 기준으로 붙는다 (0020).
  //      체결 확인한 달에 정산하므로, 보고 누락이 곧 매출 누락이다
  await run("contract-remind", async () => {
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    // 마지막 단계(45일)에 15일 여유를 둔 60일 창. 미체결로 기록했거나 이미 마지막 단계를 지난 오래된 수주가 창을 채워 새 수주를 밀어내지 않게 한다
    const horizon = new Date(Date.now() - 60 * 864e5).toISOString();
    const { data: awards } = await sb
      .from("rfq_awards")
      .select("id, rfq_id, cro_org_id, invite_id, cro_name, awarded_at, contract_reported_at, contract_status, sponsor_reported_at")
      .is("contract_reported_at", null)
      .neq("contract_status", "not_signed")
      .lt("awarded_at", since)
      .gte("awarded_at", horizon)
      .order("awarded_at")
      .limit(200);
    for (const a of awards ?? []) {
      // 운영자가 미체결로 기록한 수주는 더 묻지 않는다
      if (!needsContractReminder(a)) continue;
      const days = daysSince(a.awarded_at);
      const stage = reminderStage(a.awarded_at);
      if (!stage) continue;
      const { data: rfq } = await sb.from("rfq_requests").select("rfq_no, substance, user_id, email, status").eq("id", a.rfq_id).maybeSingle();
      if (!rfq || ["closed", "cancelled"].includes(rfq.status)) continue;
      // 21일: 의뢰자에게도 계약 결과를 묻는다 (0034, 우회 계약 방지). 기관 보고와 따로 남아 서로 다르면 운영자가 확인한다.
      // 단계 리마인더와 따로 한 번만 (sponsor_asked)
      if (rfq.user_id && shouldAskSponsor({ awardedAt: a.awarded_at, contractReportedAt: a.contract_reported_at, contractStatus: a.contract_status, sponsorReportedAt: a.sponsor_reported_at ?? null })) {
        const { data: asked } = await sb.from("rfq_events").select("id").eq("rfq_id", a.rfq_id).eq("kind", "sponsor_asked").maybeSingle();
        if (!asked) {
          await notifyUsers(
            [rfq.user_id],
            { kind: "계약", title: `${rfq.rfq_no} 선정한 기관과 계약은 어떻게 됐나요?`, body: `${rfq.substance} · ${a.cro_name}. 계약했는지, 협의 중인지, 진행하지 않기로 했는지 요청 화면에서 알려 주세요.`, href: `/app/r/${rfq.rfq_no}#contract-result` },
            { to: [rfq.email] },
            { kind: "contract", text: `${rfq.rfq_no} 선정한 기관과 계약은 어떻게 됐나요? 요청 화면에서 알려 주세요. ${siteUrl()}/app/r/${rfq.rfq_no}`, dedupeKey: `sponsor_asked:${a.id}` },
          );
          await logEvent(a.rfq_id, "sponsor_asked", "의뢰자에게 계약 결과 확인 요청", `선정 ${days}일 경과`, null);
        }
      }
      const { data: ev } = await sb.from("rfq_events").select("id").eq("rfq_id", a.rfq_id).eq("kind", stage).maybeSingle();
      if (ev) continue;
      if (stage === "contract_asked") {
        await notifyUsers(await adminUserIds(), { kind: "계약", title: `${rfq.rfq_no} 선정 45일 경과 · 계약 보고 없음`, body: `${a.cro_name} 이 계약 체결을 보고하지 않았어요. 기관과 의뢰자에게 진행 여부를 확인하고 요청 화면의 계약 결과 기록에 남겨 주세요.`, href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
        if (rfq.user_id && !a.sponsor_reported_at) await notifyUsers([rfq.user_id], { kind: "계약", title: `${rfq.rfq_no} 계약이 진행되고 있나요?`, body: `${rfq.substance} · ${a.cro_name} 을 선정한 지 45일이 지났어요. 계약했는지, 진행하지 않기로 했는지 요청 화면에서 알려 주세요.`, href: `/app/r/${rfq.rfq_no}#contract-result` }, { to: [rfq.email] });
        await logEvent(a.rfq_id, stage, "계약 진행 여부 확인 요청", "선정 45일 경과", null);
      } else {
        const [{ data: org }, { data: members }] = a.cro_org_id
          ? await Promise.all([
              sb.from("cro_orgs").select("managed, contact_email").eq("id", a.cro_org_id).maybeSingle(),
              sb.from("profiles").select("id, email").eq("cro_org_id", a.cro_org_id),
            ])
          : [{ data: null }, { data: [] as { id: string; email: string | null }[] }];
        const ids = (members ?? []).map((m) => m.id as string);
        if (org?.managed || !ids.length) {
          // 운영자 관리 기관이나 담당자 계정이 없는 기관: 앱 알림을 못 받고 포털도 열 수 없다. 대표 이메일로 계약 진행 상황을 묻고 회신은 운영자가 받는다 (로그인 링크 없음)
          // 선정 메일이 "운영자가 메일로 여쭙겠다"고 안내한 대상과 같다 (app/api/rfq/[no]/select/route.ts)
          // 기관 수주는 지금의 대표 메일로만. 초대의 cro_email 은 기관이 없는 예전 초대에만 쓴다 (떠난 담당자 주소일 수 있다)
          const { data: inv } = !a.cro_org_id && a.invite_id ? await sb.from("rfq_invites").select("cro_email").eq("id", a.invite_id).maybeSingle() : { data: null };
          const to = await notificationRecipients([org?.contact_email || inv?.cro_email || ""].filter(Boolean));
          if (!to.length) continue;
          const m = contractFollowupMail({ rfqNo: rfq.rfq_no, substance: rfq.substance, croName: a.cro_name, days, awardedOn: new Date(a.awarded_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) });
          // 보내지 못하면 이력을 남기지 않아 다음 날 다시 시도한다 (같은 단계는 이력이 있으면 건너뛴다)
          if (!(await sendMail({ to, subject: m.subject, html: m.html, replyTo: operatorReplyTo() }))) continue;
          await logEvent(a.rfq_id, stage, `계약 진행 확인 메일 (${org?.managed ? "운영자 관리 기관" : "담당자 계정 없음"})`, `선정 ${days}일 경과`, null, { to: to.length });
          out.contractReminded++;
          continue;
        }
        // 앱에 자주 들어오지 않는 기관도 있어 담당자·대표 메일로도 보낸다 (14일, 30일 두 번. 흐름 재설계 디자인 2d783db).
        // 받는 사람은 지금의 대표 메일 + 지금 소속 담당자. 메일 수신을 끈 사람은 notifyUsers 가 뺀다
        const mails = [...new Set([org?.contact_email, ...(members ?? []).map((m) => m.email)].filter((x): x is string => !!x && !!x.trim()))];
        await notifyUsers(ids, { kind: "계약", title: `${rfq.rfq_no} 계약 체결을 보고해 주세요`, body: `${rfq.substance} · 선정 ${days}일 경과. 계약을 맺었다면 체결일과 금액을, 진행하지 않게 되었다면 단추(limjm900202@gmail.com)에 알려 주세요.`, href: "/cro/awards" }, mails.length ? { to: mails, replyTo: operatorReplyTo() } : undefined);
        await logEvent(a.rfq_id, stage, "계약 보고 리마인더", `선정 ${days}일 경과`, null);
      }
      out.contractReminded++;
    }
  });

  // 4-2) 계약 보고 뒤 확인 기한(7일)이 지났고 이의가 없으면 보고 내용대로 확정하고 요청을 마친다 (0025 auto_confirm_contracts, 2026-10-20 결정 2).
  //      확인 열은 DB 함수만 쓴다. 이의가 정리되지 않은 계약은 확정하지 않는다. 성사수수료는 확정한 달에 정산한다
  await run("contract-confirm", async () => {
    const { data: rows, error } = await sb.rpc("auto_confirm_contracts");
    if (error) throw new Error(error.message);
    for (const a of rows ?? []) {
      const summary = `체결일 ${a.contract_date ?? "-"} · ${won(a.contract_amount ?? 0)}`;
      await logEvent(a.rfq_id, "closed", "계약 확인 기한 경과 · 자동 확정 · 종료", summary, null, { auto: true, via: "auto" });
      if (a.user_id) await notifyUsers([a.user_id], { kind: "계약", title: `${a.rfq_no} 계약 내용을 보고대로 확정했어요`, body: `${a.cro_name} · ${summary}. 확인 기한 안에 이의가 없어 보고 내용대로 확정하고 요청을 마쳤어요. 실제와 다르면 요청 화면의 문의하기로 알려 주세요.`, href: `/app/r/${a.rfq_no}` });
      if (a.cro_org_id) {
        const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", a.cro_org_id);
        await notifyUsers((ms ?? []).map((m) => m.id as string), { kind: "계약", title: `${a.rfq_no} 계약 내용이 확정됐어요`, body: `${summary} · 요청을 마쳤어요.`, href: "/cro/awards" });
      }
      out.contractConfirmed++;
    }
  });

  // 4-3) 청구서 납부 안내 (0032): 보낸 청구서 중 미납만. 기한 3일 전, 다음 날, 7일 뒤, 30일 뒤에 한 번씩.
  //      30일 뒤에는 운영자에게도 알린다 (이용 제한은 운영자가 정한다). 단계를 먼저 올려 두 번 보내지 않는다
  await run("invoice-remind", async () => {
    const { data: rows, error } = await sb.from("billing_invoices").select("*").eq("status", "issued").not("sent_at", "is", null);
    if (error) throw new Error(error.message);
    for (const inv of (rows ?? []) as BillingInvoiceRow[]) {
      const stage = reminderStageFor(inv.due_date, today, inv.reminder_stage);
      if (!stage) continue;
      const { data: claimed } = await sb.rpc("mark_invoice_reminded", { p_id: inv.id, p_stage: stage });
      if (!claimed) continue;
      await deliverInvoice(inv, stage === 1 ? "reminder_before" : "overdue");
      if (stage === 4) {
        await notifyUsers(await adminUserIds(), { kind: "기관", title: `${inv.org_name} 청구서 ${inv.invoice_no}가 30일 넘게 미납이에요`, body: `합계 ${inv.total.toLocaleString("ko-KR")}원 · 기한 ${inv.due_date}`, href: `/admin/invoices?month=${inv.month.slice(0, 7)}` });
      }
      out.invoiceReminded++;
    }
  });

  // 6) 운영자 하루 요약 메일. 견적 제출·회신하지 않음은 실시간으로는 앱 알림만 보내고 여기서 모은다
  // 기관 CRM 일정·할 일 알림 (0038). 매일 09:00 KST 한 번 돈다: 내일 일정은 오늘 아침, 오늘 기한 할 일은 오늘 아침에 알린다.
  // 먼저 reminded_at / notified_on 을 채워(잡기) 두 번 보내지 않는다. 받는 사람이 그 기관을 떠났으면 보내지 않는다. 표가 없으면(0038 전) 건너뛴다
  await run("crm-reminders", async () => {
    const tomorrow = addDays(today, 1);
    const from = new Date(`${tomorrow}T00:00:00+09:00`).toISOString();
    const to = new Date(`${addDays(today, 2)}T00:00:00+09:00`).toISOString();
    const { data: evs, error } = await sb.from("cro_crm_events").select("id, org_id, company_id, title, starts_at, all_day, location, mode, attendee_members, created_by").eq("remind", true).is("reminded_at", null).is("done_at", null).gte("starts_at", from).lt("starts_at", to).limit(300);
    if (error) { console.warn("crm-reminders", error.message); return; }
    const { data: tasks } = await sb.from("cro_crm_tasks").select("id, org_id, company_id, title, assignee, created_by").is("done_at", null).eq("due_on", today).or(`notified_on.is.null,notified_on.neq.${today}`).limit(300);
    const people = new Set<string>();
    for (const e of evs ?? []) for (const id of [e.created_by, ...e.attendee_members]) if (id) people.add(id);
    for (const t of tasks ?? []) { const id = t.assignee ?? t.created_by; if (id) people.add(id); }
    const companyIds = [...new Set([...(evs ?? []), ...(tasks ?? [])].map((x) => x.company_id).filter((x): x is string => !!x))];
    const [{ data: ps }, { data: cos }] = await Promise.all([
      people.size ? sb.from("profiles").select("id, email, cro_org_id").in("id", [...people]) : Promise.resolve({ data: [] as { id: string; email: string; cro_org_id: string | null }[] }),
      companyIds.length ? sb.from("cro_crm_companies").select("id, name").in("id", companyIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const pBy = new Map((ps ?? []).map((p) => [p.id, p]));
    const coBy = new Map((cos ?? []).map((c) => [c.id, c.name]));
    const inOrg = (ids: (string | null)[], org: string) => [...new Set(ids.filter((x): x is string => !!x))].filter((id) => pBy.get(id)?.cro_org_id === org);
    const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
    const MODE: Record<string, string> = { in_person: "대면", video: "화상", phone: "전화" };
    for (const e of evs ?? []) {
      const { data: claimed } = await sb.from("cro_crm_events").update({ reminded_at: new Date().toISOString() }).eq("id", e.id).is("reminded_at", null).select("id");
      if (!claimed?.length) continue;
      const ids = inOrg([e.created_by, ...e.attendee_members], e.org_id);
      if (!ids.length) continue;
      const co = e.company_id ? coBy.get(e.company_id) ?? "" : "";
      const body = [`내일 ${e.all_day ? "하루 종일" : hm(e.starts_at)}`, co, e.mode ? MODE[e.mode] ?? "" : "", e.location].filter(Boolean).join(" · ");
      await notifyUsers(ids, { kind: "기관", title: `내일 일정 · ${e.title}`, body, href: `/cro/calendar?w=${tomorrow}&e=${e.id}` }, { to: ids.map((id) => pBy.get(id)?.email ?? "").filter(Boolean), subject: `[단추] 내일 일정 · ${e.title}` });
      out.crmReminders++;
    }
    for (const t of tasks ?? []) {
      const { data: claimed } = await sb.from("cro_crm_tasks").update({ notified_on: today }).eq("id", t.id).or(`notified_on.is.null,notified_on.neq.${today}`).select("id");
      if (!claimed?.length) continue;
      const ids = inOrg([t.assignee ?? t.created_by], t.org_id);
      if (!ids.length) continue;
      const co = t.company_id ? coBy.get(t.company_id) ?? "" : "";
      await notifyUsers(ids, { kind: "기관", title: `오늘까지 할 일 · ${t.title}`, body: co || undefined, href: t.company_id ? `/cro/clients/${t.company_id}?tab=tasks` : "/cro/calendar" }, { to: ids.map((id) => pBy.get(id)?.email ?? "").filter(Boolean), subject: `[단추] 오늘까지 할 일 · ${t.title}` });
      out.crmReminders++;
    }
  });

  await run("digest", async () => {
    const since = new Date(Date.now() - 864e5).toISOString();
    const { data: evs } = await sb.from("rfq_events").select("kind, rfq_id, title, created_at").gte("created_at", since).in("kind", ["received", "joined", "quote_submitted", "declined", "withdrawn", "compared", "selected", "contract", "closed", "outcome"]).order("created_at").limit(1000);
    const count = (k: string) => (evs ?? []).filter((e) => e.kind === k).length;
    const attention: string[] = [];
    // 전달할 기관을 못 찾은 요청
    const { data: noMatch } = await sb.from("rfq_requests").select("id, rfq_no, substance").eq("status", "received").not("started_at", "is", null).limit(50);
    for (const r of noMatch ?? []) attention.push(`${r.rfq_no} ${r.substance} · 전달할 기관을 정해 주세요`);
    // 내일이 마감인데 아직 회신이 하나도 없는 요청
    const { data: soon } = await sb.from("rfq_requests").select("id, rfq_no, substance").in("status", ["distributed"]).eq("reply_by", addDays(today, 1)).limit(50);
    for (const r of soon ?? []) attention.push(`${r.rfq_no} ${r.substance} · 내일 마감, 아직 회신 없음`);
    // 의뢰자가 계약 보고에 이의를 남긴 수주
    // 의뢰자가 계약 보고에 이의를 남겼고 아직 정리하지 않은 수주 (정리 전에는 확정·정산하지 않는다)
    const { data: disputes } = await sb.from("rfq_awards").select("cro_name, requester_dispute_note, rfq_id").not("requester_disputed_at", "is", null).is("dispute_resolved_at", null).is("contract_confirmed_at", null).limit(50);
    for (const d of disputes ?? []) attention.push(`${d.cro_name} 계약 보고 이의 · ${d.requester_dispute_note ?? ""} · 수주·계약 화면에서 정리해 주세요`);
    // 접수했지만 기관 전달을 시작하지 못한 요청 (첨부 업로드가 끝나지 않음, 1일 경과)
    const { data: unstarted } = await sb.from("rfq_requests").select("rfq_no, substance").is("started_at", null).eq("status", "received").lt("created_at", since).limit(50);
    for (const r of unstarted ?? []) attention.push(`${r.rfq_no} ${r.substance} · 참여 안내 전 (첨부 확인 필요)`);
    const lines = [
      ["새 요청", count("received")],
      ["참여", count("joined")],
      ["견적 제출", count("quote_submitted")],
      ["불참", count("declined")],
      ["참여 철회", count("withdrawn")],
      ["비교표 공개", count("compared")],
      ["기관 선택", count("selected")],
      ["계약 보고·이의", count("contract")],
      ["마무리", count("closed")],
    ].filter(([, n]) => (n as number) > 0) as [string, number][];
    if (!lines.length && !attention.length) return;
    const to = adminEmails();
    if (!to.length) return;
    const html = mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">어제 단추에서 있었던 일</h2>
      ${lines.length ? `<ul style="padding-left:20px;margin:0 0 20px">${lines.map(([k, n]) => `<li>${esc(k)} ${n}건</li>`).join("")}</ul>` : `<p>새로 들어온 요청과 견적은 없어요.</p>`}
      ${attention.length ? `<h3 style="font-size:16px;margin:0 0 8px">확인이 필요한 일 ${attention.length}건</h3><ul style="padding-left:20px;margin:0 0 20px">${attention.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p><a href="${siteUrl()}/admin">운영 화면 열기</a></p>`);
    out.digest = await sendMail({ to, subject: `[단추] ${today} 하루 요약${attention.length ? ` · 확인할 일 ${attention.length}건` : ""}`, html });
  });

  // 5-0) 보내기 직전 가입에서 인증하지 않고 끝난 임시 요청서(7일)와 첨부, 그 때문에 만들어졌지만 확인하지 않은 계정,
  //      접수로 바뀐 지 30일 지난 임시 기록 정리 (lib/rfq-pending.ts cleanupPending). 임시 첨부는 기관에게 보이지 않는다 (0025)
  await run("pending-cleanup", async () => {
    out.pendingCleaned = (await cleanupPending()).pending;
  });

  // 4-9) 시범 운영 시작 문자 (0035): 2027-06-01 부터 사전예약한 번호에 한 번씩. 솔라피 개인 계정 하루 한도가 있어 하루 300건씩 나눠 보낸다
  if (today >= EARLY_OPEN_DATE) {
    await run("early-open-sms", async () => {
      const { data } = await sb.from("early_signups").select("id, role, phone").is("open_sms_at", null).not("phone", "is", null).order("created_at").limit(300);
      for (const r of (data ?? []) as { id: string; role: EarlyRole; phone: string }[]) {
        const st = await smsPhone(r.phone, { kind: "early", text: earlyOpenSms(r.role) });
        if (st === "skipped") break; // 키가 없으면 그만 (다음 실행 때 다시)
        await sb.from("early_signups").update({ open_sms_at: new Date().toISOString() }).eq("id", r.id);
        if (st === "sent") out.earlyOpenSms++;
      }
    });
  }

  // 5) 보존기간 정리: 접속 기록 90일, 요청서 3년, 읽은 알림 180일 (개인정보처리방침 3항)
  await run("retention", async () => {
    out.retention = await runRetention(sb);
  });

  // 5-1) 담당자 계정이 모두 탈퇴한 기관의 CRM 자료: 30일 뒤 지운다 (0040, 처리방침 "기관이 맡긴 개인정보의 처리")
  await run("crm-purge", async () => {
    out.crmPurge = await purgeLeftOrgCrm(sb);
  });

  // 실패한 단계가 있으면 운영자에게 알린다. 응답 JSON 은 아무도 읽지 않는다
  if (out.errors.length) {
    await notifyUsers(await adminUserIds(), { kind: "시스템", title: `예약 작업 일부 실패 · ${out.errors.length}건`, body: `${today} 09:00 실행 중 실패한 단계:\n${out.errors.join("\n")}\n\n같은 작업은 다음 실행 때 다시 시도해요. 반복되면 Sentry 또는 Vercel 로그를 확인해 주세요.`, href: "/admin" }, { to: adminEmails() }).catch((e) => captureError(e, "cron:notify"));
  }

  return NextResponse.json({ ok: out.errors.length === 0, today, part: part ?? "all", ...out });
}
