import { notificationRecipients } from "./mail-preferences";
import { inviteExpiresAt, joinDeadline, maskedClientLabel, needsCda, type InviteSource } from "@/lib/request-policy";
import { getSupabaseAdmin } from "./supabase";
import type { RfqRow } from "./data";
import type { TablesUpdate } from "./db-types";
import { logEvent, notifyUsers, operatorReplyTo, siteUrl, type NotifyKind } from "./notify";
import { mailWrap, esc, sendMail } from "./mail";
import { addBusinessDays, nowSeoul } from "./dates";
import { quoteRowsFromPayload } from "./quote-items";
import { rowKey } from "./catalog";
import { replyPath } from "./concierge";
import { assertSchemaReady } from "./schema-version";
import { captureError } from "./observe";

export type DistributeResult = {
  sent: number;
  mailed: number;
  names: string[];
  skipped: string[];
  /**
   * DB 트리거가 막은 이유. request_not_open: 회신 마감(compared_at)·선정 이후 / nominees_only: "지명 기관에만 안내" 요청에 자동 매칭 안내 (0023).
   * 자리 수로는 막지 않는다. 안내는 분야가 맞는 기관 모두에게 가고, 자리는 기관이 참여할 때 join_offer 가 센다
   */
  blocked?: "request_not_open" | "nominees_only";
  /** 이번 호출로 요청이 바뀐 값 (처음 안내한 시각, 다시 잡은 참여 결정 기한). 같은 요청으로 이어 부를 때 넘긴다 */
  after?: { distributed_at: string | null; join_by: string | null; status: string; reply_by: string | null };
};

type Org = { id: string; name: string; contact_email: string | null; categories: string[]; glp_certs: string[]; managed?: boolean };

/**
 * 배포 대상 기관 조회에 쓰는 컬럼 (운영자 수동 배포 라우트와 같게).
 * 요금 약정(건당 이용료·요율·구독료)은 읽지 않는다. 약정은 어느 기관에 보낼지에 영향을 주지 않는다 (월 전달 한도는 0020 에서 없앴다)
 */
export const ORG_COLUMNS = "id, name, contact_email, categories, glp_certs, managed";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** 기관에 메일을 보낼 때 쓰는 지금의 연락처: 대표 메일, 지금 소속 담당자, 운영자 관리 여부 */
export type OrgMailTarget = { managed: boolean; contactEmail: string | null; members: { id: string; email: string | null }[] };

/**
 * 기관별 지금의 연락처를 한 번에 읽는다. 회신 링크(토큰)가 들어가는 메일은 모두 이것으로 받는 사람을 정한다.
 * 초대에 저장된 cro_email 은 배포 당시 주소라 이미 떠난 담당자일 수 있다 (토큰을 새로 발급해도 그 주소로 보내면 소용없다, 0021)
 */
export async function orgMailTargets(sb: Admin, orgIds: string[]): Promise<Map<string, OrgMailTarget>> {
  const out = new Map<string, OrgMailTarget>();
  const ids = [...new Set(orgIds.filter(Boolean))];
  if (!ids.length) return out;
  const [{ data: orgs }, { data: ms }] = await Promise.all([
    sb.from("cro_orgs").select("id, managed, contact_email").in("id", ids),
    sb.from("profiles").select("id, email, cro_org_id").in("cro_org_id", ids),
  ]);
  for (const o of orgs ?? []) out.set(o.id, { managed: !!o.managed, contactEmail: o.contact_email ?? null, members: [] });
  for (const m of ms ?? []) {
    if (m.cro_org_id) out.get(m.cro_org_id)?.members.push({ id: m.id, email: m.email ?? null });
  }
  return out;
}

/** 초대 1건의 메일 받는 사람. 기관 초대는 지금의 대표 메일 + 지금 소속 담당자만, 기관 없는 초대만 초대에 적힌 주소 */
export function inviteMailTo(inv: { cro_org_id: string | null; cro_email: string | null }, t: OrgMailTarget | undefined): string[] {
  const list = inv.cro_org_id ? [t?.contactEmail, ...(t?.members ?? []).map((m) => m.email)] : [inv.cro_email];
  return [...new Set(list.filter((x): x is string => !!x && !!x.trim()))];
}

/**
 * 배포 대상 자동 선정.
 * - 승인된 기관 중 요청서 대분류와 수행 분야가 겹치는 기관
 * - 카탈로그에서 요청 항목 전부를 "수행하지 않음"으로 꺼 둔 기관은 제외
 * - 운영자 관리 기관(managed)은 제외. 참여 계약이 없는 기관이라 자동 배포·보충·지명으로 보내지 않고, 운영자가 배포 패널에서 요청마다 고른다
 * DB 를 읽지 못하면(연결·권한 오류, 마이그레이션 미적용) 빈 목록이 아니라 오류를 던진다. 빈 목록은 "맞는 기관 없음"이라는 뜻이라
 * 호출한 쪽이 운영자에게 "대상 없음"으로 알리고 끝내 버린다 (2026-10-18 보안 검토 #10)
 */
export async function matchOrgs(rfq: RfqRow): Promise<{ orgs: Org[]; skipped: string[] }> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("배포 대상 기관을 조회하지 못했습니다: Supabase 환경변수가 없습니다.");
  await assertSchemaReady(sb);
  const { data, error } = await sb.from("cro_orgs").select(ORG_COLUMNS).eq("status", "approved").eq("managed", false).order("id");
  if (error) throw new Error(`배포 대상 기관을 조회하지 못했습니다: ${error.message}`);
  const all = (data ?? []) as Org[];
  const cats = rfq.categories;
  const candidates = all.filter((o) => (o.categories ?? []).some((c) => cats.includes(c)));
  if (!candidates.length) return { orgs: [], skipped: [] };

  const rows = quoteRowsFromPayload(rfq.payload);
  const keys = rows.map(rowKey);
  const { data: cat, error: catError } = await sb.from("cro_catalog").select("org_id, item_key, available").in("org_id", candidates.map((o) => o.id)).in("item_key", keys);
  if (catError) throw new Error(`기관 카탈로그를 조회하지 못했습니다: ${catError.message}`);
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
 * 기관들에 참여 안내(초대 + 회신 링크)를 만들고 메일·알림을 보낸다. 이미 안내한 기관은 건너뛴다.
 * 운영자 수동 안내와 접수 시 자동 안내가 함께 쓴다.
 * 참여 선택형(0023): 자리 수(3곳·5곳·전체)로 자르지 않는다. 받은 기관이 요약을 보고 참여하기를 눌러야 자리를 얻고,
 * 자리는 join_offer 가 요청 행을 잠그고 센다. 그래서 안내 순서(기관 id 순)는 누가 견적을 쓰는지에 영향이 없다.
 */
export async function distributeTo(rfqIn: RfqRow, orgs: Org[], replyBy: string, actorId: string | null, auto = false, source: InviteSource = auto ? "matched" : "manual"): Promise<DistributeResult> {
  const sb = getSupabaseAdmin();
  const res: DistributeResult = { sent: 0, mailed: 0, names: [], skipped: [] };
  if (!sb || !orgs.length) return res;
  // 마이그레이션이 덜 된 DB 에 새 코드가 배포됐으면 초대를 만들기 전에 멈춘다 (README "배포 순서")
  await assertSchemaReady(sb);
  let rfq = rfqIn;
  // 참여 결정 기한은 처음 안내한 날부터 센다 (0023). 접수 때 안내할 기관이 없어 운영자나 보충 안내가 나중에 처음 보내면
  // 접수 때 잡은 기한이 이미 지났을 수 있으므로, 처음 안내할 때(distributed_at 이 비어 있을 때) 다시 잡고 메일에도 그 날짜를 쓴다
  if (!rfq.distributed_at) {
    const jb = joinDeadline(nowSeoul().toLocaleDateString("sv-SE"), replyBy);
    if (jb !== rfq.join_by) {
      const { error } = await sb.from("rfq_requests").update({ join_by: jb }).eq("id", rfq.id).is("distributed_at", null);
      if (error) captureError(new Error(`참여 결정 기한 저장 실패: ${error.message}`), "distribute:join-by");
      else rfq = { ...rfq, join_by: jb };
    }
  }
  // 기관별 월 전달 한도는 없다 (0020). 청구는 기관이 제출한 견적 기준이라 전달 자체에는 요금이 붙지 않는다

  const { data: existing, error: existingError } = await sb.from("rfq_invites").select("cro_org_id, status").eq("rfq_id", rfq.id);
  if (existingError) throw new Error("기존 배포 현황을 확인하지 못했습니다.");
  // 같은 기관에는 두 번 안내하지 않는다 (불참·철회한 기관도 다시 안내하지 않는다)
  const already = new Set((existing ?? []).map((e) => e.cro_org_id));
  const expiresAt = inviteExpiresAt(replyBy);
  // "지명 기관에만 안내" 요청에는 자동 매칭 안내를 만들지 않는다. DB 트리거도 막지만(0023) 메일을 보내기 전에 거른다
  if (rfq.nominees_only && source === "matched") {
    res.blocked = "nominees_only";
    res.skipped.push(...orgs.filter((o) => !already.has(o.id)).map((o) => o.name));
    return res;
  }

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
      .insert({ rfq_id: rfq.id, rfq_no: rfq.rfq_no, cro_name: o.name, cro_email: croEmail, cro_org_id: o.id, reply_by: replyBy, expires_at: expiresAt.toISOString(), source })
      .select("id, token")
      .single();
    if (error || !inv) {
      const m = error?.message || "";
      if (m.includes("request_not_open") || m.includes("nominees_only")) {
        // 트리거가 막은 것: 이 요청에는 더 못 보낸다. 사유를 그대로 돌려주고 멈춘다
        res.blocked = m.includes("request_not_open") ? "request_not_open" : "nominees_only";
        res.skipped.push(o.name);
        break;
      }
      res.skipped.push(o.name);
      console.error("invite insert", o.name, error);
      continue;
    }
    already.add(o.id);
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
    // 참여 전에는 시험물질명을 알리지 않는다 (요약에 없는 정보, 0023)
    await notifyUsers(memberIds, { kind: "배포", title: `새 참여 안내 · ${rfq.rfq_no}`, body: `${rfq.categories.join(" · ")} · 회신 기한 ${replyBy} · 요약을 보고 참여를 결정해 주세요.`, href: `/cro/r/${inv.id}` });
  }

  if (res.sent) {
    // rfq 는 배포를 시작할 때 읽은 값이다. 메일을 보내는 사이 기관이 제출하고 의뢰자가 선정했을 수 있으므로
    // 지금도 그 상태일 때만 바꾼다 (조건부 갱신). 조건이 맞지 않으면 아무것도 바꾸지 않는다 (2026-10-18 보안 검토 #5)
    const now = new Date().toISOString();
    const steps: { what: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [];
    if (rfq.status === "received") {
      const moved: TablesUpdate<"rfq_requests"> = { status: "distributed", distributed_at: now };
      steps.push({ what: "status", run: () => sb.from("rfq_requests").update(moved).eq("id", rfq.id).eq("status", "received") });
    }
    // 처음 배포한 시각과 회신 기한은 비어 있을 때만 채운다. 그 사이 운영자가 바꾼 기한을 옛 값으로 덮지 않는다
    if (!rfq.distributed_at) steps.push({ what: "distributed_at", run: () => sb.from("rfq_requests").update({ distributed_at: now }).eq("id", rfq.id).is("distributed_at", null) });
    if (!rfq.reply_by) steps.push({ what: "reply_by", run: () => sb.from("rfq_requests").update({ reply_by: replyBy }).eq("id", rfq.id).is("reply_by", null) });
    for (const st of steps) {
      // 초대와 메일은 이미 나갔으므로 여기서 던지지 않는다. 대신 크게 남긴다
      const { error } = await st.run();
      if (error) captureError(new Error(`배포 뒤 요청 갱신 실패 (${st.what}): ${error.message}`), "distribute:request-update");
    }
    res.after = { distributed_at: rfq.distributed_at ?? now, join_by: rfq.join_by ?? null, status: rfq.status === "received" ? "distributed" : rfq.status, reply_by: rfq.reply_by ?? replyBy };
    await logEvent(rfq.id, "distributed", `참여 안내 ${res.sent}곳${auto ? " (자동)" : ""}`, `${res.names.join(", ")} · 회신 기한 ${replyBy}`, actorId, { orgIds: orgs.map((o) => o.id), auto, source });
    // 의뢰자에게는 처음 안내할 때 한 번만 알린다. 안내받은 기관 수와 이름은 알리지 않는다 (의뢰자는 참여한 기관만 본다, 0023)
    if (!rfq.distributed_at) {
      const capNote = rfq.cro_count === "전체" ? "참여한 기관" : `먼저 참여한 기관 ${rfq.cro_count}`;
      if (rfq.user_id) {
        await notifyUsers([rfq.user_id], { kind: "배포", title: `${rfq.rfq_no} 분야가 맞는 기관에 참여 안내를 보냈습니다`, body: `${capNote}이 회신 기한 ${replyBy}까지 견적을 보냅니다. 견적이 도착하면 알려 드립니다.`, href: `/app/r/${rfq.rfq_no}` }, { to: [rfq.email] });
      } else {
        await notifyUsers([], { kind: "배포", title: `${rfq.rfq_no} 분야가 맞는 기관에 참여 안내를 보냈습니다`, body: `${capNote}이 회신 기한 ${replyBy}까지 견적을 보냅니다. 견적이 도착하면 이메일로 알려 드립니다. 진행 상황은 ${siteUrl()}/signup 에서 같은 이메일로 가입하면 볼 수 있습니다.` }, { to: [rfq.email] });
      }
    }
  }
  return res;
}

/** 참여 안내 메일의 버튼·제목 문구 (0023). 견적 요청이 아니라 참여 여부를 묻는 안내다 */
export const INVITE_MAIL_ACTION = "요약 보고 참여 결정";

/**
 * 참여 안내 메일 제목·본문. 첫 발송, cron 재발송, 운영자 재발송이 같은 것을 쓴다.
 * 참여 전 요약에 없는 것(시험물질명, 의뢰 목적, 의뢰자가 적은 자유 기술)은 메일에도 넣지 않는다 (0023)
 */
export function inviteMailSubject(rfq: Pick<RfqRow, "rfq_no">, replyBy: string): string {
  return `[단추] 참여 안내 ${rfq.rfq_no} · ${INVITE_MAIL_ACTION} · 회신 기한 ${replyBy}`;
}
/** 받는 기관의 종류. 운영자 관리 기관이나 담당자 계정이 없는 기관에는 로그인이 필요한 포털 링크를 넣지 않는다 */
export type InviteMailOpts = {
  managed?: boolean;
  members?: number;
  /** 참여 선택형 전환(lib/opt-in-transition.ts)으로 다시 보내는 안내. 예전에 견적 요청으로 받은 요청이라는 한 줄을 앞에 붙인다 */
  transition?: boolean;
};

/** 운영자 관리 기관은 견적서 PDF 를 메일 회신으로 보낼 수 있게 회신 주소를 운영 역할 주소(OPERATOR_REPLY_TO)로 둔다 */
export function inviteReplyTo(opts: InviteMailOpts = {}): string | undefined {
  return opts.managed ? operatorReplyTo() : undefined;
}

export function inviteMailHtml(rfq: Pick<RfqRow, "rfq_no" | "categories" | "intent" | "confidentiality" | "org_type" | "cro_count"> & Partial<Pick<RfqRow, "join_by" | "payload">>, replyBy: string, token: string, inviteId: string, opts: InviteMailOpts = {}): string {
  const link = `${siteUrl()}/q/${token}`;
  const portalPath = replyPath({ id: inviteId, token }, { managed: opts.managed, members: opts.members ?? 1 });
  const portal = portalPath.startsWith("/cro/") ? `${siteUrl()}${portalPath}` : "";
  const cda = needsCda(rfq.confidentiality);
  const items = rfq.payload ? quoteRowsFromPayload(rfq.payload).length : 0;
  const joinBy = rfq.join_by ? new Date(rfq.join_by).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "";
  const seats = rfq.cro_count === "전체" ? "참여한 기관은 모두 견적을 쓸 수 있습니다." : `견적 자리는 ${rfq.cro_count || "3곳"}이며 먼저 참여한 순서로 찹니다.`;
  const how = `링크에서 요약을 보고 <b>참여하기</b> 또는 <b>이번 요청 불참</b>을 눌러 주세요. 참여하시면 시험물질명, 의뢰자 설명, 첨부${opts.managed ? "" : ", 카탈로그로 채운 회신 초안"}이 열립니다. ${esc(seats)} 제출 전에는 언제든 철회할 수 있고, 철회하면 청구하지 않습니다(시범 운영 중 무료). 불참해도 다음 안내에 영향이 없습니다.`;
  const guide = opts.managed
    ? `단추는 비임상 시험 의뢰자가 여러 기관의 견적을 한곳에서 받아 비교하는 서비스이며, 귀 기관은 단추 운영자가 등록해 이 안내를 받았습니다.<br>참여는 귀 기관이 위 링크에서 직접 눌러 주셔야 합니다. 단추가 대신 참여할 수 없습니다. 참여하신 뒤에는 링크로 로그인 없이 회신하시거나, 정식 견적서 PDF를 이 메일에 회신으로 보내 주시면 단추가 견적서 내용을 같은 양식으로 옮겨 정리하고 "단추 정리 · 기관 PDF 기준"으로 표시합니다. 비교표에서는 귀 기관의 견적서 원본이 기준 문서로 함께 전달되며, 옮겨 적은 내용과 PDF가 다르면 PDF가 우선합니다. 의뢰자는 기한 전에도 선정할 수 있으니 견적서는 되도록 일찍 보내 주십시오.<br>다른 기관은 귀 기관의 견적을 볼 수 없습니다. 요청 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오. 앞으로 안내를 받지 않으시려면 이 메일에 "수신 거부"라고 회신해 주세요.<br>이 메일 주소는 단추 운영자가 귀 기관이 공개한 대표 연락처를 확인해 등록했습니다. 개인정보 처리 안내는 <a href="${esc(siteUrl())}/privacy">개인정보처리방침</a>에서 볼 수 있습니다.`
    : `${portal ? `로그인 없이 위 링크로 바로 열리며, 계정이 있으면 <a href="${esc(portal)}">CRO 포털</a>에서도 보입니다.` : "로그인 없이 위 링크로 바로 열립니다."}<br>제출한 견적은 즉시 의뢰자 비교표에 보이고, 회신이 마감되기 전까지 회신 기한 안에서 수정할 수 있습니다. 의뢰자가 기한 전에 기관을 선정하거나 운영자가 회신을 마감하면 회신이 닫힙니다. 다른 기관은 귀 기관의 견적을 볼 수 없습니다. 요청 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오.`;
  const transition = opts.transition
    ? `<p style="font-size:14px;padding:12px 14px;background:#F5F5F4;border-radius:6px">앞서 견적 요청으로 안내드린 요청입니다. 단추는 이제 기관이 요약을 보고 직접 참여한 요청에서만 견적을 받습니다. 견적을 보내시려면 아래 링크에서 참여하기를 먼저 눌러 주세요. 링크는 이전과 같습니다.</p>`
    : "";
  return mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">[단추] 견적 요청 참여 안내 · ${esc(rfq.rfq_no)}</h2>${transition}
      <p><b>${esc(maskedClientLabel(rfq.org_type))}</b><br>
      시험 분야: ${esc(rfq.categories.join(", "))}${items ? ` · 시험 항목 ${items}건` : ""}<br>
      요청 성격: ${esc(rfq.intent || "-")} · 기밀 등급: ${esc(rfq.confidentiality || "일반")}${cda ? " (첨부는 CDA 체결 확인 후)" : ""}</p>
      <p style="font-size:15px"><b>회신 기한 ${esc(replyBy)}</b>${joinBy ? ` · 참여 결정 기한 ${esc(joinBy)}` : ""} · 링크는 회신 기한 +7일까지 열립니다.</p>
      <p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#2A55A5;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600">${INVITE_MAIL_ACTION}</a></p>
      <p style="font-size:14px">${how}</p>
      <p style="font-size:13px;color:#6F6A63">의뢰자 회사명과 담당자 연락처는 의뢰자가 비교표에서 귀 기관을 선정하면 공개됩니다.</p>
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
    // 받는 사람은 지금의 대표 메일 + 지금 소속 담당자 (배포 당시의 cro_email 이 아님)
    const t = inv.cro_org_id ? (await orgMailTargets(sb, [inv.cro_org_id])).get(inv.cro_org_id) : undefined;
    const to = inviteMailTo(inv, t);
    const mailOpts: InviteMailOpts = { members: t?.members.length ?? 0, managed: !!t?.managed };
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

/** 접수 직후 자동 안내: 지명 기관 + 분야가 맞는 승인 기관 전부 (자리 수로 자르지 않는다, 0023). 맞는 기관이 없으면 운영자에게만 알린다. */
export async function autoDistribute(rfq: RfqRow): Promise<DistributeResult & { matched: number }> {
  const replyBy = defaultReplyBy(rfq);
  const { orgs, skipped } = await matchOrgs(rfq);
  // 의뢰자가 지명한 기관이 있으면 먼저 보낸다. 분야가 안 맞아도 의뢰자의 선택을 존중한다. 지명 기관 몫 자리는 join_offer 가 참여 결정 기한까지 비워 둔다
  const nominees = Array.isArray(rfq.payload.nominees) ? (rfq.payload.nominees as string[]) : [];
  let first: DistributeResult = { sent: 0, mailed: 0, names: [], skipped: [] };
  let nominated: Org[] = [];
  if (nominees.length) {
    const sb = getSupabaseAdmin();
    // 지명 목록(/api/orgs)에 운영자 관리 기관은 나오지 않는다. 이름이 같아도 여기서 다시 거른다
    if (!sb) throw new Error("지명 기관을 조회하지 못했습니다: Supabase 환경변수가 없습니다.");
    const { data, error } = await sb.from("cro_orgs").select(ORG_COLUMNS).eq("status", "approved").eq("managed", false).in("name", nominees);
    if (error) throw new Error(`지명 기관을 조회하지 못했습니다: ${error.message}`);
    nominated = (data ?? []) as Org[];
    if (nominated.length) first = await distributeTo(rfq, nominated, replyBy, null, true, "nominated");
  }
  const nominatedIds = new Set(nominated.map((o) => o.id));
  // "지명 기관에만 안내"면 분야가 맞는 다른 기관에는 안내하지 않는다 (0023)
  const rest = rfq.nominees_only ? [] : orgs.filter((o) => !nominatedIds.has(o.id));
  // 지명 기관 안내로 요청이 이미 "안내함"이 되었으면 그 값을 넘긴다. 의뢰자 알림("참여 안내를 보냈습니다")이 두 번 가지 않고, 참여 결정 기한도 다시 잡지 않는다
  const rfqNext: RfqRow = first.after ? { ...rfq, ...first.after } : rfq;
  const r = first.blocked ? { ...first, sent: 0, mailed: 0, names: [], skipped: [] } : await distributeTo(rfqNext, rest, replyBy, null, true);
  return {
    sent: first.sent + r.sent,
    mailed: first.mailed + r.mailed,
    names: [...first.names, ...r.names],
    skipped: [...first.skipped, ...r.skipped, ...skipped],
    blocked: first.blocked ?? r.blocked,
    matched: rest.length + nominated.length,
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
  const { data, error } = await sb.from("rfq_requests").select("*").in("status", ["received", "distributed", "quoted"]).order("created_at");
  if (error) throw new Error(`열린 요청을 조회하지 못했습니다: ${error.message}`);
  // 아직 배포된 적 없는 요청은 접수 후 30일 이내인 것만 살린다 (기관이 없어 기다리던 요청)
  const fresh = new Date(Date.now() - 30 * 864e5).toISOString();
  let list = (data ?? []).filter((r) => (r.status === "received" ? r.created_at >= fresh : true));
  if (orgId) {
    // 화면을 열 때마다 불리므로, 이 기관이 받을 것이 있는지부터 가볍게 거른다
    const { data: org, error: orgError } = await sb.from("cro_orgs").select("status, categories, managed").eq("id", orgId).maybeSingle();
    if (orgError) throw new Error(`기관을 조회하지 못했습니다: ${orgError.message}`);
    // 운영자 관리 기관은 자동 보충하지 않는다 (matchOrgs 와 같은 규칙)
    if (!org || org.status !== "approved" || org.managed) return out;
    const cats = (org.categories ?? []) as string[];
    const { data: inv, error: invError } = await sb.from("rfq_invites").select("rfq_id").eq("cro_org_id", orgId);
    if (invError) throw new Error(`기관의 기존 배포를 조회하지 못했습니다: ${invError.message}`);
    const invited = new Set((inv ?? []).map((i) => i.rfq_id as string));
    list = list.filter((r) => !invited.has(r.id) && r.categories.some((c) => cats.includes(c)));
  }
  for (const rfq of list) {
    if (rfq.compared_at || rfq.selected_quote_id) continue;
    // 운영자가 수동 배포하면서 자동 보충을 끈 요청, "지명 기관에만 안내" 요청은 건드리지 않는다
    if (rfq.auto_distribute === false || rfq.nominees_only) continue;
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
 * - 받는 사람은 지금의 대표 메일과 지금 소속 담당자다 (orgMailTargets). 떠난 담당자의 옛 주소로 새 링크가 가지 않는다.
 */
export async function notifyInvitedOrgs(invites: InvitedRow[], n: { kind: NotifyKind; title: string; body?: string; portalHref?: string }): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !invites.length) return;
  const targets = await orgMailTargets(sb, invites.map((i) => i.cro_org_id).filter((x): x is string => !!x));
  const seen = new Set<string>();
  for (const i of invites) {
    const key = i.cro_org_id ?? `mail:${i.cro_email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = i.cro_org_id ? targets.get(i.cro_org_id) : undefined;
    const mine = t?.members ?? [];
    const isManaged = !!t?.managed;
    const path = replyPath(i, { managed: isManaged, members: mine.length });
    const href = path.startsWith("/cro/") ? n.portalHref ?? path : path;
    // 지금의 대표 메일 + 지금 소속 담당자. 초대의 cro_email(배포 당시 주소)로는 보내지 않는다
    const to = inviteMailTo(i, t);
    await notifyUsers(mine.map((m) => m.id), { kind: n.kind, title: n.title, body: n.body, href }, { to, replyTo: inviteReplyTo({ managed: isManaged }) });
  }
}
