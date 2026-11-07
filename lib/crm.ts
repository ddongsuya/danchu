/**
 * 기관 CRM 1차 서버 코드 (2026-11-07, 0038). 화면·API 가 함께 쓴다.
 * 모든 행은 org_id 로 묶이고, 기관 담당자 모두가 같이 보고 고친다 (작성자는 표시만).
 * 단추는 이 기록을 요청 전달 순서·비교표·노출에 쓰지 않는다.
 */
import { getSupabaseAdmin } from "./supabase";
import { listAwardsForOrg } from "./data";
import { clientKeyOf } from "./pipeline";
import { identityVisible } from "./request-policy";
import {
  findCompanyByName, normName,
  type AwardLite, type CrmActivity, type CrmCompany, type CrmContact, type CrmEvent, type CrmQuote, type CrmTask, type CrmTaskAction, type Member, type QuoteTrack,
} from "./crm-shape";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type Award = Awaited<ReturnType<typeof listAwardsForOrg>>[number];

export type CrmData = {
  ready: boolean;
  companies: CrmCompany[];
  contacts: CrmContact[];
  events: CrmEvent[];
  activities: CrmActivity[];
  tasks: CrmTask[];
  quotes: CrmQuote[];
  tracks: QuoteTrack[];
  members: Member[];
};

const EMPTY: CrmData = { ready: false, companies: [], contacts: [], events: [], activities: [], tasks: [], quotes: [], tracks: [], members: [] };
const QUOTE_COLS = "id, doc_no, title, client, supply, status, deal_stage, sent_at, valid_until, contract_amount, lost_reason, company_id, contact_id, rfq_no, updated_at, issued_on, invite_id";

export const memberName = (p: { name: string | null; email: string }) => p.name || p.email.split("@")[0];

export async function listMembers(sb: Admin, orgId: string): Promise<Member[]> {
  const { data } = await sb.from("profiles").select("id, name, email").eq("cro_org_id", orgId).order("created_at");
  return (data ?? []).map((p) => ({ id: p.id, name: memberName(p) }));
}

/**
 * 기관의 CRM 전부. 1차는 기관 하나의 규모가 작아 한 번에 읽고 화면에서 거른다.
 * 기록은 최근 3,000건까지 (오래된 기록은 고객사 화면에서 따로 더 읽는다).
 */
export async function loadCrm(orgId: string): Promise<CrmData> {
  const sb = getSupabaseAdmin();
  if (!sb) return EMPTY;
  const [co, ct, ev, ac, tk, qd, mem] = await Promise.all([
    sb.from("cro_crm_companies").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(2000),
    sb.from("cro_crm_contacts").select("*").eq("org_id", orgId).order("created_at").limit(5000),
    sb.from("cro_crm_events").select("*").eq("org_id", orgId).order("starts_at").limit(5000),
    sb.from("cro_crm_activities").select("*").eq("org_id", orgId).order("occurred_at", { ascending: false }).limit(3000),
    sb.from("cro_crm_tasks").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(3000),
    sb.from("cro_quote_docs").select(QUOTE_COLS).eq("org_id", orgId).order("updated_at", { ascending: false }).limit(2000),
    listMembers(sb, orgId),
  ]);
  // 0038 이 아직 적용되지 않았으면 빈 CRM 으로 보여 준다
  if (co.error) {
    console.warn("crm load", co.error.message);
    return { ...EMPTY, members: mem };
  }
  const quotes = (qd.data ?? []) as CrmQuote[];
  const tasks = (tk.data ?? []) as CrmTask[];
  const [tr, ta] = await Promise.all([
    quotes.length ? sb.from("cro_quote_tracking").select("id, doc_id, stage, note, created_by, created_at").in("doc_id", quotes.map((q) => q.id)).order("created_at", { ascending: false }).limit(3000) : Promise.resolve({ data: [] }),
    tasks.length ? sb.from("cro_crm_task_actions").select("id, task_id, body, at, created_by").in("task_id", tasks.map((t) => t.id)).order("at").limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const actBy = new Map<string, CrmTaskAction[]>();
  for (const a of (ta.data ?? []) as CrmTaskAction[]) actBy.set(a.task_id, [...(actBy.get(a.task_id) ?? []), a]);
  return {
    ready: true,
    companies: (co.data ?? []) as CrmCompany[],
    contacts: (ct.data ?? []) as CrmContact[],
    events: (ev.data ?? []) as CrmEvent[],
    activities: (ac.data ?? []) as CrmActivity[],
    tasks: tasks.map((t) => ({ ...t, actions: actBy.get(t.id) ?? [] })),
    quotes,
    tracks: (tr.data ?? []) as QuoteTrack[],
    members: mem,
  };
}

/** 단추 수주를 고객사 화면에서 쓰는 모양으로. 선정된 요청만 (identityVisible) */
export function awardsLite(awards: Award[]): AwardLite[] {
  return awards
    .filter((a) => a.rfq && identityVisible({ awarded: true }))
    .map((a) => ({
      id: a.id, awarded_at: a.awarded_at, contract_reported_at: a.contract_reported_at, contract_amount: a.contract_amount, quoteAmount: a.quoteAmount,
      rfqNo: a.rfq?.rfq_no ?? "", substance: a.rfq?.substance ?? "", danchuKey: clientKeyOf(a.rfq),
    }));
}

/**
 * 선정된 의뢰자를 고객사·담당자로 들여온다 (고객사 화면을 열 때 한 번씩).
 * - 이미 같은 danchu_key 담당자가 있으면 건너뛴다 (기관이 고친 이름·소속은 덮어쓰지 않는다)
 * - 회사는 이름(주식회사·(주)·띄어쓰기 무시)과 별칭으로 기존 고객사를 먼저 찾고, 없으면 만든다
 * - 그 요청에 쓴 견적서(invite_id 같음)가 아직 고객사에 묶이지 않았으면 묶는다
 * 돌려주는 값: 새로 만든 행이 있으면 true (화면이 다시 읽는다)
 */
export async function syncAwardsToCrm(orgId: string, awards: Award[], data: CrmData, by: string | null): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb || !data.ready) return false;
  let changed = false;
  const companies = [...data.companies];
  const byKey = new Map(data.contacts.filter((c) => c.danchu_key).map((c) => [c.danchu_key as string, c]));
  // 오래된 수주부터: 처음 선정한 날이 고객사의 첫 거래가 된다
  for (const a of [...awards].reverse()) {
    const key = clientKeyOf(a.rfq);
    if (!a.rfq || !key) continue;
    let contact = byKey.get(key) ?? null;
    if (!contact) {
      const name = (a.rfq.company ?? "").trim() || "이름 없는 의뢰자";
      let company = findCompanyByName(companies, name);
      if (!company) {
        const { data: made, error } = await sb.from("cro_crm_companies").insert({ org_id: orgId, name, industry: a.rfq.org_type ?? "", source: "danchu", first_deal: true, created_by: by }).select("*").single();
        if (error || !made) { console.error("crm sync company", error); continue; }
        company = made as CrmCompany;
        companies.push(company);
      }
      const { data: c, error } = await sb.from("cro_crm_contacts").insert({
        org_id: orgId, company_id: company.id, name: (a.rfq.contact_name ?? "").trim() || "담당자", email: a.rfq.email ?? "", phone: a.rfq.phone ?? "", source: "danchu", danchu_key: key, created_by: by,
      }).select("*").single();
      // 23505: 동시에 연 다른 화면이 먼저 만들었다
      if (error && error.code !== "23505") { console.error("crm sync contact", error); continue; }
      if (c) { contact = c as CrmContact; byKey.set(key, contact); }
      changed = true;
    }
    if (contact && a.invite_id) {
      const loose = data.quotes.filter((q) => q.invite_id === a.invite_id && !q.company_id);
      if (loose.length) {
        await sb.from("cro_quote_docs").update({ company_id: contact.company_id, contact_id: contact.id }).in("id", loose.map((q) => q.id)).eq("org_id", orgId).is("company_id", null);
        changed = true;
      }
    }
  }
  return changed;
}

/** 고객사 화면을 열 때: 읽고, 선정 고객을 들여오고, 바뀌었으면 다시 읽는다 */
export async function loadCrmSynced(orgId: string, opts: { userId: string; demo?: boolean }): Promise<{ data: CrmData; awards: Award[] }> {
  const [data, awards] = await Promise.all([loadCrm(orgId), listAwardsForOrg(orgId)]);
  if (opts.demo || !data.ready) return { data, awards };
  const changed = await syncAwardsToCrm(orgId, awards, data, opts.userId).catch((e) => { console.error("crm sync", e); return false; });
  return { data: changed ? await loadCrm(orgId) : data, awards };
}

/**
 * 두 고객사를 하나로 (drop → keep). 담당자·기록·일정·할 일·견적서를 옮기고, 지우는 쪽 이름은 별칭으로 남긴다.
 */
export async function mergeCompanies(sb: Admin, orgId: string, keepId: string, dropId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (keepId === dropId) return { ok: false, error: "같은 고객사예요." };
  const { data: both } = await sb.from("cro_crm_companies").select("*").eq("org_id", orgId).in("id", [keepId, dropId]);
  const keep = both?.find((c) => c.id === keepId);
  const drop = both?.find((c) => c.id === dropId);
  if (!keep || !drop) return { ok: false, error: "합칠 고객사를 찾지 못했어요." };
  for (const t of ["cro_crm_contacts", "cro_crm_activities", "cro_crm_events", "cro_crm_tasks", "cro_quote_docs"] as const) {
    const { error } = await sb.from(t).update({ company_id: keepId }).eq("org_id", orgId).eq("company_id", dropId);
    if (error) { console.error("crm merge", t, error); return { ok: false, error: "합치는 중에 멈췄어요. 잠시 뒤 다시 시도해 주세요." }; }
  }
  const aliases = [...new Set([...keep.aliases, drop.name, ...drop.aliases].map((x) => x.trim()).filter((x) => x && normName(x) !== normName(keep.name)))].slice(0, 20);
  const fill = <K extends "industry" | "biz_no" | "address" | "website">(k: K) => keep[k] || drop[k];
  await sb.from("cro_crm_companies").update({
    aliases, industry: fill("industry"), biz_no: fill("biz_no"), address: fill("address"), website: fill("website"),
    memo: [keep.memo, drop.memo].filter(Boolean).join("\n\n"), first_deal: keep.first_deal && drop.first_deal, source: keep.source === "danchu" || drop.source === "danchu" ? "danchu" : keep.source,
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
  company_id?: string | null; contact_id?: string | null; quote_doc_id?: string | null; event_id?: string | null; activity_id?: string | null; task_id?: string | null;
  attendee_contacts?: string[]; attendee_members?: string[]; assignee?: string | null;
}): Promise<string | null> {
  const one = async (t: "cro_crm_companies" | "cro_crm_events" | "cro_crm_activities" | "cro_crm_tasks" | "cro_quote_docs", id: string | null | undefined) => {
    if (!id) return true;
    const { data } = await sb.from(t).select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
    return !!data;
  };
  if (!(await one("cro_crm_companies", r.company_id))) return "고객사를 찾지 못했어요.";
  if (!(await one("cro_quote_docs", r.quote_doc_id))) return "견적서를 찾지 못했어요.";
  if (!(await one("cro_crm_events", r.event_id))) return "일정을 찾지 못했어요.";
  if (!(await one("cro_crm_activities", r.activity_id))) return "기록을 찾지 못했어요.";
  if (!(await one("cro_crm_tasks", r.task_id))) return "할 일을 찾지 못했어요.";
  const cids = [...new Set([r.contact_id, ...(r.attendee_contacts ?? [])].filter((x): x is string => !!x))];
  if (cids.length) {
    const { data } = await sb.from("cro_crm_contacts").select("id, company_id").eq("org_id", orgId).in("id", cids);
    if ((data ?? []).length !== cids.length) return "담당자를 찾지 못했어요.";
    if (r.company_id && data?.some((c) => c.company_id !== r.company_id)) return "다른 고객사의 담당자가 섞여 있어요.";
  }
  const mids = [...new Set([r.assignee, ...(r.attendee_members ?? [])].filter((x): x is string => !!x))];
  if (mids.length) {
    const { data } = await sb.from("profiles").select("id").eq("cro_org_id", orgId).in("id", mids);
    if ((data ?? []).length !== mids.length) return "우리 기관 담당자가 아닌 사람이 있어요.";
  }
  return null;
}
