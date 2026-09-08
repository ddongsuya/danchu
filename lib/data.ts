import { getSupabaseAdmin } from "./supabase";
import type { Values } from "./rfq-schema";
import type { CroOrg } from "./auth";

/* ── 표 행 타입 (필요한 컬럼만) ── */

export type RfqRow = {
  id: string;
  rfq_no: string;
  created_at: string;
  status: string;
  submitted_step: number;
  company: string;
  contact_name: string;
  email: string;
  phone: string | null;
  org_type: string | null;
  purpose: string | null;
  substance: string;
  categories: string[];
  budget: string | null;
  cro_count: string | null;
  confidentiality: string | null;
  reply_by: string | null;
  payload: Values;
  user_id: string | null;
  distributed_at: string | null;
  compared_at: string | null;
  selected_quote_id: string | null;
  closed_at: string | null;
  admin_note: string | null;
};

export type InviteRow = {
  id: string;
  rfq_id: string;
  rfq_no: string;
  cro_name: string;
  cro_email: string;
  cro_org_id: string | null;
  token: string;
  reply_by: string;
  expires_at: string;
  status: string;
  sent_at: string;
  opened_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
};

export type QuoteItemRow = {
  id: string;
  quote_id: string;
  seq: number;
  category: string;
  name: string;
  cond: string | null;
  avail: string | null;
  amount: number | null;
  weeks: number | null;
  reason: string | null;
};

export type QuoteRow = {
  id: string;
  invite_id: string;
  rfq_id: string;
  rfq_no: string;
  cro_name: string;
  cro_org_id: string | null;
  total_amount: number | null;
  total_weeks: number | null;
  vat: string | null;
  pay_terms: string | null;
  start_date: string | null;
  valid_until: string | null;
  report_lang: string | null;
  substance_qty: string | null;
  includes: string[] | null;
  note: string | null;
  pdf_path: string | null;
  pdf_name: string | null;
  pdf_size: number | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  cro_quote_items?: QuoteItemRow[];
};

export type AwardRow = {
  id: string;
  rfq_id: string;
  quote_id: string;
  invite_id: string | null;
  cro_org_id: string | null;
  cro_name: string;
  awarded_at: string;
  contract_date: string | null;
  contract_amount: number | null;
  contract_reported_at: string | null;
  contract_note: string | null;
};

export type EventRow = { id: string; rfq_id: string; kind: string; title: string; body: string | null; created_at: string; meta: Record<string, unknown> };
export type FileRow = { id: string; rfq_id: string; storage_path: string; file_name: string; size_bytes: number; mime_type: string | null; created_at: string };
export type NotificationRow = { id: string; kind: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string };

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
    .or(`user_id.eq.${userId},email.ilike.${email.replace(/[,()]/g, "")}`)
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (rows ?? []) as RfqRow[];
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
  return (data as RfqRow | null) ?? null;
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
  const quotes = ((q.data ?? []) as QuoteRow[]).map((x) => ({ ...x, cro_quote_items: [...(x.cro_quote_items ?? [])].sort((a, b) => a.seq - b.seq) }));
  return {
    rfq,
    invites: (inv.data ?? []) as InviteRow[],
    quotes,
    events: (ev.data ?? []) as EventRow[],
    files: (fl.data ?? []) as FileRow[],
    award: (aw.data as AwardRow | null) ?? null,
  };
}

/** 의뢰자가 이 요청을 볼 수 있는가 */
export function ownsRfq(rfq: RfqRow, userId: string, email: string): boolean {
  return rfq.user_id === userId || rfq.email.toLowerCase() === email.toLowerCase();
}

/* ── 알림 ── */

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data } = await sb().from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as NotificationRow[];
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
  const invites = (inv ?? []) as InviteRow[];
  if (!invites.length) return [];
  const ids = invites.map((i) => i.id);
  const rfqIds = [...new Set(invites.map((i) => i.rfq_id))];
  const [{ data: qs }, { data: rs }] = await Promise.all([
    c.from("cro_quotes").select("*").in("invite_id", ids),
    c.from("rfq_requests").select("id, substance, categories, purpose, confidentiality, org_type, company, status, payload, selected_quote_id").in("id", rfqIds),
  ]);
  const qBy = new Map((qs ?? []).map((q) => [q.invite_id as string, q as QuoteRow]));
  const rBy = new Map((rs ?? []).map((r) => [r.id as string, r as RfqRow]));
  return invites.map((i) => ({ ...i, quote: qBy.get(i.id) ?? null, rfq: rBy.get(i.rfq_id) ?? null }));
}

export async function getInviteById(id: string): Promise<InviteRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await sb().from("rfq_invites").select("*").eq("id", id).maybeSingle();
  return (data as InviteRow | null) ?? null;
}

export async function listAwardsForOrg(orgId: string): Promise<(AwardRow & { rfq: Pick<RfqRow, "rfq_no" | "substance" | "categories" | "company" | "contact_name" | "email" | "phone" | "status"> | null })[]> {
  const c = sb();
  const { data: aws } = await c.from("rfq_awards").select("*").eq("cro_org_id", orgId).order("awarded_at", { ascending: false });
  const list = (aws ?? []) as AwardRow[];
  if (!list.length) return [];
  const { data: rs } = await c.from("rfq_requests").select("id, rfq_no, substance, categories, company, contact_name, email, phone, status").in("id", list.map((a) => a.rfq_id));
  const rBy = new Map((rs ?? []).map((r) => [r.id as string, r as RfqRow]));
  return list.map((a) => ({ ...a, rfq: rBy.get(a.rfq_id) ?? null }));
}

export async function listOrgMembers(orgId: string) {
  const { data } = await sb().from("profiles").select("id, name, email, phone, created_at").eq("cro_org_id", orgId).order("created_at");
  return (data ?? []) as { id: string; name: string | null; email: string; phone: string | null; created_at: string }[];
}

/* ── 운영자 ── */

export async function listAllRequests(status?: string): Promise<RfqSummary[]> {
  const c = sb();
  let q = c.from("rfq_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data: rows } = await q;
  const list = (rows ?? []) as RfqRow[];
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
  const orgs = (data ?? []) as CroOrg[];
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
  const list = (aws ?? []) as AwardRow[];
  if (!list.length) return [];
  const { data: rs } = await c.from("rfq_requests").select("id, rfq_no, substance, company, status").in("id", list.map((a) => a.rfq_id));
  const rBy = new Map((rs ?? []).map((r) => [r.id as string, r as Pick<RfqRow, "id" | "rfq_no" | "substance" | "company" | "status">]));
  return list.map((a) => ({ ...a, rfq: rBy.get(a.rfq_id) ?? null }));
}

export async function listProfiles() {
  const { data } = await sb().from("profiles").select("id, email, role, name, company, cro_org_id, created_at").order("created_at", { ascending: false }).limit(500);
  return (data ?? []) as { id: string; email: string; role: string; name: string | null; company: string | null; cro_org_id: string | null; created_at: string }[];
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
