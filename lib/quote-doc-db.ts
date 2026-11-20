/**
 * 견적서 생성 툴 저장 계층 (0036). 모든 쿼리는 service role 로, 기관 id 는 호출부가 세션에서 넘긴다.
 */
import { getSupabaseAdmin } from "./supabase";
import { loadCatalog } from "./catalog-db";
import { pickVariant, prefillRow, rowKey, PRICE_CHECK_ROUTE, PRICE_CHECK_SPECIES, type CatalogRow } from "./catalog";
import { todaySeoul } from "./format";
import {
  blankTest, addDays, cleanDocData, cleanRates, DEFAULT_VISIBLE, docTitle, docTotals, EMPTY_SUPPLIER, EMPTY_TERMS, docMatchesQuote, nextDocNo, priceOf, searchDocs, testFromCatalog, testKind, toxFromRequest,
  type DocData, type DocHit, type RequestPrice, type DocTest, type DocHead, type QuoteStyle, isLayout, type Rate, type Supplier,
} from "./quote-doc";
import type { QuoteLineDef } from "./quote-items";
import { cleanKd, COST_KEYS, newPdGroup, parseCount, parseGroups, parseTimes, PK_MATRIX, PK_TYPES, type Kind, type Orig } from "./kind-design";
import type { Values } from "./rfq-schema";
import { loadPriceBook } from "./price-book-db";
import { snapFor } from "./pd-quote";
import { featureError } from "./plan-usage";
import { rfqViewOf } from "./quote-load";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── 단가 ── */

/** 기관의 시험별 추가 비용 단가 (항목 키 → 단가 목록) */
export async function loadRates(orgId: string): Promise<Map<string, Rate[]>> {
  const sb = getSupabaseAdmin();
  const m = new Map<string, Rate[]>();
  if (!sb) return m;
  const { data } = await sb.from("cro_quote_rates").select("item_key, rates").eq("org_id", orgId);
  for (const r of data ?? []) m.set(r.item_key, cleanRates(r.rates));
  return m;
}

/**
 * 견적서 단가 저장: 조건별 표준가 + 시험의 추가 비용 단가. 남의 조합 id 는 무시한다.
 * prices = [{ id: 카탈로그 조합 id, std_price }]
 */
export async function saveRates(orgId: string, itemKey: string, prices: unknown, rates: unknown): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "저장소 미설정" };
  const { data: mine } = await sb.from("cro_catalog").select("id").eq("org_id", orgId).eq("item_key", itemKey);
  const own = new Set((mine ?? []).map((x) => x.id));
  if (!own.size) return { ok: false, error: "카탈로그에 없는 시험이에요." };
  for (const p of Array.isArray(prices) ? prices.slice(0, 50) : []) {
    if (!p || typeof p !== "object") continue;
    const id = String((p as { id?: unknown }).id ?? "");
    if (!own.has(id)) continue;
    const raw = (p as { std_price?: unknown }).std_price;
    let v = typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 99_999_999_999 ? Math.round(raw) : null;
    // 갈래별 설계(효력 비용 다섯 칸·검체당 단가)를 함께 보내면 extra.kd 에 넣고, 표준가 한 칸도 그 값으로
    const kd = cleanKd((p as { kd?: unknown }).kd);
    const patch: Record<string, unknown> = {};
    if (kd) {
      const { data: cur } = await sb.from("cro_catalog").select("extra").eq("id", id).eq("org_id", orgId).maybeSingle();
      const extra = cur?.extra && typeof cur.extra === "object" ? (cur.extra as Record<string, unknown>) : {};
      patch.extra = { ...extra, kd };
      const sum = kd.pd && COST_KEYS.some((k) => kd.pd!.costs[k] != null) ? COST_KEYS.reduce((a, k) => a + (kd.pd!.costs[k] ?? 0), 0) : null;
      const per = kd.pk?.perSample ?? kd.other?.perSample ?? null;
      if (sum != null) v = sum;
      else if (per != null) { v = per; patch.unit = "per_sample"; }
    }
    const { error } = await sb.from("cro_catalog").update({ ...patch, std_price: v, price_min: v, price_max: null }).eq("id", id).eq("org_id", orgId);
    if (error) return { ok: false, error: "표준가를 저장하지 못했어요." };
  }
  // 표준가만 보낸 경우(견적서 질문 화면의 "시험 목록에도 저장")는 단가를 건드리지 않는다
  if (rates === undefined) return { ok: true };
  const { error } = await sb.from("cro_quote_rates").upsert({ org_id: orgId, item_key: itemKey, rates: cleanRates(rates), updated_at: new Date().toISOString() }, { onConflict: "org_id,item_key" });
  if (error) return { ok: false, error: "추가 비용 단가를 저장하지 못했어요." };
  return { ok: true };
}

/* ── 양식 ── */

const sstr = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function loadStyle(orgId: string, orgName = ""): Promise<QuoteStyle> {
  const sb = getSupabaseAdmin();
  const base: QuoteStyle = { brandColor: null, logo: null, logoPos: "left", supplier: { ...EMPTY_SUPPLIER, name: orgName }, terms: { ...EMPTY_TERMS } };
  if (!sb) return base;
  const { data } = await sb.from("cro_quote_style").select("*").eq("org_id", orgId).maybeSingle();
  if (!data) return base;
  const s = (data.supplier ?? {}) as Record<string, unknown>;
  const t = (data.terms ?? {}) as Record<string, unknown>;
  return {
    brandColor: data.brand_color,
    logo: data.logo_data,
    logoPos: data.logo_pos === "right" ? "right" : "left",
    supplier: { name: sstr(s.name, 120) || orgName, address: sstr(s.address, 200), contact: sstr(s.contact, 80), person: sstr(s.person, 60), email: sstr(s.email, 120), reg: sstr(s.reg, 20), ceo: sstr(s.ceo, 60) },
    terms: { pay: sstr(t.pay, 300), extra: sstr(t.extra, 300), note: sstr(t.note, 600) },
    layout: isLayout(data.layout) ? data.layout : "basic",
  };
}

const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export async function saveStyle(orgId: string, raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "저장소 미설정" };
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const color = typeof o.brandColor === "string" && /^#[0-9a-f]{6}$/i.test(o.brandColor) ? o.brandColor.toLowerCase() : null;
  let logo: string | null = null;
  if (typeof o.logo === "string" && o.logo) {
    if (o.logo.length > 400_000 || !LOGO.test(o.logo)) return { ok: false, error: "로고는 PNG·JPG·WEBP 300KB 이하만 올릴 수 있어요." };
    logo = o.logo;
  }
  const s = (o.supplier && typeof o.supplier === "object" ? o.supplier : {}) as Record<string, unknown>;
  const t = (o.terms && typeof o.terms === "object" ? o.terms : {}) as Record<string, unknown>;
  const supplier: Supplier = { name: sstr(s.name, 120), address: sstr(s.address, 200), contact: sstr(s.contact, 80), person: sstr(s.person, 60), email: sstr(s.email, 120), reg: sstr(s.reg, 20), ceo: sstr(s.ceo, 60) };
  const { error } = await sb.from("cro_quote_style").upsert({
    org_id: orgId, brand_color: color, logo_data: logo, logo_pos: o.logoPos === "right" ? "right" : "left",
    supplier, terms: { pay: sstr(t.pay, 300), extra: sstr(t.extra, 300), note: sstr(t.note, 600) },
    layout: isLayout(o.layout) ? o.layout : "basic",
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id" });
  if (error) {
    console.error("cro_quote_style", error);
    return { ok: false, error: "양식을 저장하지 못했어요." };
  }
  return { ok: true };
}

/* ── 견적서 ── */

type DocRow = { id: string; org_id: string; doc_no: string; title: string; client: string; substance: string; issued_on: string; valid_until: string | null; invite_id: string | null; rfq_no: string | null; data: Record<string, unknown>; supply: number; memo: string; updated_at: string };

export const headOf = (r: DocRow): DocHead => ({
  id: r.id, docNo: r.doc_no, title: r.title, client: r.client, substance: r.substance, issuedOn: r.issued_on,
  validUntil: r.valid_until, inviteId: r.invite_id, rfqNo: r.rfq_no, memo: r.memo, updatedAt: r.updated_at,
});

export type DocListRow = { id: string; docNo: string; title: string; client: string; rfqNo: string | null; supply: number; tests: number; updatedAt: string };

export async function listDocs(orgId: string): Promise<DocListRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("cro_quote_docs").select("id, doc_no, title, client, rfq_no, supply, data, updated_at").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(200);
  return (data ?? []).map((r) => ({
    id: r.id, docNo: r.doc_no, title: r.title, client: r.client, rfqNo: r.rfq_no, supply: r.supply, updatedAt: r.updated_at,
    tests: Array.isArray((r.data as { tests?: unknown })?.tests) ? ((r.data as { tests: unknown[] }).tests.length) : 0,
  }));
}

export async function loadDoc(orgId: string, id: string): Promise<{ head: DocHead; data: DocData } | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(id)) return null;
  const { data } = await sb.from("cro_quote_docs").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!data) return null;
  return { head: headOf(data as DocRow), data: cleanDocData(data.data) };
}

/** 새 견적서 번호를 잡아 만든다. 같은 번호가 동시에 잡히면 다음 번호로 다시 */
async function insertDoc(orgId: string, userId: string | null, fields: { client: string; substance: string; inviteId?: string | null; rfqNo?: string | null; data: DocData }): Promise<{ id?: string; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "저장소 미설정" };
  const today = todaySeoul();
  const prefix = `Q-${today.slice(2, 4)}${today.slice(5, 7)}-`;
  const { data: nos } = await sb.from("cro_quote_docs").select("doc_no").eq("org_id", orgId).like("doc_no", `${prefix}%`);
  const existing = (nos ?? []).map((x) => x.doc_no);
  const t = docTotals(fields.data);
  for (let attempt = 0; attempt < 5; attempt++) {
    const docNo = nextDocNo(today, existing);
    const { data, error } = await sb.from("cro_quote_docs").insert({
      org_id: orgId, doc_no: docNo, title: docTitle(fields.data), client: fields.client.slice(0, 200), substance: fields.substance.slice(0, 200),
      issued_on: today, valid_until: addDays(today, 30), invite_id: fields.inviteId ?? null, rfq_no: fields.rfqNo ?? null,
      data: fields.data as unknown as Record<string, unknown>, supply: t.supply, created_by: userId,
    }).select("id").single();
    if (!error && data) return { id: data.id };
    if (error?.code === "23505") { existing.push(docNo); continue; }
    console.error("cro_quote_docs insert", error);
    return { error: "견적서를 만들지 못했어요." };
  }
  return { error: "견적번호를 잡지 못했어요. 잠시 뒤 다시 시도해 주세요." };
}

/**
 * 효력 단가표 방식 (0047): 모델 표준에 사용량 규칙이 있는 시험에 만들 때의 단가·관리비 % 사본을 붙인다.
 * 단가표를 못 읽으면 붙이지 않는다 (예전 다섯 칸 방식으로 보인다)
 */
async function attachPrices(orgId: string, data: DocData): Promise<void> {
  if (!data.tests.some((t) => t.std.kd?.pd?.uses?.length)) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const book = await loadPriceBook(sb, orgId).catch(() => null);
  if (!book) return;
  data.tests = data.tests.map((t) => (t.std.kd?.pd?.uses?.length ? { ...t, prices: snapFor(book, t.std.kd.pd, t.kd?.pd) } : t));
}

function emptyData(style: QuoteStyle): DocData {
  return { tests: [], visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: { ...style.terms }, glp: "" };
}

/** 카탈로그 조합으로 새 견적서 */
export async function createDocFromCatalog(orgId: string, orgName: string, userId: string | null, catalogIds: string[], client: string, substance: string, manual: string[] = [], kind: Kind = "tox"): Promise<{ id?: string; error?: string }> {
  const [rows, rates, style] = await Promise.all([loadCatalog(orgId), loadRates(orgId), loadStyle(orgId, orgName)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const data = emptyData(style);
  for (const id of catalogIds.slice(0, 30)) {
    const c = byId.get(id);
    if (c) data.tests.push(testFromCatalog(c, rates.get(c.item_key) ?? []));
  }
  for (const name of manual) data.tests.push(blankTest(name, kind));
  await attachPrices(orgId, data);
  return insertDoc(orgId, userId, { client, substance, data });
}

export type RequestInput = { inviteId: string; rfqNo: string; substance: string; rows: QuoteLineDef[]; payload: Values };

/** 단추 요청으로 새 견적서: 요청의 시험 행마다 가장 가까운 카탈로그 조합을 고른다 (회신 초안과 같은 규칙). 이미 있으면 그것을 연다 */
export async function createDocFromRequest(orgId: string, orgName: string, userId: string | null, a: RequestInput): Promise<{ id?: string; created?: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "저장소 미설정" };
  // 같은 요청으로 만든 견적서가 있으면 그것을 연다 (두 번 눌러 두 부가 생기지 않게)
  const had = await docForInvite(orgId, a.inviteId);
  if (had) return { id: had.id, created: false };
  const { data } = await requestData(orgId, orgName, a);
  const r = await insertDoc(orgId, userId, { client: `단추 요청 ${a.rfqNo}`, substance: a.substance, inviteId: a.inviteId, rfqNo: a.rfqNo, data });
  return r.id ? { id: r.id, created: true } : r;
}

/** 이 초대로 만든 견적서 (가장 먼저 만든 것) */
export async function docForInvite(orgId: string, inviteId: string): Promise<{ id: string; docNo: string } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("cro_quote_docs").select("id, doc_no").eq("org_id", orgId).eq("invite_id", inviteId).order("created_at").limit(1);
  return data?.[0] ? { id: data[0].id, docNo: data[0].doc_no } : null;
}

/**
 * 요청 행마다 카탈로그 조합을 골라 견적서 시험을 만든다 (저장하지 않는다). 맞는 조합이 없거나 수행하지 않는 행은 빠진다.
 * checks: 회신 초안과 같은 규칙으로 본, 요청 조건이 기관 표준과 다른 칸 (행 번호별)
 */
async function requestData(orgId: string, orgName: string, a: RequestInput): Promise<{ data: DocData; checks: Map<number, string[]> }> {
  const [rows, rates, style] = await Promise.all([loadCatalog(orgId), loadRates(orgId), loadStyle(orgId, orgName)]);
  const byKey = new Map<string, CatalogRow[]>();
  for (const r of rows) byKey.set(r.item_key, [...(byKey.get(r.item_key) ?? []), r]);
  const data = emptyData(style);
  const checks = new Map<number, string[]>();
  for (const line of a.rows) {
    const picked = pickVariant(byKey.get(rowKey(line)) ?? [], line, a.payload);
    if (!picked || !picked.row.available) continue;
    const ck = prefillRow(line, picked, a.payload).checks;
    // 대표가 아닌 동물종·경로로 맞으면 표준가를 그대로 쓰지 않는다 (기관이 금액을 적는다)
    const other = picked.mismatch.includes(PRICE_CHECK_SPECIES) || picked.mismatch.includes(PRICE_CHECK_ROUTE);
    const base = other ? { ...picked.row, std_price: null } : picked.row;
    const full = (byKey.get(rowKey(line)) ?? []).find((r) => r.id === picked.row.id) ?? picked.row;
    const t0 = { ...testFromCatalog(base, rates.get(picked.row.item_key) ?? [], full), rfqSeq: line.seq };
    if (testKind(t0) === "tox") {
      // 독성: 요청 조건(회복군·TK 등)을 계산기로 옮긴다. 변경 단가로 금액이 나온 조건은 확인 칸에서 뺀다
      const r = toxFromRequest(t0, (id) => reqGet(a.payload, t0.category, id), base.recovery_per_sex ?? null);
      data.tests.push(r.orig ? { ...r.test, orig: r.orig } : r.test);
      checks.set(line.seq, ck.filter((c) => !r.applied.includes(c)));
    } else {
      data.tests.push(withRequest(t0, a.payload));
      checks.set(line.seq, ck);
    }
  }
  await attachPrices(orgId, data);
  return { data, checks };
}

/**
 * 견적 금액 다시 계산 (에이전트 quote_price, 2026-11-20 B안).
 * 이 요청으로 만든 견적서가 있으면 그 견적서(기관이 고친 값), 없으면 시험 목록·단가표로 같은 규칙을 저장 없이 계산한다.
 * 금액은 견적서 툴 계산(testLines)만 쓴다. 표준가가 없거나 단가표에 없는 항목이 있으면 금액을 내지 않는다(priced=false)
 */
export async function priceRequest(orgId: string, orgName: string, a: RequestInput): Promise<RequestPrice> {
  const doc = await docForInvite(orgId, a.inviteId);
  const got = doc ? await loadDoc(orgId, doc.id) : null;
  if (got && doc) return { ...priceOf(got.data, a.rows), source: "doc", doc: { id: doc.id, docNo: doc.docNo } };
  // 기관이 아직 견적서를 만들지 않았으면 요청 조건이 표준과 다른 독성 행은 금액을 내지 않는다 (견적서에서 설계를 맞춘 뒤 계산)
  const fresh = await requestData(orgId, orgName, a);
  return { ...priceOf(fresh.data, a.rows, fresh.checks), source: "catalog", doc: null };
}

/**
 * 의뢰자에게 보일 기관 견적서 (비교표가 열린 뒤, 부르는 쪽이 확인한다).
 * 이 초대로 만든 견적서가 제출한 견적과 금액까지 같을 때만 돌려준다(docMatchesQuote). 양식 고르기(branding)가 없는 요금제면 기본 판
 */
export async function submittedDoc(q: { cro_org_id: string | null; invite_id: string | null; cro_quote_items?: { seq: number; avail: string | null; amount: number | null }[] | null }): Promise<{ head: DocHead; data: DocData; style: QuoteStyle } | null> {
  const sb = getSupabaseAdmin();
  if (!sb || !q.cro_org_id || !q.invite_id) return null;
  const doc = await docForInvite(q.cro_org_id, q.invite_id);
  const got = doc ? await loadDoc(q.cro_org_id, doc.id) : null;
  if (!got || !docMatchesQuote(got.data, q.cro_quote_items ?? [])) return null;
  const { data: org } = await sb.from("cro_orgs").select("*").eq("id", q.cro_org_id).maybeSingle();
  if (!org) return null;
  const style = await loadStyle(q.cro_org_id, org.name ?? "");
  const lock = !!featureError(org as Parameters<typeof featureError>[0], "branding");
  return { head: { ...got.head, memo: "" }, data: lock ? { ...got.data, layout: null } : got.data, style: lock ? { ...style, layout: "basic" } : style };
}

/** 우리 기관 견적서 찾기 (에이전트 quote_history). 최근 300부 안에서 찾는다 */
export async function findDocs(orgId: string, q: string, limit = 10): Promise<DocHit[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("cro_quote_docs").select("id, doc_no, title, client, substance, rfq_no, issued_on, supply, data").eq("org_id", orgId).order("issued_on", { ascending: false }).limit(300);
  return searchDocs(data ?? [], q, limit);
}

/** 기관 초대 → 견적서 툴 입력 (참여한 초대만). 요청서 화면과 같은 행·조건을 쓴다 */
export async function requestInputFor(orgId: string, inviteId: string): Promise<RequestInput | "not_joined" | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: inv } = await sb.from("rfq_invites").select("*").eq("id", inviteId).eq("cro_org_id", orgId).maybeSingle();
  if (!inv) return null;
  if (!inv.joined_at) return "not_joined";
  const { data: r } = await sb.from("rfq_requests").select("*").eq("id", inv.rfq_id).maybeSingle();
  if (!r) return null;
  const view = rfqViewOf(r, inv, [], false);
  return { inviteId: inv.id, rfqNo: inv.rfq_no, substance: view.substance, rows: view.rows, payload: r.payload as Values };
}

/**
 * 의뢰자 원안을 견적서 시험에 붙인다 (효력·약동학·개별 분석).
 * 설계는 기관 표준(시험 목록)에서 시작하고, 요청에 적힌 군 수·마릿수·채혈 시점·검체·시료 수만 맞춘다.
 * 금액은 표준과 달라진 곳만 더하거나 뺀다 (lib/kind-design pdParts)
 */
function reqGet(payload: Values, category: string, id: string): string {
  const v = payload[`${category}.${id}`];
  return Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v.trim() : "";
}

function withRequest(t: DocTest, payload: Values): DocTest {
  const k = testKind(t);
  const get = (id: string) => reqGet(payload, t.category, id);
  const lines = (pairs: [string, string][]) => pairs.filter(([, v]) => v);
  if (k === "pd" && t.kd?.pd) {
    const groupsText = get("groups");
    const { groups, perGroup } = parseGroups(groupsText);
    const pd = structuredClone(t.kd.pd);
    if (perGroup) pd.groups = pd.groups.map((g) => ({ ...g, n: perGroup }));
    if (groups && groups > pd.groups.length) {
      for (let i = pd.groups.length; i < groups; i++) pd.groups.push({ ...newPdGroup("test", perGroup ?? pd.groups[0]?.n ?? 0), treat: pd.groups.find((g) => g.role === "test")?.treat ?? "" });
    } else if (groups && groups < pd.groups.length) {
      // 줄일 때는 뒤쪽 시험물질군부터 뺀다
      while (pd.groups.length > groups && pd.groups.some((g) => g.role === "test")) { const i = pd.groups.map((g) => g.role).lastIndexOf("test"); pd.groups.splice(i, 1); }
    }
    const ends = get("endpoints").split(/[,·\n]/).map((x) => x.trim()).filter(Boolean);
    for (const e of ends) if (!pd.endpoints.includes(e)) pd.endpoints.push(e.slice(0, 80));
    // 0047 모델 표준: 의뢰자가 적은 평가 지표 중 표준에 없는 것을 평가항목 줄로 (시점·방법은 기관이 채운다)
    const norm = (x: string) => x.toLowerCase().replace(/[\s()·,]/g, "");
    if (pd.evals) for (const e of ends) if (!pd.evals.some((x) => norm(x.item).includes(norm(e)) || norm(e).includes(norm(x.item)))) pd.evals.push({ id: `e${pd.evals.length + 1}r`, item: e.slice(0, 60), when: "", freq: "", method: "", target: "전 군" });
    const orig: Orig = { lines: lines([["질환 모델", get("method")], ["동물종", get("species")], ["군 구성", groupsText], ["양성 대조군", get("positive")], ["투여 기간", get("duration")], ["평가 지표", get("endpoints")], ["예비시험", get("pilot")]]), ...(groups ? { groups } : {}), ...(perGroup ? { perGroup } : {}) };
    return { ...t, kd: { ...t.kd, pd }, orig };
  }
  if (k === "pk" && t.kd?.pk) {
    const pk = structuredClone(t.kd.pk);
    const sampling = get("sampling");
    const n = parseTimes(sampling);
    if (!pk.times.length && sampling) {
      const unit = /분|min/i.test(sampling) && !/h|시간/i.test(sampling) ? "분" : "시간";
      pk.times = (sampling.replace(/총.*$/, "").match(/\d+(\.\d+)?/g) ?? []).slice(0, 24).map((x) => `${x}${unit}`);
    }
    const mx = (payload[`${t.category}.matrix`] as string[] | undefined) ?? [];
    if (Array.isArray(mx) && mx.length) pk.matrix = mx.filter((m) => PK_MATRIX.includes(m));
    const design = get("design");
    if (design && !pk.types.length) pk.types = design.split(", ").map((d) => (d === "단회" ? "단회 PK" : d === "반복" ? "반복 PK" : d)).filter((d) => PK_TYPES.includes(d));
    const orig: Orig = { lines: lines([["동물종", get("species")], ["설계", design], ["검체", get("matrix")], ["채혈 시기·횟수", sampling], ["분석 장비", get("instrument")]]), ...(n ? { times: n } : {}) };
    return { ...t, kd: { ...t.kd, pk }, orig };
  }
  if (k === "other" && t.kd?.other) {
    const samples = get("samples");
    const n = parseCount(samples);
    const other = { ...t.kd.other, ...(samples && !t.kd.other.sample ? { sample: samples.slice(0, 120) } : {}), ...(n ? { n } : {}) };
    const orig: Orig = { lines: lines([["시료 종류와 수", samples], ["받고 싶은 분석", get("desc")]]), ...(n ? { samples: n } : {}) };
    return { ...t, kd: { ...t.kd, other }, orig };
  }
  return t;
}

/** ifUpdatedAt: 이 판일 때만 저장한다(에이전트 도구). 그 사이 웹에서 고쳤으면 changed */
export async function saveDoc(orgId: string, id: string, raw: unknown, opts: { ifUpdatedAt?: string } = {}): Promise<{ ok: boolean; updatedAt?: string; error?: string; changed?: boolean }> {
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(id)) return { ok: false, error: "저장소 미설정" };
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const data = cleanDocData(o.data);
  const ymd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const t = docTotals(data);
  const patch = {
    title: docTitle(data),
    client: sstr(o.client, 200),
    substance: sstr(o.substance, 200),
    issued_on: ymd(o.issuedOn) ?? todaySeoul(),
    valid_until: ymd(o.validUntil),
    memo: sstr(o.memo, 2000),
    data: data as unknown as Record<string, unknown>,
    supply: t.supply,
  };
  let q = sb.from("cro_quote_docs").update(patch).eq("id", id).eq("org_id", orgId);
  if (opts.ifUpdatedAt) q = q.eq("updated_at", opts.ifUpdatedAt);
  const { data: row, error } = await q.select("updated_at").maybeSingle();
  if (error || !row) {
    // 오류 내용에는 견적서 본문이 들어갈 수 있어 코드만 남긴다
    if (error) console.error("cro_quote_docs update", error.code);
    return { ok: false, error: "저장하지 못했어요.", changed: !error && !!opts.ifUpdatedAt };
  }
  return { ok: true, updatedAt: row.updated_at };
}

export async function deleteDoc(orgId: string, id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb || !UUID.test(id)) return false;
  const { error } = await sb.from("cro_quote_docs").delete().eq("id", id).eq("org_id", orgId);
  return !error;
}

/** 견적서를 복제한다 (새 번호, 단추 요청 연결은 풀린다) */
export async function copyDoc(orgId: string, userId: string | null, id: string): Promise<{ id?: string; error?: string }> {
  const got = await loadDoc(orgId, id);
  if (!got) return { error: "견적서를 찾지 못했어요." };
  return insertDoc(orgId, userId, { client: got.head.client, substance: got.head.substance, data: got.data });
}

/* ── 양식 제작 요청 ── */

export type DesignRequest = { id: string; status: string; note: string; files: { path: string; name: string; size: number }[]; reply: string; createdAt: string; updatedAt: string };
export const DESIGN_STEPS = [
  { key: "received", label: "접수" },
  { key: "making", label: "제작 중" },
  { key: "review", label: "검토" },
  { key: "applied", label: "적용" },
] as const;

const filesOf = (v: unknown) => (Array.isArray(v) ? v : []).filter((f): f is { path: string; name: string; size: number } => !!f && typeof f === "object" && typeof (f as { path?: unknown }).path === "string").map((f) => ({ path: f.path, name: String(f.name ?? "파일"), size: Number(f.size) || 0 }));

export async function listDesignRequests(orgId: string | null): Promise<(DesignRequest & { orgId: string })[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  let q = sb.from("cro_quote_design_requests").select("*").order("created_at", { ascending: false }).limit(100);
  if (orgId) q = q.eq("org_id", orgId);
  const { data } = await q;
  return (data ?? []).map((r) => ({ id: r.id, orgId: r.org_id, status: r.status, note: r.note, files: filesOf(r.files), reply: r.reply, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export const DESIGN_DIR = "quote-design";

/** 카탈로그 조합 id → 그 조합을 쓰는 견적서 수 (단가 화면 안내용) */
export async function catalogUsage(orgId: string): Promise<Record<string, number>> {
  const sb = getSupabaseAdmin();
  if (!sb) return {};
  const { data } = await sb.from("cro_quote_docs").select("data").eq("org_id", orgId).limit(300);
  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    const ids = new Set(((r.data as { tests?: { catalogId?: unknown }[] })?.tests ?? []).map((t) => t?.catalogId).filter((x): x is string => typeof x === "string"));
    for (const id of ids) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}
