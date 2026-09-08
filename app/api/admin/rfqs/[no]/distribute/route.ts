import { NextResponse } from "next/server";
import { sessionOrNull } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRfqByNo } from "@/lib/data";
import { logEvent, notifyUsers, siteUrl } from "@/lib/notify";
import { mailWrap, esc, sendMail } from "@/lib/mail";

export const runtime = "nodejs";

/**
 * POST { orgIds: string[], replyBy: 'YYYY-MM-DD' } — 승인된 CRO 기관에 초대(회신 링크)를 만들고 메일을 보낸다.
 * 이미 초대한 기관은 건너뛴다. 상태 received → distributed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ no: string }> }) {
  const s = await sessionOrNull("admin");
  if (!s) return NextResponse.json({ error: "운영자만 할 수 있습니다." }, { status: 403 });
  const { no } = await ctx.params;
  const rfq = await getRfqByNo(no);
  if (!rfq) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (["closed", "cancelled"].includes(rfq.status)) return NextResponse.json({ error: "종료된 요청입니다." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { orgIds?: unknown; replyBy?: unknown };
  const orgIds = Array.isArray(b.orgIds) ? (b.orgIds as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)) : [];
  const replyBy = typeof b.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.replyBy) ? b.replyBy : "";
  if (!orgIds.length || !replyBy) return NextResponse.json({ error: "기관과 회신 기한을 선택해 주세요." }, { status: 400 });

  const sb = getSupabaseAdmin()!;
  const { data: orgs } = await sb.from("cro_orgs").select("id, name, contact_email, status").in("id", orgIds).eq("status", "approved");
  const { data: existing } = await sb.from("rfq_invites").select("cro_org_id").eq("rfq_id", rfq.id);
  const already = new Set((existing ?? []).map((e) => e.cro_org_id));
  const expiresAt = new Date(`${replyBy}T23:59:59+09:00`);
  expiresAt.setDate(expiresAt.getDate() + 7);

  let sent = 0;
  let mailed = 0;
  const names: string[] = [];
  for (const o of orgs ?? []) {
    if (already.has(o.id)) continue;
    const { data: members } = await sb.from("profiles").select("id, email").eq("cro_org_id", o.id);
    const memberIds = (members ?? []).map((m) => m.id as string);
    const memberMails = (members ?? []).map((m) => m.email as string);
    const to = [...new Set([o.contact_email, ...memberMails].filter((x): x is string => !!x))];
    const croEmail = o.contact_email || memberMails[0] || "";
    if (!croEmail) continue;

    const { data: inv, error } = await sb
      .from("rfq_invites")
      .insert({ rfq_id: rfq.id, rfq_no: rfq.rfq_no, cro_name: o.name, cro_email: croEmail, cro_org_id: o.id, reply_by: replyBy, expires_at: expiresAt.toISOString() })
      .select("id, token")
      .single();
    if (error || !inv) {
      console.error("invite insert", o.name, error);
      continue;
    }
    sent++;
    names.push(o.name);

    const link = `${siteUrl()}/q/${inv.token}`;
    const portal = `${siteUrl()}/cro/r/${inv.id}`;
    const masked = (rfq.confidentiality || "").startsWith("CDA");
    const html = mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">[단추] 견적 요청서가 도착했습니다 · ${esc(rfq.rfq_no)}</h2>
      <p><b>${esc(masked ? `${rfq.org_type || "의뢰기관"} (CDA 체결 전 마스킹)` : rfq.company)}</b> · 시험물질 ${esc(rfq.substance)}<br>
      시험 항목: ${esc(rfq.categories.join(", "))}<br>
      의뢰 목적: ${esc(rfq.purpose || "—")} · 기밀 등급: ${esc(rfq.confidentiality || "일반")}</p>
      <p style="font-size:15px"><b>회신 기한 ${esc(replyBy)}</b> · 링크는 기한 +7일까지 열립니다.</p>
      <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#A3690F;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">요청서 보고 회신하기</a></p>
      <p style="font-size:13px;color:#6F6A63">항목별 가능 여부·금액·기간과 정식 견적서 PDF만 있으면 5분 안에 회신할 수 있습니다. 로그인 없이 위 링크로 바로 열리며, 계정이 있으면 <a href="${esc(portal)}">CRO 포털</a>에서도 보입니다.<br>비교표는 의뢰자에게만 전달되며 타사 견적은 열람할 수 없습니다.</p>`);
    if (to.length && (await sendMail({ to, subject: `[단추] 견적 요청 ${rfq.rfq_no} · ${rfq.substance} · 회신 기한 ${replyBy}`, html }))) mailed++;
    await notifyUsers(memberIds, { kind: "배포", title: `새 견적 요청 · ${rfq.rfq_no} ${rfq.substance}`, body: `${rfq.categories.join(" · ")} · 회신 기한 ${replyBy}`, href: `/cro/r/${inv.id}` });
  }

  if (sent) {
    const patch: Record<string, unknown> = { reply_by: rfq.reply_by || replyBy };
    if (rfq.status === "received") Object.assign(patch, { status: "distributed", distributed_at: new Date().toISOString() });
    await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
    await logEvent(rfq.id, "distributed", `CRO ${sent}곳 배포`, `${names.join(", ")} · 회신 기한 ${replyBy}`, s.userId, { orgIds });
    if (rfq.user_id) {
      const { count } = await sb.from("rfq_invites").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
      await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 참여 CRO ${count ?? sent}곳에 배포했습니다`, body: `회신 기한 ${replyBy} · 견적이 도착하면 알려 드립니다.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
    } else {
      await notifyUsers([], { kind: "배포", title: `${rfq.rfq_no} 참여 CRO ${sent}곳에 배포했습니다`, body: `회신 기한 ${replyBy} · 견적이 도착하면 이메일로 알려 드립니다. 진행 상황은 ${siteUrl()}/signup 에서 같은 이메일로 가입하면 볼 수 있습니다.` }, { to: [rfq.email] });
    }
  }
  return NextResponse.json({ ok: true, sent, mailed });
}
