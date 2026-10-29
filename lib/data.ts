import { getSupabaseAdmin } from "./supabase";
import type { Tables } from "./db-types";
import type { CroOrg } from "./auth";
import { likeExact, orValue } from "./sql";
import { participation } from "./request-policy";
import { stuckReasons, type Stuck } from "./stuck";

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

export type RfqSummary = RfqRow & { joined: number; cap: number | null; submitted: number };

export async function listRequestsForUser(userId: string): Promise<RfqSummary[]> {
  const c = sb();
  const { data: rows } = await c
    .from("rfq_requests")
    .select("*")
    // 소유는 user_id 로만 본다. 연락 이메일은 바뀌거나 다른 계정이 다시 쓸 수 있다 (미귀속 요청 연결은 claim_rfqs_by_email, 0021)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const list = rows ?? [];
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const { data: inv } = await c.from("rfq_invites").select("rfq_id, status, joined_at, withdrawn_at, revoked_at").in("rfq_id", ids);
  return list.map((r) => ({ ...r, ...participation(r.cro_count, (inv ?? []).filter((i) => i.rfq_id === r.id)) }));
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

/** 의뢰자가 이 요청을 볼 수 있는가. user_id 로만 판단한다 (이메일 일치는 소유가 아니다) */
export function ownsRfq(rfq: Pick<RfqRow, "user_id">, userId: string): boolean {
  return !!rfq.user_id && rfq.user_id === userId;
}

/* ── 알림 ── */

export async function listNotifications(userId: string, limit = 50, opts?: { kind?: string; page?: number }): Promise<{ list: NotificationRow[]; hasMore: boolean }> {
  const page = Math.max(1, opts?.page ?? 1);
  const from = (page - 1) * limit;
  let q = sb().from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).range(from, from + limit);
  if (opts?.kind) q = q.eq("kind", opts.kind);
  const { data } = await q;
  const rows = data ?? [];
  return { list: rows.slice(0, limit), hasMore: rows.length > limit };
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

export const ADMIN_PAGE = 50;

/** 운영자 요청 목록. 검색은 번호·회사·물질·이메일 부분 일치, 한 페이지 +1 로 다음 페이지 유무를 안다 */
export async function listAllRequests(status?: string, q?: string, page = 1): Promise<{ list: RfqSummary[]; hasMore: boolean }> {
  const c = sb();
  const from = (Math.max(1, page) - 1) * ADMIN_PAGE;
  let query = c.from("rfq_requests").select("*").order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE);
  // "overdue": 회신 기한이 지났는데 아직 비교표가 열리지 않은 요청 (운영자가 기한 연장·마무리를 정해야 한다)
  if (status === "overdue") query = query.in("status", OVERDUE_STATUSES).lt("reply_by", todaySeoulDate());
  else if (status) query = query.eq("status", status);
  if (q) {
    const term = `%${likeExact(q.trim().slice(0, 60))}%`;
    query = query.or(`rfq_no.ilike.${orValue(term)},company.ilike.${orValue(term)},substance.ilike.${orValue(term)},email.ilike.${orValue(term)}`);
  }
  const { data: rows } = await query;
  const hasMore = (rows ?? []).length > ADMIN_PAGE;
  const list = (rows ?? []).slice(0, ADMIN_PAGE);
  if (!list.length) return { list: [], hasMore: false };
  const { data: inv } = await c.from("rfq_invites").select("rfq_id, status, joined_at, withdrawn_at, revoked_at").in("rfq_id", list.map((r) => r.id));
  return { list: list.map((r) => ({ ...r, ...participation(r.cro_count, (inv ?? []).filter((i) => i.rfq_id === r.id)) })), hasMore };
}

export async function listCroOrgs(status?: string, search?: string): Promise<(CroOrg & { members: number })[]> {
  const c = sb();
  let q = c.from("cro_orgs").select("*").order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  if (search) {
    const term = `%${likeExact(search.trim().slice(0, 60))}%`;
    q = q.or(`name.ilike.${orValue(term)},contact_email.ilike.${orValue(term)},business_no.ilike.${orValue(term)}`);
  }
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

export async function listProfiles(search?: string, page = 1): Promise<{ list: { id: string; email: string; role: string; name: string | null; company: string | null; cro_org_id: string | null; pending_org_id: string | null; created_at: string }[]; hasMore: boolean }> {
  const from = (Math.max(1, page) - 1) * ADMIN_PAGE;
  let q = sb().from("profiles").select("id, email, role, name, company, cro_org_id, pending_org_id, created_at").order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE);
  if (search) {
    const term = `%${likeExact(search.trim().slice(0, 60))}%`;
    q = q.or(`email.ilike.${orValue(term)},name.ilike.${orValue(term)},company.ilike.${orValue(term)}`);
  }
  const { data } = await q;
  const rows = data ?? [];
  return { list: rows.slice(0, ADMIN_PAGE), hasMore: rows.length > ADMIN_PAGE };
}

/** 월 마감 여부 (billing_periods) */
export async function isBillingClosed(monthFirstDay: string): Promise<boolean> {
  const { data } = await sb().from("billing_periods").select("month").eq("month", monthFirstDay).maybeSingle();
  return !!data;
}

/** 회신 기한이 지나도 비교표가 열리지 않으면 운영자가 정리해야 하는 상태 */
const OVERDUE_STATUSES = ["received", "distributed", "quoted"];
const todaySeoulDate = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/** 운영자 홈 "멈춘 요청": 열린 요청마다 lib/stuck.ts 이유를 붙여, 오래 멈춘 순으로 */
export async function listStuckRequests(): Promise<(Pick<RfqRow, "rfq_no" | "company" | "substance"> & { reasons: Stuck[] })[]> {
  const c = sb();
  const { data: rows } = await c
    .from("rfq_requests")
    .select("id, rfq_no, company, substance, status, reply_by, compared_at, cro_count, distributed_at")
    .in("status", ["received", "distributed", "quoted", "selected", "contracting"])
    .limit(200);
  const list = rows ?? [];
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const [{ data: inv }, { data: aw }] = await Promise.all([
    c.from("rfq_invites").select("rfq_id, status, joined_at, withdrawn_at, revoked_at, mailed_at").in("rfq_id", ids),
    c.from("rfq_awards").select("rfq_id, awarded_at, contract_reported_at, cro_name").in("rfq_id", ids),
  ]);
  const today = todaySeoulDate();
  return list
    .map((r) => ({
      rfq_no: r.rfq_no,
      company: r.company,
      substance: r.substance,
      reasons: stuckReasons(r, (inv ?? []).filter((i) => i.rfq_id === r.id), (aw ?? []).find((a) => a.rfq_id === r.id) ?? null, today),
    }))
    .filter((r) => r.reasons.length)
    .sort((a, b) => Math.max(...b.reasons.map((x) => x.days)) - Math.max(...a.reasons.map((x) => x.days)));
}

export async function countBy() {
  const c = sb();
  const [r, o, u] = await Promise.all([
    c.from("rfq_requests").select("status, reply_by"),
    c.from("cro_orgs").select("status"),
    c.from("profiles").select("role"),
  ]);
  const tally = (rows: { [k: string]: string }[] | null, k: string) => {
    const m: Record<string, number> = {};
    for (const x of rows ?? []) m[x[k]] = (m[x[k]] ?? 0) + 1;
    return m;
  };
  const today = todaySeoulDate();
  const overdue = (r.data ?? []).filter((x) => OVERDUE_STATUSES.includes(x.status) && !!x.reply_by && String(x.reply_by).slice(0, 10) < today).length;
  return { rfq: tally(r.data as { [k: string]: string }[] | null, "status"), org: tally(o.data, "status"), user: tally(u.data, "role"), overdue };
}
