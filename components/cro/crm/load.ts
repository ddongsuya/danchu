/**
 * CRM 화면 공통 읽기 (서버). 승인 전 기관은 null, 저장소가 없으면 빈 묶음(ready=false).
 */
import type { Session } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { crmMailDomain, loadCrmSynced, type CrmBundle, type CrmData } from "@/lib/crm";
import { CRM_PATHS } from "./opts";
import type { CrmCtx } from "./ctx";

const EMPTY: CrmData = { ready: false, companies: [], contacts: [], deals: [], history: [], events: [], activities: [], tasks: [], quotes: [], members: [], mailKey: null };

export async function loadCtx(s: Session): Promise<{ c: CrmCtx; bundle: CrmBundle } | null> {
  const org = s.org;
  if (!org || org.status !== "approved") return null;
  const bundle: CrmBundle = dbReady() ? await loadCrmSynced(org.id, { userId: s.userId, demo: s.demo }) : { data: EMPTY, invites: [], awards: [], danchu: new Map() };
  return { c: { data: bundle.data, danchu: bundle.danchu, me: s.userId, paths: CRM_PATHS, now: Date.now(), mailDomain: bundle.data.mailKey ? crmMailDomain() : null }, bundle };
}
