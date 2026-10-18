import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { publishCompare } from "@/lib/compare";
import { distributeOpenRfqs, resendUnmailedInvites } from "@/lib/distribute";
import { loadByInvite } from "@/lib/quote-load";
import { todaySeoul } from "@/lib/format";
import { won } from "@/lib/format";
import { saveQuote, type QuoteItemInput } from "@/lib/rpc";
import { captureError } from "@/lib/observe";
import { autoReplyEnabled, isProduction } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";
import { runRetention } from "@/lib/retention";
import { daysSince, reminderStage } from "@/lib/contract-reminder";
import { startRfq } from "@/lib/rfq-create";
import { esc, mailWrap, sendMail } from "@/lib/mail";
import { siteUrl } from "@/lib/notify";

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
 * 매일 09:00 KST 실행 (vercel.json crons).
 * 0) 위자드가 시작하지 못한 접수(첨부 업로드 중 창을 닫는 등)를 대신 시작, 빠진 배포 보충, 메일 재발송
 * 1) 미회신 기관에 D-2·당일 리마인더
 * 2) 자동 회신을 켠 기관의 완성된 초안을 기한 당일 예비 견적으로 제출
 * 3) 회신 기한이 지난 요청의 비교표 자동 공개 (제출 1건 이상)
 * 4) 선정 여부 확인, 계약 보고 리마인더, 계약 보고 7일 뒤 자동 확정
 * 6) 운영자에게 하루치 요약 메일 한 통 (견적·회신하지 않음은 실시간으로는 앱 알림만 간다)
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    // 운영에서 CRON_SECRET 이 비어 있으면 Vercel 호출이 매일 조용히 401 로 끝난다. 그 경우만 운영자에게 알린다
    if (isProduction() && !(process.env.CRON_SECRET || "").trim()) {
      captureError(new Error("CRON_SECRET 미설정"), "cron:auth");
      // 이 경로는 인증 없이 열려 있으므로 알림은 하루 한 번만
      if (!(await rateLimited("cron-secret-missing", "global", 1, 86400))) await notifyUsers(await adminUserIds(), { kind: "시스템", title: "예약 작업이 실행되지 않았습니다 · CRON_SECRET 미설정", body: "Vercel 환경변수에 CRON_SECRET 을 넣고 다시 배포해 주세요. 리마인더·비교표 자동 공개가 멈춰 있습니다.", href: "/admin" }, { to: adminEmails() }).catch(() => {});
      return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 });
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const today = todaySeoul();
  const out = { started: 0, reminded: 0, autoSubmitted: 0, compared: 0, distributed: 0, outcomeAsked: 0, resent: 0, contractReminded: 0, contractConfirmed: 0, digest: false, retention: { accessLogs: 0, requests: 0, files: 0, notifications: 0 }, errors: [] as string[] };

  // 속도 제한 카운터 정리 (함수가 아직 없으면 무시)
  await sb.rpc("rate_limit_cleanup").then(({ error }) => { if (error) console.warn("rate_limit_cleanup", error.message); });

  // 0-0) 접수했지만 기관 전달을 시작하지 못한 요청 (위자드가 첨부를 올리다 창을 닫은 경우). 30분 넘게 지난 것만
  await step("start", out.errors, async () => {
    const before = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: idle } = await sb.from("rfq_requests").select("id").is("started_at", null).eq("status", "received").lt("created_at", before).limit(50);
    for (const r of idle ?? []) if ((await startRfq(r.id)).started) out.started++;
  });

  // 0) 빠진 배포 보충: 승인된 기관 중 열린 요청을 아직 받지 못한 곳
  await step("distribute", out.errors, async () => {
    out.distributed = (await distributeOpenRfqs()).invites;
  });

  // 0-1) 배포 메일이 안 간 초대 재발송 (Resend 장애 뒤 복구)
  await step("resend", out.errors, async () => {
    out.resent = (await resendUnmailedInvites()).sent;
  });

  // 1) 리마인더
  await step("remind", out.errors, async () => {
  for (const [kind, day] of [["d2", addDays(today, 2)], ["d0", today]] as const) {
    const { data: invites } = await sb.from("rfq_invites").select("*").eq("reply_by", day).in("status", ["sent", "draft"]);
    for (const inv of invites ?? []) {
      const { data: done } = await sb.from("invite_reminders").select("invite_id").eq("invite_id", inv.id).eq("kind", kind).maybeSingle();
      if (done) continue;
      const { data: rfq } = await sb.from("rfq_requests").select("substance, status").eq("id", inv.rfq_id).maybeSingle();
      if (!rfq || ["selected", "contracting", "closed", "cancelled"].includes(rfq.status)) continue;
      let ids: string[] = [];
      let mails: string[] = [inv.cro_email];
      if (inv.cro_org_id) {
        const { data: ms } = await sb.from("profiles").select("id, email").eq("cro_org_id", inv.cro_org_id);
        ids = (ms ?? []).map((m) => m.id as string);
        mails = [...new Set([inv.cro_email, ...(ms ?? []).map((m) => m.email as string)])];
      }
      await notifyUsers(
        ids,
        { kind: "견적", title: kind === "d2" ? `회신 기한 이틀 전 · ${inv.rfq_no} ${rfq.substance}` : `오늘이 회신 기한입니다 · ${inv.rfq_no} ${rfq.substance}`, body: inv.status === "draft" ? "작성 중인 초안이 있습니다. 확인하고 제출해 주세요." : "아직 회신하지 않았습니다. 회신하지 않을 경우 '회신하지 않음'으로 처리해 주시면 의뢰자에게 안내됩니다.", href: `/cro/r/${inv.id}` },
        { to: mails },
      );
      await sb.from("invite_reminders").insert({ invite_id: inv.id, kind });
      out.reminded++;
    }
  }
  });

  // 2) 자동 회신 (기한 당일, auto_reply 기관, 초안이 확인 필요 없이 완성된 경우)
  await step("auto-reply", out.errors, async () => {
  if (!autoReplyEnabled()) return; // 출시 범위 밖 (lib/env.ts 참고)
  const { data: autoOrgs } = await sb.from("cro_orgs").select("id").eq("auto_reply", true);
  const autoIds = (autoOrgs ?? []).map((o) => o.id as string);
  if (autoIds.length) {
    const { data: invites } = await sb.from("rfq_invites").select("*").eq("reply_by", today).in("status", ["sent", "draft"]).in("cro_org_id", autoIds);
    for (const inv of invites ?? []) {
      try {
        const got = await loadByInvite(inv);
        if (!got || got.closed || got.expired) continue;
        const d = got.draft;
        if (!d || d.status === "submitted") continue;
        const complete = d.items.length > 0 && d.items.every((it) => it.avail === "불가" ? !!it.reason : it.avail === "가능" && it.amount && it.weeks && !(it.checks && it.checks.length));
        if (!complete || d.items.every((it) => it.avail === "불가")) continue;
        const total = d.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0);
        const weeks = Math.max(0, ...d.items.map((it) => (it.avail !== "불가" && it.weeks ? Number(it.weeks) : 0)));
        const valid = d.common.validUntil || addDays(today, 30);
        const rows = got.rfq.rows;
        const items: QuoteItemInput[] = d.items.map((it) => {
          const r = rows.find((x) => x.seq === it.seq)!;
          return { seq: it.seq, category: r.category, name: r.name, cond: r.cond, avail: it.avail || null, amount: it.avail !== "불가" && it.amount ? Number(it.amount) : null, weeks: it.avail !== "불가" && it.weeks ? Number(it.weeks) : null, reason: it.reason || null, design: it.design ?? {}, source: it.source ?? "catalog", unit: it.unit ?? "total", unit_price: it.unitPrice ? Number(it.unitPrice) : null, sample_count: it.sampleCount ? Number(it.sampleCount) : null };
        });
        const saved = await saveQuote(inv.id, { total_amount: total || null, total_weeks: weeks || null, vat: "별도", valid_until: valid, auto: true, start_date: d.common.startDate || null, pay_terms: null, substance_qty: null, report_lang: null, includes: d.common.includes, note: d.note }, items, true, null);
        if (!saved.ok) throw new Error(`save_quote ${saved.code}`);
        const q = { id: saved.quote_id };
        const { data: r } = await sb.from("rfq_requests").select("user_id").eq("id", inv.rfq_id).maybeSingle();
        await logEvent(inv.rfq_id, "quote_submitted", `${inv.cro_name} 예비 견적 자동 제출`, `총 ${won(total)} · ${weeks}주`, null, { quoteId: q.id, auto: true });
        if (r?.user_id) await notifyUsers([r.user_id], { kind: "견적", title: `예비 견적이 도착했습니다 · ${inv.rfq_no}`, body: `${inv.cro_name} · 카탈로그 기준 자동 회신`, href: `/app/r/${inv.rfq_no}` });
        out.autoSubmitted++;
      } catch (e) {
        captureError(e, "cron:auto-reply", { invite: inv.id, rfq: inv.rfq_no });
        out.errors.push(`auto:${inv.rfq_no}`);
      }
    }
  }
  });

  // 3) 기한 후 비교표 자동 공개
  await step("compare", out.errors, async () => {
  const { data: rfqs } = await sb.from("rfq_requests").select("*").in("status", ["distributed", "quoted"]).is("compared_at", null).lt("reply_by", today);
  for (const rfq of rfqs ?? []) {
    const r = await publishCompare(rfq, null, "deadline");
    if (r.ok) {
      out.compared++;
      await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 비교표 자동 공개 · ${r.count}건`, href: `/admin/r/${rfq.rfq_no}` });
    } else {
      // 회신이 하나도 없으면 운영자에게 재배포 판단을 넘긴다. 같은 기한에는 한 번만 (기한을 늘렸다 다시 지나면 다시 알린다)
      const { data: ev } = await sb.from("rfq_events").select("id").eq("rfq_id", rfq.id).eq("kind", "no_reply").contains("meta", { reply_by: rfq.reply_by }).limit(1);
      if (!ev?.length) {
        await logEvent(rfq.id, "no_reply", "기한 경과 · 회신 없음", "재배포 또는 기한 연장 판단 필요", null, { reply_by: rfq.reply_by });
        await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 기한 경과 · 회신 없음`, body: "재배포하거나 기한을 연장해 주세요.", href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
        // 의뢰자에게도 한 번: 기다리는 이유와 선택지
        await notifyUsers(rfq.user_id ? [rfq.user_id] : [], { kind: "비교", title: `${rfq.rfq_no} 회신 기한이 지났지만 아직 견적이 없습니다`, body: `${rfq.substance} · 운영자가 기한을 늘려 다시 전달하거나 기관을 추가합니다. 진행을 원하지 않으시면 요청 화면에서 마무리할 수 있습니다.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
      }
    }
  }
  });

  // 4) 비교표 공개 14일 뒤에도 선정도 마무리도 없는 요청: 의뢰자에게 한 번 묻는다
  //    선정 버튼을 누르지 않은 요청이 어디로 갔는지 알아야 전달 명세와 선정률이 맞는다
  await step("outcome-ask", out.errors, async () => {
  const asked = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: idle } = await sb.from("rfq_requests").select("id, rfq_no, user_id, substance").eq("status", "compared").is("selected_quote_id", null).is("outcome", null).lt("compared_at", asked);
  for (const rfq of idle ?? []) {
    const { data: ev } = await sb.from("rfq_events").select("id").eq("rfq_id", rfq.id).eq("kind", "outcome_asked").maybeSingle();
    if (ev || !rfq.user_id) continue;
    await notifyUsers([rfq.user_id], { kind: "비교", title: `${rfq.rfq_no} 기관을 정하셨나요?`, body: `${rfq.substance} 비교표가 공개된 지 2주가 지났습니다. 비교표에서 기관을 선정하거나, 다른 경로로 진행·보류하신 경우 요청 화면에서 알려 주세요.`, href: `/app/r/${rfq.rfq_no}` });
    await logEvent(rfq.id, "outcome_asked", "선정 여부 확인 요청", "비교표 공개 14일 경과", null);
    out.outcomeAsked++;
  }
  });

  // 4-1) 선정 뒤 계약 보고가 없는 수주: 기관에 14·30일 리마인더, 45일에는 운영자·의뢰자에게 진행 여부를 묻는다
  //      성사수수료는 보고된 계약에만 붙으므로, 보고 누락이 곧 매출 누락이다
  await step("contract-remind", out.errors, async () => {
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const { data: awards } = await sb.from("rfq_awards").select("id, rfq_id, cro_org_id, cro_name, awarded_at").is("contract_reported_at", null).lt("awarded_at", since).order("awarded_at").limit(100);
    for (const a of awards ?? []) {
      const days = daysSince(a.awarded_at);
      const stage = reminderStage(a.awarded_at);
      if (!stage) continue;
      const { data: rfq } = await sb.from("rfq_requests").select("rfq_no, substance, user_id, email, status").eq("id", a.rfq_id).maybeSingle();
      if (!rfq || ["closed", "cancelled"].includes(rfq.status)) continue;
      const { data: ev } = await sb.from("rfq_events").select("id").eq("rfq_id", a.rfq_id).eq("kind", stage).maybeSingle();
      if (ev) continue;
      if (stage === "contract_asked") {
        await notifyUsers(await adminUserIds(), { kind: "계약", title: `${rfq.rfq_no} 선정 45일 경과 · 계약 보고 없음`, body: `${a.cro_name} 이 계약 체결을 보고하지 않았습니다. 기관과 의뢰자에게 진행 여부를 확인해 주세요.`, href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
        if (rfq.user_id) await notifyUsers([rfq.user_id], { kind: "계약", title: `${rfq.rfq_no} 계약이 진행되고 있나요?`, body: `${rfq.substance} · ${a.cro_name} 을 선정한 지 45일이 지났습니다. 계약이 끝났거나 진행하지 않기로 했다면 요청 화면의 문의하기로 알려 주세요.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
        await logEvent(a.rfq_id, stage, "계약 진행 여부 확인 요청", "선정 45일 경과", null);
      } else {
        const { data: members } = a.cro_org_id ? await sb.from("profiles").select("id, email").eq("cro_org_id", a.cro_org_id) : { data: [] as { id: string; email: string }[] };
        const ids = (members ?? []).map((m) => m.id as string);
        const mails = (members ?? []).map((m) => m.email as string).filter(Boolean);
        if (!ids.length && !mails.length) continue;
        // 앱에 들어오지 않는 기관도 있어 메일로도 보낸다 (14일, 30일 두 번)
        await notifyUsers(ids, { kind: "계약", title: `${rfq.rfq_no} 계약 체결을 보고해 주세요`, body: `${rfq.substance} · 선정 ${days}일 경과. 계약을 맺었다면 체결일과 금액을, 진행하지 않게 되었다면 단추(hello@danchu.kr)에 알려 주세요.`, href: "/cro/awards" }, mails.length ? { to: mails } : undefined);
        await logEvent(a.rfq_id, stage, "계약 보고 리마인더", `선정 ${days}일 경과`, null);
      }
      out.contractReminded++;
    }
  });

  // 4-2) 계약 보고 7일 뒤에도 의뢰자가 확인도 이의도 하지 않았으면 보고 내용대로 확정하고 요청을 마친다
  await step("contract-confirm", out.errors, async () => {
    const before = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: awards } = await sb.from("rfq_awards").select("id, rfq_id, cro_org_id, cro_name, contract_date, contract_amount").not("contract_reported_at", "is", null).lt("contract_reported_at", before).is("requester_confirmed_at", null).is("requester_disputed_at", null).limit(100);
    for (const a of awards ?? []) {
      const now = new Date().toISOString();
      const { data: done } = await sb.from("rfq_awards").update({ requester_confirmed_at: now, confirmed_auto: true }).eq("id", a.id).is("requester_confirmed_at", null).is("requester_disputed_at", null).select("id").maybeSingle();
      if (!done) continue;
      const { data: rfq } = await sb.from("rfq_requests").update({ status: "closed", closed_at: now }).eq("id", a.rfq_id).in("status", ["selected", "contracting"]).select("rfq_no, user_id").maybeSingle();
      const summary = `체결일 ${a.contract_date ?? "-"} · ${won(a.contract_amount ?? 0)}`;
      await logEvent(a.rfq_id, "closed", "계약 보고 7일 경과 · 자동 확정", summary, null, { auto: true });
      if (rfq?.user_id) await notifyUsers([rfq.user_id], { kind: "계약", title: `${rfq.rfq_no} 계약 내용을 보고대로 확정했습니다`, body: `${a.cro_name} · ${summary}. 실제와 다르면 요청 화면의 문의하기로 알려 주세요.`, href: `/app/r/${rfq.rfq_no}` });
      if (a.cro_org_id && rfq) {
        const { data: ms } = await sb.from("profiles").select("id").eq("cro_org_id", a.cro_org_id);
        await notifyUsers((ms ?? []).map((m) => m.id as string), { kind: "계약", title: `${rfq.rfq_no} 계약 내용이 확정되었습니다`, body: `${summary} · 요청을 마쳤습니다.`, href: "/cro/awards" });
      }
      out.contractConfirmed++;
    }
  });

  // 6) 운영자 하루 요약 메일. 견적 제출·회신하지 않음은 실시간으로는 앱 알림만 보내고 여기서 모은다
  await step("digest", out.errors, async () => {
    const since = new Date(Date.now() - 864e5).toISOString();
    const { data: evs } = await sb.from("rfq_events").select("kind, rfq_id, title, created_at").gte("created_at", since).in("kind", ["received", "quote_submitted", "declined", "compared", "selected", "contract", "outcome"]).order("created_at").limit(500);
    const count = (k: string) => (evs ?? []).filter((e) => e.kind === k).length;
    const attention: string[] = [];
    // 전달할 기관을 못 찾은 요청
    const { data: noMatch } = await sb.from("rfq_requests").select("id, rfq_no, substance").eq("status", "received").not("started_at", "is", null).limit(50);
    for (const r of noMatch ?? []) attention.push(`${r.rfq_no} ${r.substance} · 전달할 기관을 정해 주세요`);
    // 내일이 마감인데 아직 회신이 하나도 없는 요청
    const { data: soon } = await sb.from("rfq_requests").select("id, rfq_no, substance").in("status", ["distributed"]).eq("reply_by", addDays(today, 1)).limit(50);
    for (const r of soon ?? []) attention.push(`${r.rfq_no} ${r.substance} · 내일 마감, 아직 회신 없음`);
    // 의뢰자가 계약 보고에 이의를 남긴 수주
    const { data: disputes } = await sb.from("rfq_awards").select("cro_name, requester_dispute_note, rfq_id").not("requester_disputed_at", "is", null).is("requester_confirmed_at", null).limit(50);
    for (const d of disputes ?? []) attention.push(`${d.cro_name} 계약 보고 이의 · ${d.requester_dispute_note ?? ""}`);
    const lines = [
      ["새 요청", count("received")],
      ["견적 제출", count("quote_submitted")],
      ["회신하지 않음", count("declined")],
      ["비교표 공개", count("compared")],
      ["기관 선정", count("selected")],
      ["계약 보고", count("contract")],
    ].filter(([, n]) => (n as number) > 0) as [string, number][];
    if (!lines.length && !attention.length) return;
    const to = adminEmails();
    if (!to.length) return;
    const html = mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">어제 단추에서 있었던 일</h2>
      ${lines.length ? `<ul style="padding-left:20px;margin:0 0 20px">${lines.map(([k, n]) => `<li>${esc(k)} ${n}건</li>`).join("")}</ul>` : `<p>새로 들어온 요청과 견적은 없습니다.</p>`}
      ${attention.length ? `<h3 style="font-size:16px;margin:0 0 8px">확인이 필요한 일 ${attention.length}건</h3><ul style="padding-left:20px;margin:0 0 20px">${attention.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p><a href="${siteUrl()}/admin">운영 화면 열기</a></p>`);
    out.digest = await sendMail({ to, subject: `[단추] ${today} 하루 요약${attention.length ? ` · 확인할 일 ${attention.length}건` : ""}`, html });
  });

  // 5) 보존기간 정리: 접속 기록 90일, 요청서 3년, 읽은 알림 180일 (개인정보처리방침 3항)
  await step("retention", out.errors, async () => {
    out.retention = await runRetention(sb);
  });

  // 실패한 단계가 있으면 운영자에게 알린다. 응답 JSON 은 아무도 읽지 않는다
  if (out.errors.length) {
    await notifyUsers(await adminUserIds(), { kind: "시스템", title: `예약 작업 일부 실패 · ${out.errors.length}건`, body: `${today} 09:00 실행 중 실패한 단계:\n${out.errors.join("\n")}\n\n같은 작업은 다음 실행 때 다시 시도합니다. 반복되면 Sentry 또는 Vercel 로그를 확인해 주세요.`, href: "/admin" }, { to: adminEmails() }).catch((e) => captureError(e, "cron:notify"));
  }

  return NextResponse.json({ ok: out.errors.length === 0, today, ...out });
}
