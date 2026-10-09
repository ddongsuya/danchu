import { getSupabaseAdmin } from "./supabase";
import type { Tables } from "./db-types";
import type { CroOrg } from "./auth";
import { likeExact, orValue } from "./sql";

/* ── 표 행 타입 — lib/db-types.ts 의 별칭. 컬럼이 바뀌면 그쪽을 고친다 ── */

export type RfqRow = Tables<"rfq_requests">;
export type InviteRow = Tables<"rfq_invites">;
export type QuoteItemRow = Tables<"cro_quote_items">;
export type QuoteRow = Tables<"cro_quotes"> & { cro_quote_items?: QuoteItemRow[] };
export type AwardRow = Tables<"rfq_awards">;
export type EventRow = Tables<"rfq_events">;
export type FileRow = Tables<"rfq_files">;
export type NotificationRow = Pick<Tables<"notifications">, "id" | "kind" | "title" | "body" | "href" | "read_at" | "created_at">;

function sb() {
  const c = getSupabaseAdmin();
  if (!c) throw new Error("SUPABASE 미설정");
  return c;
}
export function dbReady(): boolean {
  return !!getSupabaseAdmin();
}

/* ── 의뢰자 ── */

export type RfqSummary = RfqRow & { invites: number; submitted: number };

export async function listRequestsForUser(userId: string, email: string): Promise<RfqSummary[]> {
  const c = sb();
  const { data: rows } = await c
    .from("rfq_requests")
    .select("*")
    // 이메일은 대소문자만 무시하고 정확히 같아야 한다. `%`·`_` 를 이스케이프하지 않으면
    // a_c@corp.com 계정이 abc@corp.com 의 요청을 보게 된다.
    .or(`user_id.eq.${userId},email.ilike.${orValue(likeExact(email))}`)
    .order("created_at", { ascending: false })
    .limit(200);
  const list = rows ?? [];
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const { data: inv } = await c.from("rfq_invites").select("rfq_id, status").in("rfq_id", ids);
  const byRfq = new Map<string, { invites: number; submitted: number }>();
  for (const i of inv ?? []) {
    const e = byRfq.get(i.rfq_id) ?? { invites: 0, submitted: 0 };
    e.invites++;
    if (i.status === "submitted") e.submitted++;
    byRfq.set(i.rfq_id, e);
  }
  return list.map((r) => ({ ...r, ...(byRfq.get(r.id) ?? { invites: 0, submitted: 0 }) }));
}

export type RfqDetail = {
  rfq: RfqRow;
  invites: InviteRow[];
  quotes: QuoteRow[];
  events: EventRow[];
  files: FileRow[];
  award: AwardRow | null;
};

export async function getRfqByNo(no: string): Promise<RfqRow | null> {
  if (!/^DC-\d{4}-\d{4,}$/.test(no)) return null;
  const { data } = await sb().from("rfq_requests").select("*").eq("rfq_no", no).maybeSingle();
  return data ?? null;
}

export async function getRfqDetail(rfq: RfqRow): Promise<RfqDetail> {
  const c = sb();
  const [inv, q, ev, fl, aw] = await Promise.all([
    c.from("rfq_invites").select("*").eq("rfq_id", rfq.id).order("sent_at"),
    c.from("cro_quotes").select("*, cro_quote_items(*)").eq("rfq_id", rfq.id),
    c.from("rfq_events").select("*").eq("rfq_id", rfq.id).order("created_at"),
    c.from("rfq_files").select("*").eq("rfq_id", rfq.id).order("created_at"),
    c.from("rfq_awards").select("*").eq("rfq_id", rfq.id).maybeSingle(),
  ]);
  const quotes: QuoteRow[] = (q.data ?? []).map((x) => ({ ...x, cro_quote_items: [...(x.cro_quote_items ?? [])].sort((a, b) => a.seq - b.seq) }));
  return {
    rfq,
    invites: inv.data ?? [],
    quotes,
    events: ev.data ?? [],
    files: fl.data ?? [],
    award: aw.data ?? null,
  };
}

/** 의뢰자가 이 요청을 볼 수 있는가 */
export function ownsRfq(rfq: RfqRow, userId: string, email: string): boolean {
  return rfq.user_id === userId || rfq.email.toLowerCase() === email.toLowerCase();
}

/* ── 알림 ── */

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data } = await sb().from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}
export async function unreadCount(userId: string): Promise<number> {
  const { count } = await sb().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

/* ── CRO ── */

export type InviteWithQuote = InviteRow & { quote: QuoteRow | null; rfq: Pick<RfqRow, "substance" | "categories" | "purpose" | "confidentiality" | "org_type" | "company" | "status" | "payload" | "selected_quote_id"> | null };

export async function listInvitesForOrg(orgId: string): Promise<InviteWithQuote[]> {
  const c = sb();
  const { data: inv } = await c.from("rfq_invites").select("*").eq("cro_org_id", orgId).order("sent_at", { ascending: false }).limit(200);
  const invites = inv ?? [];
  if (!invites.length) return [];
  const ids = invites.map((i) => i.id);
  const rfqIds = [...new Set(invites.map((i) => i.rfq_id))];
  const [{ data: qs }, { data: rs }] = await Promise.all([
    c.from("cro_quotes").select("*").in("invite_id", ids),
    c.from("rfq_requests").select("id, substance, categories, purpose, confidentiality, org_type, company, status, payload, selected_quote_id").in("id", rfqIds),
  ]);
  const qBy = new Map((qs ?? []).map((q) => [q.invite_id, q]));
  const rBy = new Map((rs ?? []).map((r) => [r.id, r]));
  return invites.map((i) => ({ ...i, quote: qBy.get(i.id) ?? null, rfq: rBy.get(i.rfq_id) ?? null }));
}

export async function getInviteById(id: string): Promise<InviteRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await sb().from("rfq_invites").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function listAwardsForOrg(orgId: string): Promise<(AwardRow & { rfq: Pick<RfqRow, "rfq_no" | "substance" | "categories" | "company" | "contact_name" | "email" | "phone" | "status"> | null })[]> {
  const c = sb();
  const { data: aws } = await c.from("rfq_awards").select("*").eq("cro_org_id", orgId).order("awarded_at", { ascending: false });
  const list = aws ?? [];
  if (!list.length) return [];
  const { data: rs } = await c.from("rfq_requests").select("id, rfq_no, substance, categories, company, contact_name, email, phone, status").in("id", list.map((a) => a.rfq_id));
  const rBy = new Map((rs ?? []).map((r) => [r.id, r]));
  return list.map((a) => ({ ...a, rfq: rBy.get(a.rfq_id) ?? null }));
}

export type MemberRow = { id: string; name: string | null; email: string; phone: string | null; created_at: string; org_role?: string };

export async function listOrgMembers(orgId: string): Promise<MemberRow[]> {
  const { data } = await sb().from("profiles").select("id, name, email, phone, created_at, org_role").eq("cro_org_id", orgId).order("created_at");
  return data ?? [];
}

/** 운영 감사 로그 (최근순) */
export async function listAudit(limit = 200) {
  const { data } = await sb().from("admin_audit").select("*").order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}

/** 이 기관에 담당자로 합류를 신청했지만 아직 연결되지 않은 계정 */
export async function listPendingMembers(orgId: string): Promise<MemberRow[]> {
  const { data } = await sb().from("profiles").select("id, name, email, phone, created_at").eq("pending_org_id", orgId).is("cro_org_id", null).order("created_at");
  return data ?? [];
}

/* ── 운영자 ── */

export async function listAllRequests(status?: string): Promise<RfqSummary[]> {
  const c = sb();
  let q = c.from("rfq_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data: rows } = await q;
  const list = rows ?? [];
  if (!list.length) return [];
  const { data: inv } = await c.from("rfq_invites").select("rfq_id, status").in("rfq_id", list.map((r) => r.id));
  const byRfq = new Map<string, { invites: number; submitted: number }>();
  for (const i of inv ?? []) {
    const e = byRfq.get(i.rfq_id) ?? { invites: 0, submitted: 0 };
    e.invites++;
    if (i.status === "submitted") e.submitted++;
    byRfq.set(i.rfq_id, e);
  }
  return list.map((r) => ({ ...r, ...(byRfq.get(r.id) ?? { invites: 0, submitted: 0 }) }));
}

export async function listCroOrgs(status?: string): Promise<(CroOrg & { members: number })[]> {
  const c = sb();
  let q = c.from("cro_orgs").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const orgs = (data ?? []) as CroOrg[]; // status 문자열을 열거형으로 좁힌다
  if (!orgs.length) return [];
  const { data: ms } = await c.from("profiles").select("cro_org_id").in("cro_org_id", orgs.map((o) => o.id));
  const cnt = new Map<string, number>();
  for (const m of ms ?? []) if (m.cro_org_id) cnt.set(m.cro_org_id, (cnt.get(m.cro_org_id) ?? 0) + 1);
  return orgs.map((o) => ({ ...o, members: cnt.get(o.id) ?? 0 }));
}

export async function getCroOrg(id: string): Promise<CroOrg | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await sb().from("cro_orgs").select("*").eq("id", id).maybeSingle();
  return (data as CroOrg | null) ?? null;
}

export async function listAllAwards() {
  const c = sb();
  const { data: aws } = await c.from("rfq_awards").select("*").order("awarded_at", { ascending: false }).limit(300);
  const list = aws ?? [];
  if (!list.length) return [];
  const { data: rs } = await c.from("rfq_requests").select("id, rfq_no, substance, company, status").in("id", list.map((a) => a.rfq_id));
  const rBy = new Map((rs ?? []).map((r) => [r.id, r]));
  return list.map((a) => ({ ...a, rfq: rBy.get(a.rfq_id) ?? null }));
}

export async function listProfiles() {
  const { data } = await sb().from("profiles").select("id, email, role, name, company, cro_org_id, pending_org_id, created_at").order("created_at", { ascending: false }).limit(500);
  return data ?? [];
}

export async function countBy() {
  const c = sb();
  const [r, o, u] = await Promise.all([
    c.from("rfq_requests").select("status"),
    c.from("cro_orgs").select("status"),
    c.from("profiles").select("role"),
  ]);
  const tally = (rows: { [k: string]: string }[] | null, k: string) => {
    const m: Record<string, number> = {};
    for (const x of rows ?? []) m[x[k]] = (m[x[k]] ?? 0) + 1;
    return m;
  };
  return { rfq: tally(r.data, "status"), org: tally(o.data, "status"), user: tally(u.data, "role") };
}
