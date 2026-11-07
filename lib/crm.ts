/**
 * 기관 CRM 서버 코드 (2026-11-07, 0038). 화면·API 가 함께 쓴다.
 * 모든 행은 org_id 로 묶이고, 기관 담당자 모두가 같이 보고 고친다 (작성자는 표시만).
 * 단추는 이 기록을 요청 전달 순서·비교표·노출·청구에 쓰지 않는다.
 */
import { getSupabaseAdmin } from "./supabase";
import { listAwardsForOrg, listInvitesForOrg, type InviteWithQuote } from "./data";
import { OTHER_CATS } from "./study-kinds";
import { danchuPatch, danchuSrcOf, danchuTarget, type DanchuSrc } from "./crm-deals";
import {
  findCompanyByName, normName,
  type CrmActivity, type CrmCompany, type CrmContact, type CrmDeal, type CrmEvent, type CrmQuote, type CrmTask, type CrmTaskAction, type DealHistory, type Member,
} from "./crm-shape";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type Award = Awaited<ReturnType<typeof listAwardsForOrg>>[number];

export type CrmData = {
  ready: boolean;
  companies: CrmCompany[];
  contacts: CrmContact[];
  deals: CrmDeal[];
  history: DealHistory[];
  events: CrmEvent[];
  activities: CrmActivity[];
  tasks: CrmTask[];
  quotes: CrmQuote[];
  members: Member[];
  /** 기관 공용 메일 기록 주소 앞부분 (메일 기록이 꺼져 있으면 null) */
  mailKey: string | null;
};

const EMPTY: CrmData = { ready: false, companies: [], contacts: [], deals: [], history: [], events: [], activities: [], tasks: [], quotes: [], members: [], mailKey: null };
export const QUOTE_COLS = "id, doc_no, title, client, supply, status, sent_at, valid_until, deal_id, company_id, contact_id, rfq_no, updated_at, created_at, issued_on, invite_id";

export const memberName = (p: { name: string | null; email: string }) => p.name || p.email.split("@")[0];

/** 메일 기록 주소 도메인. 비어 있으면 메일 기록을 쓰지 않는다 (화면에 주소를 보이지 않는다) */
export const crmMailDomain = () => (process.env.CRM_MAIL_DOMAIN ?? "").trim().toLowerCase() || null;

export async function listMembers(sb: Admin, orgId: string): Promise<Member[]> {
  const { data } = await sb.from("profiles").select("id, name, email").eq("cro_org_id", orgId).order("created_at");
  return (data ?? []).map((p) => ({ id: p.id, name: memberName(p) }));
}

/**
 * 기관의 CRM 전부. 1단계는 기관 하나의 규모가 작아 한 번에 읽고 화면에서 거른다.
 * 기록은 최근 3,000건까지 (오래된 기록은 고객사 화면에서 따로 더 읽는다).
 */
export async function loadCrm(orgId: string): Promise<CrmData> {
  const sb = getSupabaseAdmin();
  if (!sb) return EMPTY;
  const [co, ct, dl, hi, ev, ac, tk, qd, mem, st] = await Promise.all([
    sb.from("cro_crm_companies").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(3000),
    sb.from("cro_crm_contacts").select("*").eq("org_id", orgId).order("created_at").limit(6000),
    sb.from("cro_crm_deals").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(5000),
    sb.from("cro_crm_deal_history").select("id, deal_id, from_stage, to_stage, from_status, to_status, reason, actor, created_by, at").eq("org_id", orgId).order("at").limit(20000),
    sb.from("cro_crm_events").select("*").eq("org_id", orgId).order("starts_at").limit(5000),
    sb.from("cro_crm_activities").select("*").eq("org_id", orgId).order("occurred_at", { ascending: false }).limit(3000),
    sb.from("cro_crm_tasks").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(3000),
    sb.from("cro_quote_docs").select(QUOTE_COLS).eq("org_id", orgId).order("created_at").limit(3000),
    listMembers(sb, orgId),
    sb.from("cro_crm_settings").select("mail_key").eq("org_id", orgId).maybeSingle(),
  ]);
  // 0038 이 아직 적용되지 않았으면 빈 CRM 으로 보여 준다
  if (dl.error) {
    console.warn("crm load", dl.error.message);
    return { ...EMPTY, members: mem };
  }
  const tasks = (tk.data ?? []) as CrmTask[];
  const ta = tasks.length ? await sb.from("cro_crm_task_actions").select("id, task_id, body, at, created_by").in("task_id", tasks.map((t) => t.id)).order("at").limit(5000) : { data: [] };
  const actBy = new Map<string, CrmTaskAction[]>();
  for (const a of (ta.data ?? []) as CrmTaskAction[]) actBy.set(a.task_id, [...(actBy.get(a.task_id) ?? []), a]);
  let mailKey = st.data?.mail_key ?? null;
  if (!mailKey && crmMailDomain()) {
    const { data } = await sb.from("cro_crm_settings").upsert({ org_id: orgId }, { onConflict: "org_id", ignoreDuplicates: true }).select("mail_key").maybeSingle();
    mailKey = data?.mail_key ?? (await sb.from("cro_crm_settings").select("mail_key").eq("org_id", orgId).maybeSingle()).data?.mail_key ?? null;
  }
  return {
    ready: true,
    companies: (co.data ?? []) as CrmCompany[],
    contacts: (ct.data ?? []) as CrmContact[],
    deals: (dl.data ?? []) as CrmDeal[],
    history: (hi.data ?? []) as DealHistory[],
    events: (ev.data ?? []) as CrmEvent[],
    activities: (ac.data ?? []) as CrmActivity[],
    tasks: tasks.map((t) => ({ ...t, actions: actBy.get(t.id) ?? [] })),
    quotes: (qd.data ?? []) as CrmQuote[],
    members: mem,
    mailKey: crmMailDomain() ? mailKey : null,
  };
}

/** 시험 항목으로 갈래 짐작 (요청서의 네 갈래와 같은 경계) */
export function kindOfCats(cats: string[]): string {
  if (!cats.length) return "";
  if (cats.every((c) => (OTHER_CATS as string[]).includes(c))) return "other";
  if (cats.includes("효력시험(약효)")) return "pd";
  if (cats.every((c) => c === "PK/TK/ADME·생체시료분석")) return "pk";
  return "tox";
}

/** 흔한 메일 서비스는 회사 도메인으로 쓰지 않는다 */
const FREE_MAIL = /^(gmail|naver|daum|hanmail|kakao|nate|hotmail|outlook|live|yahoo|icloud|me)\./i;
export const companyDomain = (email: string) => {
  const d = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return d && !FREE_MAIL.test(d) ? d : "";
};

/**
 * 단추 요청을 안건으로 (안건 화면·보드·오늘을 열 때 한 번씩).
 * - 참여한 요청마다 안건 하나 (org_id + invite_id). 단추에서 일어난 일만큼 앞으로 옮기고 이력을 남긴다 (lib/crm-deals.ts)
 * - 선정되면 의뢰자 회사·담당자를 고객사·담당자로 들이고 안건에 붙인다 (이미 있는 이름·별칭이면 그 고객사)
 * - 그 요청에 쓴 견적서(invite_id 같음)를 안건에 묶는다
 * 돌려주는 값: 바뀐 행이 있으면 true (화면이 다시 읽는다)
 */
export async function syncDanchu(orgId: string, invites: InviteWithQuote[], awards: Award[], data: CrmData, by: string | null, now = Date.now()): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb || !data.ready) return false;
  let changed = false;
  const companies = [...data.companies];
  const byKey = new Map(data.contacts.filter((c) => c.danchu_key).map((c) => [c.danchu_key as string, c]));
  const dealBy = new Map(data.deals.filter((d) => d.invite_id).map((d) => [d.invite_id as string, d]));
  const awardBy = new Map(awards.filter((a) => a.invite_id).map((a) => [a.invite_id as string, a]));
  // 오래된 요청부터: 처음 선정한 회사가 먼저 고객사가 된다
  for (const i of [...invites].sort((x, y) => x.sent_at.localeCompare(y.sent_at))) {
    if (i.revoked_at && !i.joined_at) continue;
    const award = awardBy.get(i.id) ?? null;
    const src = danchuSrcOf(i as never, award as never);
    const t = danchuTarget(src, now);
    if (!t) continue;
    let deal = dealBy.get(i.id) ?? null;
    const p = danchuPatch(deal, t);
    if (!deal) {
      const { data: made, error } = await sb.from("cro_crm_deals").insert({
        org_id: orgId, invite_id: i.id, rfq_no: i.rfq_no, kind: kindOfCats(i.rfq?.categories ?? []), substance: (i.rfq?.substance ?? "").slice(0, 200),
        owner: i.join_user_id ?? null, created_by: by, created_at: t.steps[0].at, title: t.title, ...(p.patch as object),
      } as never).select("*").single();
      if (error || !made) {
        if (error?.code !== "23505") console.error("crm sync deal", error);
        continue;
      }
      deal = made as CrmDeal;
      dealBy.set(i.id, deal);
      changed = true;
    } else if (Object.keys(p.patch).length) {
      const { error } = await sb.from("cro_crm_deals").update(p.patch as never).eq("id", deal.id).eq("org_id", orgId).eq("status", "open");
      if (error) { console.error("crm sync deal update", error); continue; }
      deal = { ...deal, ...p.patch };
      changed = true;
    }
    if (p.history.length) {
      await sb.from("cro_crm_deal_history").insert(p.history.map((h) => ({ ...h, org_id: orgId, deal_id: (deal as CrmDeal).id })) as never);
    }
    // 선정: 고객사·담당자 들이기
    if (src.client && !deal.company_id) {
      const contact = await ensureClient(sb, orgId, src.client, companies, byKey, by);
      if (contact) {
        await sb.from("cro_crm_deals").update({ company_id: contact.company_id, contact_ids: [...new Set([contact.id, ...deal.contact_ids])].slice(0, 10) } as never).eq("id", deal.id).eq("org_id", orgId);
        deal = { ...deal, company_id: contact.company_id };
        changed = true;
      }
    }
    // 견적서 묶기
    const loose = data.quotes.filter((q) => q.invite_id === i.id && (!q.deal_id || (deal.company_id && !q.company_id)));
    if (loose.length) {
      const lead = deal.contact_ids[0] ?? null;
      await sb.from("cro_quote_docs").update({ deal_id: deal.id, ...(deal.company_id ? { company_id: deal.company_id, contact_id: lead } : {}) } as never).in("id", loose.map((q) => q.id)).eq("org_id", orgId);
      changed = true;
    }
  }
  return changed;
}

async function ensureClient(sb: Admin, orgId: string, c: NonNullable<DanchuSrc["client"]>, companies: CrmCompany[], byKey: Map<string, CrmContact>, by: string | null): Promise<CrmContact | null> {
  const hit = byKey.get(c.key);
  if (hit) return hit;
  const name = c.company || "이름 없는 의뢰자";
  let company = findCompanyByName(companies, name);
  if (!company) {
    const { data: made, error } = await sb.from("cro_crm_companies").insert({ org_id: orgId, name, industry: c.orgType, source: "danchu", email_domain: companyDomain(c.email), owner: by, created_by: by } as never).select("*").single();
    if (error || !made) { console.error("crm sync company", error); return null; }
    company = made as CrmCompany;
    companies.push(company);
  }
  const { data: made, error } = await sb.from("cro_crm_contacts").insert({
    org_id: orgId, company_id: company.id, name: c.contactName || "담당자", email: c.email, phone: c.phone, source: "danchu", danchu_key: c.key, created_by: by,
  } as never).select("*").single();
  if (error) {
    // 23505: 동시에 연 다른 화면이 먼저 만들었다
    if (error.code === "23505") {
      const { data } = await sb.from("cro_crm_contacts").select("*").eq("org_id", orgId).eq("danchu_key", c.key).maybeSingle();
      if (data) byKey.set(c.key, data as CrmContact);
      return (data as CrmContact) ?? null;
    }
    console.error("crm sync contact", error);
    return null;
  }
  byKey.set(c.key, made as CrmContact);
  return made as CrmContact;
}

export type CrmBundle = { data: CrmData; invites: InviteWithQuote[]; awards: Award[]; danchu: Map<string, DanchuSrc> };

/** CRM 화면을 열 때: 읽고, 단추 요청을 안건으로 맞추고, 바뀌었으면 다시 읽는다 */
export async function loadCrmSynced(orgId: string, opts: { userId: string; demo?: boolean }): Promise<CrmBundle> {
  const [data, invites, awards] = await Promise.all([loadCrm(orgId), listInvitesForOrg(orgId), listAwardsForOrg(orgId)]);
  const awardBy = new Map(awards.filter((a) => a.invite_id).map((a) => [a.invite_id as string, a]));
  const danchu = new Map(invites.map((i) => [i.id, danchuSrcOf(i as never, (awardBy.get(i.id) ?? null) as never)]));
  if (opts.demo || !data.ready) return { data, invites, awards, danchu };
  const changed = await syncDanchu(orgId, invites, awards, data, opts.userId).catch((e) => { console.error("crm sync", e); return false; });
  return { data: changed ? await loadCrm(orgId) : data, invites, awards, danchu };
}

/** 단계·상태를 바꾸고 이력 한 줄 (기관 담당자) */
export async function moveDeal(sb: Admin, orgId: string, deal: CrmDeal, to: { stage?: string; status?: string; reason?: string; note?: string; won_amount?: number | null }, by: string): Promise<string | null> {
  const stage = to.stage ?? deal.stage;
  const status = to.status ?? deal.status;
  if (stage === deal.stage && status === deal.status) return null;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { stage, status };
  if (stage !== deal.stage) patch.stage_at = now;
  if (status !== deal.status) {
    patch.closed_at = status === "open" ? null : now;
    patch.lost_reason = status === "lost" ? to.reason ?? "기타" : "";
    patch.lost_note = status === "lost" ? to.note ?? "" : "";
    if (status === "won") patch.won_amount = to.won_amount ?? deal.won_amount ?? deal.amount;
    if (status === "open") patch.won_amount = null;
  }
  const { error } = await sb.from("cro_crm_deals").update(patch as never).eq("id", deal.id).eq("org_id", orgId);
  if (error) { console.error("crm move", error); return "단계를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요."; }
  await sb.from("cro_crm_deal_history").insert({ org_id: orgId, deal_id: deal.id, from_stage: deal.stage, to_stage: stage, from_status: deal.status, to_status: status, reason: status === "lost" ? to.reason ?? "기타" : "", actor: "member", created_by: by } as never);
  return null;
}

/**
 * 두 고객사를 하나로 (drop → keep). 담당자·안건·기록·일정·할 일·견적서를 옮기고, 지우는 쪽 이름은 별칭으로 남긴다.
 */
export async function mergeCompanies(sb: Admin, orgId: string, keepId: string, dropId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (keepId === dropId) return { ok: false, error: "같은 고객사예요." };
  const { data: both } = await sb.from("cro_crm_companies").select("*").eq("org_id", orgId).in("id", [keepId, dropId]);
  const keep = both?.find((c) => c.id === keepId);
  const drop = both?.find((c) => c.id === dropId);
  if (!keep || !drop) return { ok: false, error: "합칠 고객사를 찾지 못했어요." };
  for (const t of ["cro_crm_contacts", "cro_crm_deals", "cro_crm_activities", "cro_crm_events", "cro_crm_tasks", "cro_quote_docs"] as const) {
    const { error } = await sb.from(t).update({ company_id: keepId } as never).eq("org_id", orgId).eq("company_id", dropId);
    if (error) { console.error("crm merge", t, error); return { ok: false, error: "합치는 중에 멈췄어요. 잠시 뒤 다시 시도해 주세요." }; }
  }
  const aliases = [...new Set([...keep.aliases, drop.name, ...drop.aliases].map((x) => x.trim()).filter((x) => x && normName(x) !== normName(keep.name)))].slice(0, 20);
  const fill = <K extends "industry" | "biz_no" | "address" | "website" | "email_domain">(k: K) => keep[k] || drop[k];
  const firsts = [keep.first_deal_on, drop.first_deal_on].filter(Boolean).sort();
  await sb.from("cro_crm_companies").update({
    aliases, industry: fill("industry"), biz_no: fill("biz_no"), address: fill("address"), website: fill("website"), email_domain: fill("email_domain"), owner: keep.owner ?? drop.owner,
    memo: [keep.memo, drop.memo].filter(Boolean).join("\n\n"), first_deal_on: firsts[0] ?? null, source: keep.source === "danchu" || drop.source === "danchu" ? "danchu" : keep.source,
  }).eq("id", keepId).eq("org_id", orgId);
  const { error } = await sb.from("cro_crm_companies").delete().eq("id", dropId).eq("org_id", orgId);
  if (error) return { ok: false, error: "옮기기는 끝났지만 이전 고객사를 지우지 못했어요. 다시 시도해 주세요." };
  return { ok: true };
}

/**
 * 다른 행을 가리키는 칸이 모두 이 기관 것인지 (다른 기관 id 를 끼워 넣지 못하게).
 * 담당자는 고르는 고객사에 속해야 한다.
 */
export async function checkRefs(sb: Admin, orgId: string, r: {
  company_id?: string | null; deal_id?: string | null; contact_id?: string | null; contact_ids?: string[]; quote_doc_id?: string | null; event_id?: string | null; activity_id?: string | null; task_id?: string | null;
  attendee_contacts?: string[]; attendee_members?: string[]; assignee?: string | null; owner?: string | null;
}): Promise<string | null> {
  const one = async (t: "cro_crm_companies" | "cro_crm_deals" | "cro_crm_events" | "cro_crm_activities" | "cro_crm_tasks" | "cro_quote_docs", id: string | null | undefined) => {
    if (!id) return true;
    const { data } = await sb.from(t).select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
    return !!data;
  };
  if (!(await one("cro_crm_companies", r.company_id))) return "고객사를 찾지 못했어요.";
  if (!(await one("cro_crm_deals", r.deal_id))) return "안건을 찾지 못했어요.";
  if (!(await one("cro_quote_docs", r.quote_doc_id))) return "견적서를 찾지 못했어요.";
  if (!(await one("cro_crm_events", r.event_id))) return "일정을 찾지 못했어요.";
  if (!(await one("cro_crm_activities", r.activity_id))) return "기록을 찾지 못했어요.";
  if (!(await one("cro_crm_tasks", r.task_id))) return "할 일을 찾지 못했어요.";
  const cids = [...new Set([r.contact_id, ...(r.contact_ids ?? []), ...(r.attendee_contacts ?? [])].filter((x): x is string => !!x))];
  if (cids.length) {
    const { data } = await sb.from("cro_crm_contacts").select("id, company_id").eq("org_id", orgId).in("id", cids);
    if ((data ?? []).length !== cids.length) return "담당자를 찾지 못했어요.";
    if (r.company_id && data?.some((c) => c.company_id !== r.company_id)) return "다른 고객사의 담당자가 섞여 있어요.";
  }
  const mids = [...new Set([r.assignee, r.owner, ...(r.attendee_members ?? [])].filter((x): x is string => !!x))];
  if (mids.length) {
    const { data } = await sb.from("profiles").select("id").eq("cro_org_id", orgId).in("id", mids);
    if ((data ?? []).length !== mids.length) return "우리 기관 담당자가 아닌 사람이 있어요.";
  }
  return null;
}
