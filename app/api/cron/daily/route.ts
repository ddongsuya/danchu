import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { InviteRow, RfqRow } from "@/lib/data";
import { adminEmails, adminUserIds, logEvent, notifyUsers } from "@/lib/notify";
import { publishCompare } from "@/lib/compare";
import { loadByInvite } from "@/lib/quote-load";
import { todaySeoul } from "@/lib/format";
import { won } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
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
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "저장소 미설정" }, { status: 503 });

  const today = todaySeoul();
  const out = { reminded: 0, autoSubmitted: 0, compared: 0, errors: [] as string[] };

  // 1) 리마인더
  for (const [kind, day] of [["d2", addDays(today, 2)], ["d0", today]] as const) {
    const { data: invites } = await sb.from("rfq_invites").select("*").eq("reply_by", day).in("status", ["sent", "draft"]);
    for (const inv of (invites ?? []) as InviteRow[]) {
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

  // 2) 자동 회신 (기한 당일, auto_reply 기관, 초안이 확인 필요 없이 완성된 경우)
  const { data: autoOrgs } = await sb.from("cro_orgs").select("id").eq("auto_reply", true);
  const autoIds = (autoOrgs ?? []).map((o) => o.id as string);
  if (autoIds.length) {
    const { data: invites } = await sb.from("rfq_invites").select("*").eq("reply_by", today).in("status", ["sent", "draft"]).in("cro_org_id", autoIds);
    for (const inv of (invites ?? []) as InviteRow[]) {
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
        const { data: q, error } = await sb
          .from("cro_quotes")
          .upsert({ invite_id: inv.id, rfq_id: inv.rfq_id, rfq_no: inv.rfq_no, cro_name: inv.cro_name, cro_org_id: inv.cro_org_id, total_amount: total || null, total_weeks: weeks || null, vat: "별도", valid_until: valid, start_date: d.common.startDate || null, includes: d.common.includes, note: d.note, status: "submitted", submitted_at: new Date().toISOString(), auto: true }, { onConflict: "invite_id" })
          .select("id")
          .single();
        if (error || !q) throw error || new Error("upsert");
        const rows = got.rfq.rows;
        await sb.from("cro_quote_items").upsert(
          d.items.map((it) => {
            const r = rows.find((x) => x.seq === it.seq)!;
            return { quote_id: q.id, seq: it.seq, category: r.category, name: r.name, cond: r.cond, avail: it.avail || null, amount: it.avail !== "불가" && it.amount ? Number(it.amount) : null, weeks: it.avail !== "불가" && it.weeks ? Number(it.weeks) : null, reason: it.reason || null, design: it.design ?? {}, source: it.source ?? "catalog", unit: it.unit ?? "total", unit_price: it.unitPrice ? Number(it.unitPrice) : null, sample_count: it.sampleCount ? Number(it.sampleCount) : null };
          }),
          { onConflict: "quote_id,seq" },
        );
        await sb.from("rfq_invites").update({ status: "submitted" }).eq("id", inv.id);
        const { data: r } = await sb.from("rfq_requests").select("status, user_id").eq("id", inv.rfq_id).maybeSingle();
        if (r && ["received", "distributed"].includes(r.status)) await sb.from("rfq_requests").update({ status: "quoted" }).eq("id", inv.rfq_id);
        await logEvent(inv.rfq_id, "quote_submitted", `${inv.cro_name} 예비 견적 자동 제출`, `총 ${won(total)} · ${weeks}주`, null, { quoteId: q.id, auto: true });
        if (r?.user_id) await notifyUsers([r.user_id], { kind: "견적", title: `예비 견적이 도착했습니다 · ${inv.rfq_no}`, body: `${inv.cro_name} · 카탈로그 기준 자동 회신`, href: `/app/r/${inv.rfq_no}` });
        out.autoSubmitted++;
      } catch (e) {
        console.error("auto reply", inv.id, e);
        out.errors.push(`auto:${inv.rfq_no}`);
      }
    }
  }

  // 3) 기한 후 비교표 자동 공개
  const { data: rfqs } = await sb.from("rfq_requests").select("*").in("status", ["distributed", "quoted"]).is("compared_at", null).lt("reply_by", today);
  for (const rfq of (rfqs ?? []) as RfqRow[]) {
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

  return NextResponse.json({ ok: true, today, ...out });
}
