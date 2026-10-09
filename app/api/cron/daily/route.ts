import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { publishCompare } from "@/lib/compare";
import { distributeOpenRfqs } from "@/lib/distribute";
import { loadByInvite } from "@/lib/quote-load";
import { todaySeoul } from "@/lib/format";
import { won } from "@/lib/format";
import { saveQuote, type QuoteItemInput } from "@/lib/rpc";
import { captureError } from "@/lib/observe";
import { isProduction } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";
import { runRetention } from "@/lib/retention";

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
 * 1) 미회신 기관에 D-2·당일 리마인더
 * 2) 자동 회신을 켠 기관의 완성된 초안을 기한 당일 예비 견적으로 제출
 * 3) 회신 기한이 지난 요청의 비교표 자동 공개 (제출 1건 이상)
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
  const out = { reminded: 0, autoSubmitted: 0, compared: 0, distributed: 0, outcomeAsked: 0, retention: { accessLogs: 0, requests: 0, files: 0, notifications: 0 }, errors: [] as string[] };

  // 속도 제한 카운터 정리 (함수가 아직 없으면 무시)
  await sb.rpc("rate_limit_cleanup").then(({ error }) => { if (error) console.warn("rate_limit_cleanup", error.message); });

  // 0) 빠진 배포 보충: 승인된 기관 중 열린 요청을 아직 받지 못한 곳
  await step("distribute", out.errors, async () => {
    out.distributed = (await distributeOpenRfqs()).invites;
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
    const r = await publishCompare(rfq, null, true);
    if (r.ok) {
      out.compared++;
      await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 비교표 자동 공개 · ${r.count}건`, href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
    } else {
      // 회신이 하나도 없으면 운영자에게 재배포 판단을 넘긴다 (하루 한 번만)
      const { data: ev } = await sb.from("rfq_events").select("id").eq("rfq_id", rfq.id).eq("kind", "no_reply").maybeSingle();
      if (!ev) {
        await logEvent(rfq.id, "no_reply", "기한 경과 · 회신 없음", "재배포 또는 기한 연장 판단 필요", null);
        await notifyUsers(await adminUserIds(), { kind: "비교", title: `${rfq.rfq_no} 기한 경과 · 회신 없음`, body: "재배포하거나 기한을 연장해 주세요.", href: `/admin/r/${rfq.rfq_no}` }, { to: adminEmails() });
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
