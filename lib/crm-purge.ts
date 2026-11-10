import type { Admin } from "./supabase";

/** 담당자가 모두 떠난 뒤 CRM 자료를 지우기까지 두는 날 수. 개인정보처리방침·기관 이용 조건의 "30일"과 같다 */
export const CRM_PURGE_DAYS = 30;

/** 지우는 순서. 뒤의 표가 앞의 표를 가리키므로(안건 → 고객사 등) 가리키는 쪽부터 지운다. 담당자·단계 이력·할 일 기록은 따라 지워진다 */
const TABLES = ["cro_crm_tasks", "cro_crm_activities", "cro_crm_events", "cro_crm_deals", "cro_crm_companies", "cro_crm_imports"] as const;

type OrgRow = { id: string; members_left_at: string | null };

/** 지금 무엇을 해야 하는지 (순수 계산). mark: 떠난 시각 적기 · clear: 담당자가 돌아와 비우기 · purge: 30일이 지나 지우기 */
export function planCrmPurge(orgs: OrgRow[], orgIdsWithMembers: Set<string>, now: number): { mark: string[]; clear: string[]; purge: string[] } {
  const out = { mark: [] as string[], clear: [] as string[], purge: [] as string[] };
  for (const o of orgs) {
    const has = orgIdsWithMembers.has(o.id);
    if (has) { if (o.members_left_at) out.clear.push(o.id); continue; }
    if (!o.members_left_at) out.mark.push(o.id);
    else if (now - new Date(o.members_left_at).getTime() >= CRM_PURGE_DAYS * 864e5) out.purge.push(o.id);
  }
  return out;
}

/**
 * 담당자 계정이 하나도 남지 않은 기관의 CRM 자료를 30일 뒤 지운다. 매일 cron 에서 한 번. 멱등.
 * 운영자가 대신 관리하는 기관(managed)은 원래 담당자 계정이 없으므로 보지 않는다.
 * 지운 뒤에도 떠난 시각은 남긴다 (다음 날 다시 지워도 지울 것이 없다).
 */
export async function purgeLeftOrgCrm(sb: Admin, now = Date.now()): Promise<{ marked: number; cleared: number; purgedOrgs: number; rows: number }> {
  const out = { marked: 0, cleared: 0, purgedOrgs: 0, rows: 0 };
  const { data: orgs, error } = await sb.from("cro_orgs").select("id, members_left_at").eq("managed", false);
  if (error) throw new Error(`crm-purge orgs: ${error.message}`);
  const { data: members, error: mErr } = await sb.from("profiles").select("cro_org_id").not("cro_org_id", "is", null);
  if (mErr) throw new Error(`crm-purge members: ${mErr.message}`);
  const withMembers = new Set((members ?? []).map((m) => m.cro_org_id as string));
  const plan = planCrmPurge((orgs ?? []) as OrgRow[], withMembers, now);

  if (plan.mark.length) {
    const { error: e } = await sb.from("cro_orgs").update({ members_left_at: new Date(now).toISOString() }).in("id", plan.mark).is("members_left_at", null);
    if (e) throw new Error(`crm-purge mark: ${e.message}`);
    out.marked = plan.mark.length;
  }
  if (plan.clear.length) {
    const { error: e } = await sb.from("cro_orgs").update({ members_left_at: null }).in("id", plan.clear);
    if (e) throw new Error(`crm-purge clear: ${e.message}`);
    out.cleared = plan.clear.length;
  }
  for (const orgId of plan.purge) {
    // 지우기 직전에 한 번 더 본다: 그 사이 담당자가 들어왔으면 지우지 않는다
    const { count } = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("cro_org_id", orgId);
    if (count) continue;
    let rows = 0;
    for (const t of TABLES) {
      const { count: n, error: e } = await sb.from(t).delete({ count: "exact" }).eq("org_id", orgId);
      if (e) throw new Error(`crm-purge ${t}: ${e.message}`);
      rows += n ?? 0;
    }
    if (rows) { out.purgedOrgs++; out.rows += rows; }
  }
  return out;
}
