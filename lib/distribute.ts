import { notificationRecipients } from "./mail-preferences";
import { countsTowardLimit, inviteExpiresAt, maskedClientLabel, needsCda, remainingInvites, seoulMonthRange, withinMonthlyCap, type InviteSource } from "@/lib/request-policy";
import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import type { TablesUpdate } from "./db-types";
import { logEvent, notifyUsers, operatorReplyTo, siteUrl, type NotifyKind } from "./notify";
import { mailWrap, esc, sendMail } from "./mail";
import { addBusinessDays, nowSeoul } from "./dates";
import { quoteRowsFromPayload } from "./quote-items";
import { rowKey } from "./catalog";
import { replyPath } from "./concierge";

export type DistributeResult = {
  sent: number;
  mailed: number;
  names: string[];
  skipped: string[];
  /** 월 전달 한도에 걸려 제외한 기관 */
  capped: string[];
  /** DB 트리거가 막은 이유. request_not_open: 회신 마감(compared_at)·선정 이후 / invitation_limit_reached: 요청 기관 수 한도 */
  blocked?: "request_not_open" | "invitation_limit_reached";
};

type Org = { id: string; name: string; contact_email: string | null; categories: string[]; glp_certs: string[]; monthly_cap?: number | null; managed?: boolean };

/** 배포 대상 기관 조회에 쓰는 컬럼 (운영자 수동 배포 라우트와 같게) */
export const ORG_COLUMNS = "id, name, contact_email, categories, glp_certs, monthly_cap, managed";

/**
 * 배포 대상 자동 선정.
 * - 승인된 기관 중 요청서 대분류와 수행 분야가 겹치는 기관
 * - 카탈로그에서 요청 항목 전부를 "수행하지 않음"으로 꺼 둔 기관은 제외
 * - 운영자 관리 기관(managed)은 제외. 참여 계약이 없는 기관이라 자동 배포·보충·지명으로 보내지 않고, 운영자가 배포 패널에서 요청마다 고른다
 */
export async function matchOrgs(rfq: RfqRow): Promise<{ orgs: Org[]; skipped: string[] }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { orgs: [], skipped: [] };
  const { data } = await sb.from("cro_orgs").select(ORG_COLUMNS).eq("status", "approved").eq("managed", false).order("id");
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
  return addBusinessDays(new Date(new Date(rfq.created_at).toLocaleString("en-US", { timeZone: "Asia/Seoul" })), 7).toLocaleDateString("sv-SE");
}

/**
 * 기관들에 초대(회신 링크)를 만들고 메일·알림을 보낸다. 이미 초대한 기관은 건너뛴다.
 * 운영자 수동 배포와 접수 시 자동 배포가 함께 쓴다.
 */
export async function distributeTo(rfq: RfqRow, orgs: Org[], replyBy: string, actorId: string | null, auto = false, source: InviteSource = auto ? "matched" : "manual"): Promise<DistributeResult> {
  const sb = getSupabaseAdmin();
  const res: DistributeResult = { sent: 0, mailed: 0, names: [], skipped: [], capped: [] };
  if (!sb || !orgs.length) return res;

  // 월 전달 한도: 약정한 기관은 이번 달 전달 수가 한도에 닿으면 더 보내지 않는다 (전달 1건 = 청구 1건)
  const cappedOrgs = orgs.filter((o) => o.monthly_cap != null && o.monthly_cap > 0);
  const usedThisMonth = new Map<string, number>();
  if (cappedOrgs.length) {
    const { from, to } = seoulMonthRange();
    // 청구에서 제외한 전달(허위·중복)은 한도에서도 뺀다
    const { data: monthInv } = await sb.from("rfq_invites").select("cro_org_id").in("cro_org_id", cappedOrgs.map((o) => o.id)).eq("billable", true).gte("sent_at", `${from}T00:00:00+09:00`).lt("sent_at", `${to}T00:00:00+09:00`);
    for (const i of monthInv ?? []) if (i.cro_org_id) usedThisMonth.set(i.cro_org_id, (usedThisMonth.get(i.cro_org_id) ?? 0) + 1);
  }

  const { data: existing, error: existingError } = await sb.from("rfq_invites").select("cro_org_id, status").eq("rfq_id", rfq.id);
  if (existingError) throw new Error("기존 배포 현황을 확인하지 못했습니다.");
  // 회신하지 않음·만료 초대는 한도에서 빼고(재배포 가능), 같은 기관 재초대는 막는다
  const capacity = remainingInvites(rfq.cro_count, (existing ?? []).filter((e) => countsTowardLimit(e.status)).length);
  const already = new Set((existing ?? []).map((e) => e.cro_org_id));
  const expiresAt = inviteExpiresAt(replyBy);

  for (const o of orgs) {
    if (already.has(o.id)) continue;
    if (res.sent >= capacity) { res.skipped.push(o.name); continue; }
    if (!withinMonthlyCap(o.monthly_cap, usedThisMonth.get(o.id) ?? 0)) { res.capped.push(o.name); continue; }
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
      .insert({ rfq_id: rfq.id, rfq_no: rfq.rfq_no, cro_name: o.name, cro_email: croEmail, cro_org_id: o.id, reply_by: replyBy, expires_at: expiresAt.toISOString(), source })
      .select("id, token")
      .single();
    if (error || !inv) {
      const m = error?.message || "";
      if (m.includes("request_not_open") || m.includes("invitation_limit_reached")) {
        // 트리거가 막은 것: 이 요청에는 더 못 보낸다. 사유를 그대로 돌려주고 멈춘다
        res.blocked = m.includes("request_not_open") ? "request_not_open" : "invitation_limit_reached";
        res.skipped.push(o.name);
        break;
      }
      res.skipped.push(o.name);
      console.error("invite insert", o.name, error);
      continue;
    }
    already.add(o.id);
    usedThisMonth.set(o.id, (usedThisMonth.get(o.id) ?? 0) + 1);
    res.sent++;
    res.names.push(o.name);

    const mailTo = await notificationRecipients(to);
    // 메일 실패가 다음 기관의 초대 생성을 막으면 안 된다. 실패하면 mailed_at 이 비어 남고 cron 이 다시 보낸다
    if (mailTo.length) {
      const mailOpts = { managed: !!o.managed, members: memberIds.length };
      const mailed = await sendMail({ to: mailTo, subject: inviteMailSubject(rfq, replyBy), html: inviteMailHtml(rfq, replyBy, inv.token, inv.id, mailOpts), replyTo: inviteReplyTo(mailOpts) }).catch(() => false);
      if (mailed) {
        res.mailed++;
        await sb.from("rfq_invites").update({ mailed_at: new Date().toISOString() }).eq("id", inv.id);
      } else console.warn("[danchu] 배포 메일 미발송", rfq.rfq_no, o.id);
    }
    await notifyUsers(memberIds, { kind: "배포", title: `새 견적 요청 · ${rfq.rfq_no} ${rfq.substance}`, body: `${rfq.categories.join(" · ")} · 회신 기한 ${replyBy}`, href: `/cro/r/${inv.id}` });
  }

  if (res.sent) {
    const patch: TablesUpdate<"rfq_requests"> = { reply_by: rfq.reply_by || replyBy };
    if (rfq.status === "received") Object.assign(patch, { status: "distributed", distributed_at: new Date().toISOString() });
    await sb.from("rfq_requests").update(patch).eq("id", rfq.id);
    await logEvent(rfq.id, "distributed", `CRO ${res.sent}곳 ${auto ? "자동 " : ""}배포`, `${res.names.join(", ")} · 회신 기한 ${replyBy}${res.capped.length ? ` · 월 한도 제외 ${res.capped.join(", ")}` : ""}`, actorId, { orgIds: orgs.map((o) => o.id), auto, source, capped: res.capped });
    const { count } = await sb.from("rfq_invites").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
    if (rfq.user_id) {
      await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 참여 CRO ${count ?? res.sent}곳에 배포했습니다`, body: `회신 기한 ${replyBy} · 견적이 도착하면 알려 드립니다.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
    } else {
      await notifyUsers([], { kind: "배포", title: `${rfq.rfq_no} 참여 CRO ${res.sent}곳에 배포했습니다`, body: `회신 기한 ${replyBy} · 견적이 도착하면 이메일로 알려 드립니다. 진행 상황은 ${siteUrl()}/signup 에서 같은 이메일로 가입하면 볼 수 있습니다.` }, { to: [rfq.email] });
    }
  }
  return res;
}

/** 배포 메일 제목·본문. 첫 발송과 cron 재발송이 같은 것을 쓴다 */
export function inviteMailSubject(rfq: Pick<RfqRow, "rfq_no" | "substance">, replyBy: string): string {
  return `[단추] 견적 요청 ${rfq.rfq_no} · ${rfq.substance} · 회신 기한 ${replyBy}`;
}
/** 받는 기관의 종류. 운영자 관리 기관이나 담당자 계정이 없는 기관에는 로그인이 필요한 포털 링크를 넣지 않는다 */
export type InviteMailOpts = { managed?: boolean; members?: number };

/** 운영자 관리 기관은 견적서 PDF 를 메일 회신으로 보낼 수 있게 회신 주소를 운영 역할 주소(OPERATOR_REPLY_TO)로 둔다 */
export function inviteReplyTo(opts: InviteMailOpts = {}): string | undefined {
  return opts.managed ? operatorReplyTo() : undefined;
}

export function inviteMailHtml(rfq: Pick<RfqRow, "rfq_no" | "substance" | "categories" | "purpose" | "intent" | "confidentiality" | "org_type">, replyBy: string, token: string, inviteId: string, opts: InviteMailOpts = {}): string {
  const link = `${siteUrl()}/q/${token}`;
  const portalPath = replyPath({ id: inviteId, token }, { managed: opts.managed, members: opts.members ?? 1 });
  const portal = portalPath.startsWith("/cro/") ? `${siteUrl()}${portalPath}` : "";
  const masked = needsCda(rfq.confidentiality);
  const guide = opts.managed
    ? `단추는 비임상 시험 의뢰자가 여러 기관의 견적을 한곳에서 받아 비교하는 서비스이며, 귀 기관은 단추 운영자가 등록해 이 요청을 받았습니다.<br>위 링크로 로그인 없이 회신하시거나, 정식 견적서 PDF를 이 메일에 회신으로 보내 주시면 단추가 견적서 내용을 같은 양식으로 옮겨 정리하고 "단추 정리 · 기관 PDF 기준"으로 표시합니다. 비교표에서는 귀 기관의 견적서 원본이 기준 문서로 함께 전달되며, 옮겨 적은 내용과 PDF가 다르면 PDF가 우선합니다. 메일로 보내 주신 견적서는 단추가 옮겨 정리한 때 비교표에 보입니다. 의뢰자는 기한 전에도 선정할 수 있으니 견적서는 되도록 일찍 보내 주십시오.<br>링크로 제출한 견적은 즉시 의뢰자 비교표에 보이며, 의뢰자는 회신 기한 전에도 기관을 선정할 수 있습니다. 다른 기관은 귀 기관의 견적을 볼 수 없습니다. 요청서 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오. 앞으로 요청을 받지 않으시려면 이 메일에 "수신 거부"라고 회신해 주세요.<br>이 메일 주소는 단추 운영자가 귀 기관이 공개한 대표 연락처를 확인해 등록했습니다. 개인정보 처리 안내는 <a href="${esc(siteUrl())}/privacy">개인정보처리방침</a>에서 볼 수 있습니다.`
    : `카탈로그를 등록해 두셨다면 회신 초안이 채워진 채 열립니다. 확인 필요 표시가 붙은 항목만 보고 제출하시면 됩니다.<br>${portal ? `로그인 없이 위 링크로 바로 열리며, 계정이 있으면 <a href="${esc(portal)}">CRO 포털</a>에서도 보입니다.` : "로그인 없이 위 링크로 바로 열립니다."}<br>제출한 견적은 즉시 의뢰자 비교표에 보이고, 회신이 마감되기 전까지 회신 기한 안에서 수정할 수 있습니다. 의뢰자가 기한 전에 기관을 선정하거나 운영자가 회신을 마감하면 회신이 닫힙니다. 다른 기관은 귀 기관의 견적을 볼 수 없습니다. 요청서 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오.`;
  return mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">[단추] 견적 요청서가 도착했습니다 · ${esc(rfq.rfq_no)}</h2>
      <p><b>${esc(maskedClientLabel(rfq.org_type))}</b> · 시험물질 ${esc(rfq.substance)}<br>
      시험 항목: ${esc(rfq.categories.join(", "))}<br>
      의뢰 목적: ${esc(rfq.purpose || "-")} · 요청 성격: ${esc(rfq.intent || "-")} · 기밀 등급: ${esc(rfq.confidentiality || "일반")}${masked ? " (첨부는 CDA 체결 확인 후)" : ""}</p>
      <p style="font-size:13px;color:#6F6A63">의뢰자 회사명과 담당자 연락처는 의뢰자가 비교표에서 귀 기관을 선정하면 공개됩니다.</p>
      <p style="font-size:15px"><b>회신 기한 ${esc(replyBy)}</b> · 링크는 기한 +7일까지 열립니다.</p>
      <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#2A55A5;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600">요청서 보고 회신하기</a></p>
      <p style="font-size:13px;color:#6F6A63">${guide}</p>`);
}

/**
 * 배포 메일이 가지 않은 초대(mailed_at 없음, 최근 3일, 아직 열린 것)를 다시 보낸다. 매일 cron 이 부른다.
 * 성공하면 mailed_at 을 찍어 두 번 보내지 않는다
 */
export async function resendUnmailedInvites(): Promise<{ tried: number; sent: number }> {
  const sb = getSupabaseAdmin();
  const out = { tried: 0, sent: 0 };
  if (!sb) return out;
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const today = nowSeoul().toLocaleDateString("sv-SE");
  const { data: invites } = await sb.from("rfq_invites").select("*").is("mailed_at", null).in("status", ["sent", "draft"]).gte("sent_at", since).gte("reply_by", today).limit(50);
  for (const inv of invites ?? []) {
    out.tried++;
    const { data: rfq } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
    if (!rfq || rfq.compared_at || ["selected", "contracting", "closed", "cancelled"].includes(rfq.status)) continue;
    let to = [inv.cro_email];
    const mailOpts: InviteMailOpts = { members: 0 };
    if (inv.cro_org_id) {
      const [{ data: ms }, { data: org }] = await Promise.all([
        sb.from("profiles").select("email").eq("cro_org_id", inv.cro_org_id),
        sb.from("cro_orgs").select("managed").eq("id", inv.cro_org_id).maybeSingle(),
      ]);
      to = [...new Set([inv.cro_email, ...(ms ?? []).map((m) => m.email)])];
      mailOpts.members = (ms ?? []).length;
      mailOpts.managed = !!org?.managed;
    }
    const mailTo = await notificationRecipients(to);
    if (!mailTo.length) continue;
    const ok = await sendMail({ to: mailTo, subject: inviteMailSubject(rfq, inv.reply_by), html: inviteMailHtml(rfq, inv.reply_by, inv.token, inv.id, mailOpts), replyTo: inviteReplyTo(mailOpts) }).catch(() => false);
    if (ok) {
      out.sent++;
      await sb.from("rfq_invites").update({ mailed_at: new Date().toISOString() }).eq("id", inv.id);
    }
  }
  return out;
}

/** 접수 직후 자동 배포. 맞는 기관이 없으면 운영자에게만 알린다. */
export async function autoDistribute(rfq: RfqRow): Promise<DistributeResult & { matched: number }> {
  const replyBy = defaultReplyBy(rfq);
  const { orgs, skipped } = await matchOrgs(rfq);
  // 의뢰자가 지명한 기관이 있으면 먼저 보낸다 (기관 수 한도 안에서). 분야가 안 맞아도 의뢰자의 선택을 존중한다
  const nominees = Array.isArray(rfq.payload.nominees) ? (rfq.payload.nominees as string[]) : [];
  let first: DistributeResult = { sent: 0, mailed: 0, names: [], skipped: [], capped: [] };
  let nominated: Org[] = [];
  if (nominees.length) {
    const sb = getSupabaseAdmin();
    // 지명 목록(/api/orgs)에 운영자 관리 기관은 나오지 않는다. 이름이 같아도 여기서 다시 거른다
    const { data } = sb ? await sb.from("cro_orgs").select(ORG_COLUMNS).eq("status", "approved").eq("managed", false).in("name", nominees) : { data: [] };
    nominated = (data ?? []) as Org[];
    if (nominated.length) first = await distributeTo(rfq, nominated, replyBy, null, true, "nominated");
  }
  const nominatedIds = new Set(nominated.map((o) => o.id));
  const rest = orgs.filter((o) => !nominatedIds.has(o.id));
  const r = first.blocked ? { ...first, sent: 0, mailed: 0, names: [], skipped: [], capped: [] } : await distributeTo(rfq, rest, replyBy, null, true);
  return {
    sent: first.sent + r.sent,
    mailed: first.mailed + r.mailed,
    names: [...first.names, ...r.names],
    skipped: [...first.skipped, ...r.skipped, ...skipped],
    capped: [...first.capped, ...r.capped],
    blocked: first.blocked ?? r.blocked,
    matched: orgs.length + nominated.filter((o) => !orgs.some((m) => m.id === o.id)).length,
  };
}

/**
 * 새로 승인된 기관에 아직 열려 있는 요청서를 배포한다.
 * - 대상: 이미 배포되어 회신을 받는 중이고(회신 마감 전), 회신 기한이 지나지 않았고, 분야가 맞는 요청
 *   아직 배포된 적 없는 요청은 접수 후 30일 이내인 것만 포함한다 (해당 분야 기관이 없어 기다리던 요청)
 * - 회신 기한은 먼저 배포된 기관과 같게 한다 (같은 조건에서 경쟁)
 * - 이미 초대한 요청은 건너뛴다
 * 기관 승인·담당자 연결·수행 분야 변경 때, 그리고 매일 cron 이 부른다. auto_distribute 가 꺼진 요청은 건너뛴다.
 * orgId 를 주지 않으면 승인된 모든 기관을 대상으로 빠진 배포를 채운다 (매일 실행, 안전망).
 */
export async function distributeOpenRfqs(orgId?: string, actorId: string | null = null): Promise<{ rfqs: number; invites: number }> {
  const sb = getSupabaseAdmin();
  const out = { rfqs: 0, invites: 0 };
  if (!sb) return out;
  const today = nowSeoul().toLocaleDateString("sv-SE");
  const { data } = await sb.from("rfq_requests").select("*").in("status", ["received", "distributed", "quoted"]).order("created_at");
  // 아직 배포된 적 없는 요청은 접수 후 30일 이내인 것만 살린다 (기관이 없어 기다리던 요청)
  const fresh = new Date(Date.now() - 30 * 864e5).toISOString();
  let list = (data ?? []).filter((r) => (r.status === "received" ? r.created_at >= fresh : true));
  if (orgId) {
    // 화면을 열 때마다 불리므로, 이 기관이 받을 것이 있는지부터 가볍게 거른다
    const { data: org } = await sb.from("cro_orgs").select("status, categories, managed").eq("id", orgId).maybeSingle();
    // 운영자 관리 기관은 자동 보충하지 않는다 (matchOrgs 와 같은 규칙)
    if (!org || org.status !== "approved" || org.managed) return out;
    const cats = (org.categories ?? []) as string[];
    const { data: inv } = await sb.from("rfq_invites").select("rfq_id").eq("cro_org_id", orgId);
    const invited = new Set((inv ?? []).map((i) => i.rfq_id as string));
    list = list.filter((r) => !invited.has(r.id) && r.categories.some((c) => cats.includes(c)));
  }
  for (const rfq of list) {
    if (rfq.compared_at || rfq.selected_quote_id) continue;
    // 운영자가 수동 배포하면서 자동 보충을 끈 요청은 건드리지 않는다
    if (rfq.auto_distribute === false) continue;
    // 회신 기한: 정해져 있으면 그대로(먼저 받은 기관과 같게), 없으면 지금 기준으로 새로 잡는다
    const replyBy = defaultReplyBy(rfq);
    if (replyBy < today) continue;
    const { orgs } = await matchOrgs(rfq);
    const targets = orgId ? orgs.filter((o) => o.id === orgId) : orgs;
    if (!targets.length) continue;
    const r = await distributeTo(rfq, targets, replyBy, actorId, true);
    if (r.sent) { out.rfqs++; out.invites += r.sent; }
  }
  return out;
}

type InvitedRow = { id: string; token: string; cro_org_id: string | null; cro_email: string };

/**
 * 초대받은 기관들에 같은 안내(기한 변경·취소·마무리·미선정)를 기관마다 따로 보낸다.
 * - 한 메일의 받는 사람 칸에 경쟁 기관의 주소가 함께 보이지 않게 기관마다 한 통씩 보낸다.
 * - 담당자 계정이 있는 기관은 앱 알림과 포털 링크(portalHref, 없으면 /cro/r/{초대}),
 *   계정이 없거나 운영자 관리 기관은 로그인 없는 회신 링크(/q/{token})로 보낸다. /cro 는 로그인이 필요해 막힌 길이 된다.
 * - 운영자 관리 기관의 회신은 운영 역할 주소로 받는다.
 */
export async function notifyInvitedOrgs(invites: InvitedRow[], n: { kind: NotifyKind; title: string; body?: string; portalHref?: string }): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !invites.length) return;
  const orgIds = [...new Set(invites.map((i) => i.cro_org_id).filter((x): x is string => !!x))];
  let members: { id: string; email: string | null; cro_org_id: string | null }[] = [];
  let managed = new Set<string>();
  if (orgIds.length) {
    const [{ data: ms }, { data: orgs }] = await Promise.all([
      sb.from("profiles").select("id, email, cro_org_id").in("cro_org_id", orgIds),
      sb.from("cro_orgs").select("id, managed").in("id", orgIds),
    ]);
    members = (ms ?? []) as typeof members;
    managed = new Set((orgs ?? []).filter((o) => o.managed).map((o) => o.id as string));
  }
  const seen = new Set<string>();
  for (const i of invites) {
    const key = i.cro_org_id ?? `mail:${i.cro_email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mine = members.filter((m) => !!i.cro_org_id && m.cro_org_id === i.cro_org_id);
    const isManaged = managed.has(i.cro_org_id ?? "");
    const path = replyPath(i, { managed: isManaged, members: mine.length });
    const href = path.startsWith("/cro/") ? n.portalHref ?? path : path;
    const to = [...new Set([i.cro_email, ...mine.map((m) => m.email)].filter((x): x is string => !!x))];
    await notifyUsers(mine.map((m) => m.id), { kind: n.kind, title: n.title, body: n.body, href }, { to, replyTo: inviteReplyTo({ managed: isManaged }) });
  }
}
