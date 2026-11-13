/**
 * 견적서 생성 툴 저장 계층 (0036). 모든 쿼리는 service role 로, 기관 id 는 호출부가 세션에서 넘긴다.
 */
import { getSupabaseAdmin } from "./supabase";
import { loadCatalog } from "./catalog-db";
import { pickVariant, rowKey, PRICE_CHECK_ROUTE, PRICE_CHECK_SPECIES, type CatalogRow } from "./catalog";
import { todaySeoul } from "./format";
import {
  blankTest, addDays, cleanDocData, cleanRates, DEFAULT_VISIBLE, docTitle, docTotals, EMPTY_SUPPLIER, EMPTY_TERMS, nextDocNo, testFromCatalog, testKind,
  type DocData, type DocTest, type DocHead, type QuoteStyle, isLayout, type Rate, type Supplier,
} from "./quote-doc";
import type { QuoteLineDef } from "./quote-items";
import { cleanKd, COST_KEYS, newPdGroup, parseCount, parseGroups, parseTimes, PK_MATRIX, PK_TYPES, type Kind, type Orig } from "./kind-design";
import type { Values } from "./rfq-schema";

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
  return insertDoc(orgId, userId, { client, substance, data });
}

/** 단추 요청으로 새 견적서: 요청의 시험 행마다 가장 가까운 카탈로그 조합을 고른다 (회신 초안과 같은 규칙) */
export async function createDocFromRequest(orgId: string, orgName: string, userId: string | null, a: { inviteId: string; rfqNo: string; substance: string; rows: QuoteLineDef[]; payload: Values }): Promise<{ id?: string; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "저장소 미설정" };
  // 같은 요청으로 만든 견적서가 있으면 그것을 연다 (두 번 눌러 두 부가 생기지 않게)
  const { data: had } = await sb.from("cro_quote_docs").select("id").eq("org_id", orgId).eq("invite_id", a.inviteId).order("created_at").limit(1);
  if (had?.[0]) return { id: had[0].id };
  const [rows, rates, style] = await Promise.all([loadCatalog(orgId), loadRates(orgId), loadStyle(orgId, orgName)]);
  const byKey = new Map<string, CatalogRow[]>();
  for (const r of rows) byKey.set(r.item_key, [...(byKey.get(r.item_key) ?? []), r]);
  const data = emptyData(style);
  for (const line of a.rows) {
    const picked = pickVariant(byKey.get(rowKey(line)) ?? [], line, a.payload);
    if (!picked || !picked.row.available) continue;
    // 대표가 아닌 동물종·경로로 맞으면 표준가를 그대로 쓰지 않는다 (기관이 금액을 적는다)
    const other = picked.mismatch.includes(PRICE_CHECK_SPECIES) || picked.mismatch.includes(PRICE_CHECK_ROUTE);
    const base = other ? { ...picked.row, std_price: null } : picked.row;
    const full = (byKey.get(rowKey(line)) ?? []).find((r) => r.id === picked.row.id) ?? picked.row;
    data.tests.push(withRequest({ ...testFromCatalog(base, rates.get(picked.row.item_key) ?? [], full), rfqSeq: line.seq }, a.payload));
  }
  return insertDoc(orgId, userId, { client: `단추 요청 ${a.rfqNo}`, substance: a.substance, inviteId: a.inviteId, rfqNo: a.rfqNo, data });
}

/**
 * 의뢰자 원안을 견적서 시험에 붙인다 (효력·약동학·개별 분석).
 * 설계는 기관 표준(시험 목록)에서 시작하고, 요청에 적힌 군 수·마릿수·채혈 시점·검체·시료 수만 맞춘다.
 * 금액은 표준과 달라진 곳만 더하거나 뺀다 (lib/kind-design pdParts)
 */
function withRequest(t: DocTest, payload: Values): DocTest {
  const k = testKind(t);
  const get = (id: string) => { const v = payload[`${t.category}.${id}`]; return Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v.trim() : ""; };
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

export async function saveDoc(orgId: string, id: string, raw: unknown): Promise<{ ok: boolean; updatedAt?: string; error?: string }> {
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
  const { data: row, error } = await sb.from("cro_quote_docs").update(patch).eq("id", id).eq("org_id", orgId).select("updated_at").maybeSingle();
  if (error || !row) {
    if (error) console.error("cro_quote_docs update", error);
    return { ok: false, error: "저장하지 못했어요." };
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
