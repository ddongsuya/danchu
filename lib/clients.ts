/**
 * 기관 고객 (2026-11-07, 0038). 고객 = 이 기관을 선정한 의뢰자. 선정 전 의뢰자는 여기에 나오지 않는다.
 * 기록은 단추에서 일어난 일(선정·계약 보고·견적서)과 기관 메모를 날짜순으로 합친다.
 * 메모는 그 기관만 본다. 단추는 메모를 요청 전달 순서·비교표·노출에 쓰지 않는다.
 */
import { getSupabaseAdmin } from "./supabase";
import { listAwardsForOrg } from "./data";
import { clientKeyOf, gapPct } from "./pipeline";

type Award = Awaited<ReturnType<typeof listAwardsForOrg>>[number];

export type ClientNote = { id: string; body: string; remind_on: string | null; reminded_at: string | null; created_at: string; author: string | null };
export type ClientDoc = { id: string; doc_no: string; title: string; status: string; supply: number; updated_at: string; rfq_no: string | null };
export type ClientWin = { awardId: string; inviteId: string | null; no: string; substance: string; reported: boolean; quoteAmount: number | null; contractAmount: number | null; awardedAt: string };
export type Client = {
  key: string;
  name: string;
  orgType: string;
  contact: { name: string; email: string; phone: string };
  firstAwardAt: string;
  wins: ClientWin[];
  /** 계약 결과 보고가 남은 수주 수 */
  pending: number;
};
export type FeedEvent = { at: string; kind: "note" | "award" | "contract" | "doc"; title: string; sub: string; note?: ClientNote };

export function groupClients(awards: Award[]): Client[] {
  const by = new Map<string, Client>();
  for (const a of awards) {
    const key = clientKeyOf(a.rfq);
    if (!key || !a.rfq) continue;
    const c = by.get(key) ?? {
      key,
      name: a.rfq.company || "이름 없는 의뢰자",
      orgType: a.rfq.org_type ?? "",
      contact: { name: a.rfq.contact_name ?? "", email: a.rfq.email ?? "", phone: a.rfq.phone ?? "" },
      firstAwardAt: a.awarded_at,
      wins: [],
      pending: 0,
    };
    c.wins.push({ awardId: a.id, inviteId: a.invite_id, no: a.rfq.rfq_no, substance: a.rfq.substance ?? "", reported: !!a.contract_reported_at, quoteAmount: a.quoteAmount, contractAmount: a.contract_amount, awardedAt: a.awarded_at });
    if (!a.contract_reported_at) c.pending += 1;
    if (a.awarded_at < c.firstAwardAt) c.firstAwardAt = a.awarded_at;
    by.set(key, c);
  }
  return [...by.values()].sort((x, y) => (y.pending - x.pending) || y.wins[0].awardedAt.localeCompare(x.wins[0].awardedAt));
}

export async function loadClientExtras(orgId: string, client: Client): Promise<{ notes: ClientNote[]; docs: ClientDoc[]; notesReady: boolean }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { notes: [], docs: [], notesReady: false };
  const inviteIds = client.wins.map((w) => w.inviteId).filter((x): x is string => !!x);
  const nos = client.wins.map((w) => w.no);
  const [n, d] = await Promise.all([
    sb.from("cro_client_notes").select("id, body, remind_on, reminded_at, created_at, created_by").eq("org_id", orgId).eq("client_key", client.key).order("created_at", { ascending: false }).limit(200),
    sb.from("cro_quote_docs").select("id, doc_no, title, status, supply, updated_at, rfq_no, invite_id").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(300),
  ]);
  // 0038 이 아직 적용되지 않았으면 메모 없이 보여 준다
  const notesReady = !n.error;
  const rows = n.data ?? [];
  const ids = [...new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await sb.from("profiles").select("id, name, email").in("id", ids);
    for (const p of ps ?? []) names.set(p.id, p.name || p.email.split("@")[0]);
  }
  return {
    notesReady,
    notes: rows.map((r) => ({ id: r.id, body: r.body, remind_on: r.remind_on, reminded_at: r.reminded_at, created_at: r.created_at, author: r.created_by ? names.get(r.created_by) ?? null : null })),
    docs: (d.data ?? []).filter((x) => (x.invite_id && inviteIds.includes(x.invite_id)) || (x.rfq_no && nos.includes(x.rfq_no))).map((x) => ({ id: x.id, doc_no: x.doc_no, title: x.title, status: x.status, supply: x.supply, updated_at: x.updated_at, rfq_no: x.rfq_no })),
  };
}

export function buildFeed(client: Client, awards: Award[], notes: ClientNote[], docs: ClientDoc[]): FeedEvent[] {
  const mine = awards.filter((a) => clientKeyOf(a.rfq) === client.key);
  const ev: FeedEvent[] = [];
  for (const n of notes) ev.push({ at: n.created_at, kind: "note", title: n.body, sub: "", note: n });
  for (const a of mine) {
    ev.push({ at: a.awarded_at, kind: "award", title: "이 기관을 선정", sub: `${a.rfq?.rfq_no ?? ""} · ${a.quoteAmount != null ? `${a.quoteAmount.toLocaleString("ko-KR")}원` : ""} · 회사와 연락처가 공개됐어요` });
    if (a.contract_reported_at) {
      const pct = gapPct(a.quoteAmount, a.contract_amount);
      ev.push({ at: a.contract_reported_at, kind: "contract", title: "계약 결과 보고", sub: `${a.rfq?.rfq_no ?? ""} · ${(a.contract_amount ?? 0).toLocaleString("ko-KR")}원${pct ? ` · 선정 금액과 ${pct > 0 ? "+" : ""}${pct}%` : ""}` });
    }
  }
  for (const d of docs) ev.push({ at: d.updated_at, kind: "doc", title: `견적서 ${d.doc_no} ${d.status === "sent" ? "보냄" : "작성"}`, sub: `${d.title || d.rfq_no || ""}${d.supply ? ` · 공급가액 ${d.supply.toLocaleString("ko-KR")}원` : ""}` });
  return ev.sort((a, b) => b.at.localeCompare(a.at));
}
