import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import { logEvent, notifyUsers, siteUrl } from "./notify";
import { mailWrap, esc, sendMail } from "./mail";
import { addBusinessDays, nowSeoul } from "./dates";
import { quoteRowsFromPayload } from "./quote-items";
import { rowKey } from "./catalog";

export type DistributeResult = { sent: number; mailed: number; names: string[]; skipped: string[] };

type Org = { id: string; name: string; contact_email: string | null; categories: string[]; glp_certs: string[] };

/**
 * 배포 대상 자동 선정.
 * - 승인된 기관 중 요청서 대분류와 수행 분야가 겹치는 기관
 * - 카탈로그에서 요청 항목 전부를 "수행하지 않음"으로 꺼 둔 기관은 제외
 */
export async function matchOrgs(rfq: RfqRow): Promise<{ orgs: Org[]; skipped: string[] }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { orgs: [], skipped: [] };
  const { data } = await sb.from("cro_orgs").select("id, name, contact_email, categories, glp_certs").eq("status", "approved");
  const all = (data ?? []) as Org[];
  const cats = rfq.categories;
  const candidates = all.filter((o) => (o.categories ?? []).some((c) => cats.includes(c)));
  if (!candidates.length) return { orgs: [], skipped: [] };

  const rows = quoteRowsFromPayload(rfq.payload);
  const keys = rows.map(rowKey);
  const { data: cat } = await sb.from("cro_catalog").select("org_id, item_key, available").in("org_id", candidates.map((o) => o.id)).in("item_key", keys);
  // 항목마다 조합이 여러 개: 켜진 조합이 하나라도 있으면 그 항목은 수행
  const on = new Map<string, Set<string>>();
  const has = new Map<string, Set<string>>();
  for (const r of cat ?? []) {
    has.set(r.org_id, (has.get(r.org_id) ?? new Set()).add(r.item_key));
    if (r.available !== false) on.set(r.org_id, (on.get(r.org_id) ?? new Set()).add(r.item_key));
  }
  const skipped: string[] = [];
  const orgs = candidates.filter((o) => {
    const h = has.get(o.id);
    const allOff = !!h && keys.length > 0 && keys.every((k) => h.has(k) && !on.get(o.id)?.has(k));
    if (allOff) skipped.push(o.name);
    return !allOff;
  });
  return { orgs, skipped };
}

/** 회신 기한 기본값: 의뢰자 희망일이 있으면 그 날, 없으면 접수 + 7영업일 */
export function defaultReplyBy(rfq: RfqRow): string {
  if (rfq.reply_by) return rfq.reply_by;
  const p = rfq.payload;
  if (typeof p.replyBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.replyBy)) return p.replyBy;
  return addBusinessDays(nowSeoul(), 7).toLocaleDateString("sv-SE");
}

/**
 * 기관들에 초대(회신 링크)를 만들고 메일·알림을 보낸다. 이미 초대한 기관은 건너뛴다.
 * 운영자 수동 배포와 접수 시 자동 배포가 함께 쓴다.
 */
export async function distributeTo(rfq: RfqRow, orgs: Org[], replyBy: string, actorId: string | null, auto = false): Promise<DistributeResult> {
  const sb = getSupabaseAdmin();
  const res: DistributeResult = { sent: 0, mailed: 0, names: [], skipped: [] };
  if (!sb || !orgs.length) return res;

  const { data: existing } = await sb.from("rfq_invites").select("cro_org_id").eq("rfq_id", rfq.id);
  const already = new Set((existing ?? []).map((e) => e.cro_org_id));
  const expiresAt = new Date(`${replyBy}T23:59:59+09:00`);
  expiresAt.setDate(expiresAt.getDate() + 7);
  const masked = (rfq.confidentiality || "").startsWith("CDA");

  for (const o of orgs) {
    if (already.has(o.id)) continue;
    const { data: members } = await sb.from("profiles").select("id, email").eq("cro_org_id", o.id);
    const memberIds = (members ?? []).map((m) => m.id as string);
    const memberMails = (members ?? []).map((m) => m.email as string);
    const to = [...new Set([o.contact_email, ...memberMails].filter((x): x is string => !!x))];
    const croEmail = o.contact_email || memberMails[0] || "";
    if (!croEmail) {
      res.skipped.push(o.name);
      continue;
    }
    const { data: inv, error } = await sb
      .from("rfq_invites")
      .insert({ rfq_id: rfq.id, rfq_no: rfq.rfq_no, cro_name: o.name, cro_email: croEmail, cro_org_id: o.id, reply_by: replyBy, expires_at: expiresAt.toISOString() })
      .select("id, token")
      .single();
    if (error || !inv) {
      console.error("invite insert", o.name, error);
      continue;
    }
    res.sent++;
    res.names.push(o.name);

    const link = `${siteUrl()}/q/${inv.token}`;
    const portal = `${siteUrl()}/cro/r/${inv.id}`;
    const html = mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">[단추] 견적 요청서가 도착했습니다 · ${esc(rfq.rfq_no)}</h2>
      <p><b>${esc(masked ? `${rfq.org_type || "의뢰기관"} (CDA 체결 전 마스킹)` : rfq.company)}</b> · 시험물질 ${esc(rfq.substance)}<br>
      시험 항목: ${esc(rfq.categories.join(", "))}<br>
      의뢰 목적: ${esc(rfq.purpose || "—")} · 기밀 등급: ${esc(rfq.confidentiality || "일반")}</p>
      <p style="font-size:15px"><b>회신 기한 ${esc(replyBy)}</b> · 링크는 기한 +7일까지 열립니다.</p>
      <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#A3690F;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">요청서 보고 회신하기</a></p>
      <p style="font-size:13px;color:#6F6A63">카탈로그를 등록해 두셨다면 회신 초안이 채워진 채 열립니다. 확인 필요 표시가 붙은 항목만 보고 제출하시면 됩니다.<br>로그인 없이 위 링크로 바로 열리며, 계정이 있으면 <a href="${esc(portal)}">CRO 포털</a>에서도 보입니다. 비교표는 의뢰자에게만 전달되며 타사 견적은 열람할 수 없습니다.</p>`);
    if (to.length && (await sendMail({ to, subject: `[단추] 견적 요청 ${rfq.rfq_no} · ${rfq.substance} · 회신 기한 ${replyBy}`, html }))) res.mailed++;
    await notifyUsers(memberIds, { kind: "배포", title: `새 견적 요청 · ${rfq.rfq_no} ${rfq.substance}`, body: `${rfq.categories.join(" · ")} · 회신 기한 ${replyBy}`, href: `/cro/r/${inv.id}` });
  }

  if (res.sent) {
    const patch: Record<string, unknown> = { reply_by: rfq.reply_by || replyBy };
    if (rfq.status === "received") Object.assign(patch, { status: "distributed", distributed_at: new Date().toISOString() });
    await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
    await logEvent(rfq.id, "distributed", `CRO ${res.sent}곳 ${auto ? "자동 " : ""}배포`, `${res.names.join(", ")} · 회신 기한 ${replyBy}`, actorId, { orgIds: orgs.map((o) => o.id), auto });
    const { count } = await sb.from("rfq_invites").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
    if (rfq.user_id) {
      await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 참여 CRO ${count ?? res.sent}곳에 배포했습니다`, body: `회신 기한 ${replyBy} · 견적이 도착하면 알려 드립니다.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
    } else {
      await notifyUsers([], { kind: "배포", title: `${rfq.rfq_no} 참여 CRO ${res.sent}곳에 배포했습니다`, body: `회신 기한 ${replyBy} · 견적이 도착하면 이메일로 알려 드립니다. 진행 상황은 ${siteUrl()}/signup 에서 같은 이메일로 가입하면 볼 수 있습니다.` }, { to: [rfq.email] });
    }
  }
  return res;
}

/** 접수 직후 자동 배포. 맞는 기관이 없으면 운영자에게만 알린다. */
export async function autoDistribute(rfq: RfqRow): Promise<DistributeResult & { matched: number }> {
  const { orgs, skipped } = await matchOrgs(rfq);
  const r = await distributeTo(rfq, orgs, defaultReplyBy(rfq), null, true);
  return { ...r, skipped: [...r.skipped, ...skipped], matched: orgs.length };
}
