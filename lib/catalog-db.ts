import { getSupabaseAdmin } from "./supabase";
import { catalogItems, isNewId, itemKey, INCLUDE_KEYS, PER_SAMPLE_CATS, SPECIES, ROUTES, CATEGORY_ORDER, type CatalogRow, type Glp } from "./catalog";

function fromDb(r: Record<string, unknown>): CatalogRow {
  return {
    id: String(r.id),
    item_key: String(r.item_key), category: String(r.category), item: String(r.item),
    available: r.available !== false,
    glp: (r.glp as Glp) || "both",
    species: Array.isArray(r.species) ? (r.species as string[]) : [],
    route: (r.route as string | null) ?? null,
    method: (r.method as string | null) ?? null,
    groups_ctrl: (r.groups_ctrl as number | null) ?? null, groups_test: (r.groups_test as number | null) ?? null, per_sex: (r.per_sex as number | null) ?? null,
    recovery_weeks: (r.recovery_weeks as number | null) ?? null, recovery_per_sex: (r.recovery_per_sex as number | null) ?? null,
    dosing: (r.dosing as string | null) ?? null, weeks: (r.weeks as number | null) ?? null,
    includes: Array.isArray(r.includes) ? (r.includes as string[]) : [],
    options: Array.isArray(r.options) ? (r.options as CatalogRow["options"]) : [],
    unit: r.unit === "per_sample" ? "per_sample" : "total",
    price_min: (r.price_min as number | null) ?? null, price_max: (r.price_max as number | null) ?? null,
    extra: r.extra && typeof r.extra === "object" ? (r.extra as CatalogRow["extra"]) : {},
    note: (r.note as string | null) ?? null,
    last_amount: (r.last_amount as number | null) ?? null, last_weeks: (r.last_weeks as number | null) ?? null, last_quoted_at: (r.last_quoted_at as string | null) ?? null,
    source: (r.source as CatalogRow["source"]) || "empty",
    sort: typeof r.sort === "number" ? r.sort : 0,
  };
}

/** 기관의 카탈로그 전체 (조합 행만, 항목·정렬 순) */
export async function loadCatalog(orgId: string): Promise<CatalogRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("cro_catalog").select("*").eq("org_id", orgId).order("sort").order("created_at");
  const order = new Map(catalogItems().map((it, i) => [it.key, i]));
  return ((data ?? []) as Record<string, unknown>[]).map(fromDb).sort((a, b) => (order.get(a.item_key) ?? 9999) - (order.get(b.item_key) ?? 9999) || a.sort - b.sort);
}

/** 항목 키 → 조합 목록 (초안 채우기용) */
export async function catalogMap(orgId: string): Promise<Map<string, CatalogRow[]>> {
  const m = new Map<string, CatalogRow[]>();
  for (const r of await loadCatalog(orgId)) m.set(r.item_key, [...(m.get(r.item_key) ?? []), r]);
  return m;
}

const int = (v: unknown, max = 9999) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : typeof v === "string" && /^\d{1,7}$/.test(v) ? Math.min(max, Number(v)) : null);
const big = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : typeof v === "string" && /^\d{1,13}$/.test(v) ? Number(v) : null);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const arr = (v: unknown, allow?: readonly string[]) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string" && (!allow || allow.includes(x))).slice(0, 30) : []);

/** 클라이언트 행 → DB 행 (입력값은 여기서만 정리한다). 항목이 스키마에 없으면 null */
function toDb(orgId: string, raw: unknown, valid: Map<string, { category: string; item: string }>, sort: number): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const it = valid.get(String(r.item_key));
  if (!it) return null;
  const extra: Record<string, string | string[]> = {};
  if (r.extra && typeof r.extra === "object") {
    for (const [k, v] of Object.entries(r.extra as Record<string, unknown>)) {
      if (typeof v === "string") extra[k] = v.slice(0, 300);
      else if (Array.isArray(v)) extra[k] = v.filter((x): x is string => typeof x === "string").slice(0, 20);
    }
  }
  const options = Array.isArray(r.options)
    ? (r.options as unknown[])
        .map((o) => (o && typeof o === "object" ? { name: str((o as { name?: unknown }).name, 80), amount: big((o as { amount?: unknown }).amount) } : null))
        .filter((o): o is { name: string; amount: number | null } => !!o && !!o.name)
        .slice(0, 20)
    : [];
  return {
    org_id: orgId, item_key: String(r.item_key), category: it.category, item: it.item,
    available: r.available !== false,
    glp: ["GLP", "Non-GLP", "both"].includes(String(r.glp)) ? r.glp : "both",
    species: arr(r.species, SPECIES),
    route: ROUTES.includes(String(r.route)) ? r.route : str(r.route, 60),
    method: str(r.method, 120),
    groups_ctrl: int(r.groups_ctrl, 20), groups_test: int(r.groups_test, 20), per_sex: int(r.per_sex, 200),
    recovery_weeks: int(r.recovery_weeks, 52), recovery_per_sex: int(r.recovery_per_sex, 100),
    dosing: str(r.dosing, 120), weeks: int(r.weeks, 200),
    includes: arr(r.includes, INCLUDE_KEYS), options,
    unit: r.unit === "per_sample" || (r.unit == null && PER_SAMPLE_CATS.includes(it.category)) ? "per_sample" : "total",
    price_min: big(r.price_min), price_max: big(r.price_max),
    extra, note: str(r.note, 500),
    source: "manual",
    sort,
  };
}

/**
 * 기관이 편집한 조합을 저장. id 가 uuid 면 갱신, 임시 id 면 새로 만든다. removed 의 id 는 삭제.
 * 저장 후 그 기관의 전체 카탈로그를 돌려준다 (새 id 반영).
 */
export async function upsertCatalog(orgId: string, rows: unknown[], removed: unknown[] = []): Promise<{ saved: number; rows: CatalogRow[]; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { saved: 0, rows: [], error: "저장소 미설정" };
  const valid = new Map(catalogItems().map((it) => [it.key, it]));
  const { data: mine } = await sb.from("cro_catalog").select("id").eq("org_id", orgId);
  const own = new Set((mine ?? []).map((x) => x.id as string));

  const del = removed.filter((x): x is string => typeof x === "string" && own.has(x));
  if (del.length) {
    const { error } = await sb.from("cro_catalog").delete().eq("org_id", orgId).in("id", del);
    if (error) return { saved: 0, rows: [], error: "삭제하지 못했습니다." };
  }

  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const perItem = new Map<string, number>();
  for (const raw of rows) {
    const key = raw && typeof raw === "object" ? String((raw as { item_key?: unknown }).item_key) : "";
    const sort = perItem.get(key) ?? 0;
    perItem.set(key, sort + 1);
    const row = toDb(orgId, raw, valid, sort);
    if (!row) continue;
    const id = raw && typeof raw === "object" ? String((raw as { id?: unknown }).id ?? "") : "";
    if (id && !isNewId(id)) {
      if (!own.has(id)) continue; // 남의 행
      updates.push({ ...row, id });
    } else {
      inserts.push(row);
    }
  }
  if (updates.length) {
    const { error } = await sb.from("cro_catalog").upsert(updates, { onConflict: "id" });
    if (error) {
      console.error("cro_catalog update", error);
      return { saved: 0, rows: [], error: "저장하지 못했습니다." };
    }
  }
  if (inserts.length) {
    const { error } = await sb.from("cro_catalog").insert(inserts);
    if (error) {
      console.error("cro_catalog insert", error);
      return { saved: 0, rows: [], error: "저장하지 못했습니다." };
    }
  }
  return { saved: updates.length + inserts.length, rows: await loadCatalog(orgId) };
}

/** 제출값을 카탈로그의 "최근 회신"으로 되돌린다. 기관이 직접 입력한 칸은 건드리지 않는다. */
export async function learnFromSubmission(
  orgId: string,
  items: { category: string; name: string; avail: string | null; amount: number | null; weeks: number | null; unit?: string | null; unitPrice?: number | null; design?: Record<string, unknown> | null }[],
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const valid = new Map(catalogItems().map((it) => [it.key, it]));
  const existing = await catalogMap(orgId);
  const now = new Date().toISOString();
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  for (const it of items) {
    if (it.avail === "불가" || it.avail === "") continue;
    const key = itemKey(it.category, it.name === it.category ? it.category : it.name);
    const def = valid.get(key);
    if (!def) continue;
    const d = it.design ?? {};
    const species = Array.isArray(d.species) ? (d.species as string[]) : [];
    const route = typeof d.route === "string" ? d.route : null;
    const method = typeof d.method === "string" ? d.method : null;
    const learned = it.unit === "per_sample" ? it.unitPrice : it.amount;
    // 같은 조합 찾기: 종·경로·시험법이 맞는 행, 없으면 종만 맞는 행, 그것도 없고 행이 하나뿐이면 그 행
    const rows = existing.get(key) ?? [];
    const same = (a: string[] | null, b: string[] | null) => !a?.length || !b?.length || a.some((x) => b.includes(x));
    const match =
      rows.find((r) => same(species, r.species) && (!route || !r.route || r.route === route) && (!method || !r.method || r.method === method)) ??
      rows.find((r) => same(species, r.species)) ??
      (rows.length === 1 ? rows[0] : undefined);
    if (match) {
      const patch: Record<string, unknown> = { id: match.id, last_amount: learned ?? null, last_weeks: it.weeks ?? null, last_quoted_at: now };
      if (match.source !== "manual") {
        patch.source = "learned";
        if (!match.weeks && it.weeks) patch.weeks = it.weeks;
        if (!match.species.length && species.length) patch.species = species;
        if (!match.route && route) patch.route = route;
        if (!match.method && method) patch.method = method;
      }
      updates.push(patch);
    } else {
      inserts.push({
        org_id: orgId, item_key: key, category: def.category, item: def.item,
        available: true, source: "learned",
        species, route, method,
        groups_ctrl: d.groups_ctrl ?? null, groups_test: d.groups_test ?? null, per_sex: d.per_sex ?? null,
        recovery_weeks: d.recovery_weeks ?? null, recovery_per_sex: d.recovery_per_sex ?? null, dosing: d.dosing ?? null,
        weeks: it.weeks ?? null, unit: it.unit === "per_sample" ? "per_sample" : "total",
        last_amount: learned ?? null, last_weeks: it.weeks ?? null, last_quoted_at: now, sort: rows.length,
      });
    }
  }
  for (const u of updates) {
    const { id, ...patch } = u;
    const { error } = await sb.from("cro_catalog").update(patch).eq("id", id as string).eq("org_id", orgId);
    if (error) console.error("cro_catalog learn update", error);
  }
  if (inserts.length) {
    const { error } = await sb.from("cro_catalog").insert(inserts);
    if (error) console.error("cro_catalog learn insert", error);
  }
}

/* ── 패키지 프리셋 제공 여부 ─────────────────────────────── */

export type OrgPreset = { preset_key: string; offered: boolean; package_price: number | null; note: string | null };

export async function loadOrgPresets(orgId: string): Promise<OrgPreset[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb.from("cro_org_presets").select("preset_key, offered, package_price, note").eq("org_id", orgId);
  return (data ?? []) as OrgPreset[];
}

export async function upsertOrgPreset(orgId: string, p: { preset_key: string; offered: boolean; package_price: unknown; note: unknown }): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb.from("cro_org_presets").upsert({ org_id: orgId, preset_key: p.preset_key, offered: !!p.offered, package_price: big(p.package_price), note: str(p.note, 300), updated_at: new Date().toISOString() }, { onConflict: "org_id,preset_key" });
  if (error) console.error("cro_org_presets", error);
  return !error;
}

/** 대분류 표시 순서 정렬 키 */
export const catOrder = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? 999 : i; };
