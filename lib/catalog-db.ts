import { getSupabaseAdmin } from "./supabase";
import { catalogItems, emptyRow, itemKey, INCLUDE_KEYS, PER_SAMPLE_CATS, SPECIES, ROUTES, type CatalogRow, type Glp } from "./catalog";

/** 기관의 카탈로그 전체 (없는 항목은 빈 행으로 채워 항목 순서대로) */
export async function loadCatalog(orgId: string): Promise<CatalogRow[]> {
  const sb = getSupabaseAdmin();
  const items = catalogItems();
  if (!sb) return items.map(emptyRow);
  const { data } = await sb.from("cro_catalog").select("*").eq("org_id", orgId);
  const by = new Map((data ?? []).map((r) => [r.item_key as string, r]));
  return items.map((it) => {
    const r = by.get(it.key);
    if (!r) return emptyRow(it);
    return {
      ...emptyRow(it),
      available: !!r.available,
      glp: (r.glp as Glp) || "both",
      species: Array.isArray(r.species) ? r.species : [],
      groups_ctrl: r.groups_ctrl, groups_test: r.groups_test, per_sex: r.per_sex,
      recovery_weeks: r.recovery_weeks, recovery_per_sex: r.recovery_per_sex,
      route: r.route, dosing: r.dosing, weeks: r.weeks,
      includes: Array.isArray(r.includes) ? r.includes : [],
      options: Array.isArray(r.options) ? r.options : [],
      unit: r.unit === "per_sample" ? "per_sample" : "total",
      price_min: r.price_min, price_max: r.price_max,
      extra: r.extra && typeof r.extra === "object" ? r.extra : {},
      note: r.note,
      last_amount: r.last_amount, last_weeks: r.last_weeks, last_quoted_at: r.last_quoted_at,
      source: (r.source as CatalogRow["source"]) || "empty",
    };
  });
}

/** 카탈로그 행을 Map으로 (초안 채우기용) */
export async function catalogMap(orgId: string): Promise<Map<string, CatalogRow>> {
  const rows = await loadCatalog(orgId);
  return new Map(rows.map((r) => [r.item_key, r]));
}

const int = (v: unknown, max = 9999) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : typeof v === "string" && /^\d{1,7}$/.test(v) ? Math.min(max, Number(v)) : null);
const big = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : typeof v === "string" && /^\d{1,13}$/.test(v) ? Number(v) : null);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const arr = (v: unknown, allow?: readonly string[]) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string" && (!allow || allow.includes(x))).slice(0, 30) : []);

/** 기관이 편집한 행을 저장 (입력값은 여기서만 정리한다) */
export async function upsertCatalog(orgId: string, rows: unknown[]): Promise<{ saved: number; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { saved: 0, error: "저장소 미설정" };
  const valid = new Map(catalogItems().map((it) => [it.key, it]));
  const out: Record<string, unknown>[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const it = valid.get(String(r.item_key));
    if (!it) continue;
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
    const manualTouched = !!(arr(r.species, SPECIES).length || int(r.per_sex) != null || int(r.weeks) != null || big(r.price_min) != null || arr(r.includes, INCLUDE_KEYS).length || options.length || r.available === false);
    out.push({
      org_id: orgId, item_key: it.key, category: it.category, item: it.item,
      available: r.available !== false,
      glp: ["GLP", "Non-GLP", "both"].includes(String(r.glp)) ? r.glp : "both",
      species: arr(r.species, SPECIES),
      groups_ctrl: int(r.groups_ctrl, 20), groups_test: int(r.groups_test, 20), per_sex: int(r.per_sex, 200),
      recovery_weeks: int(r.recovery_weeks, 52), recovery_per_sex: int(r.recovery_per_sex, 100),
      route: ROUTES.includes(String(r.route)) ? r.route : str(r.route, 60),
      dosing: str(r.dosing, 120), weeks: int(r.weeks, 200),
      includes: arr(r.includes, INCLUDE_KEYS), options,
      unit: r.unit === "per_sample" || (r.unit == null && PER_SAMPLE_CATS.includes(it.category)) ? "per_sample" : "total",
      price_min: big(r.price_min), price_max: big(r.price_max),
      extra, note: str(r.note, 500),
      source: manualTouched ? "manual" : undefined,
    });
  }
  if (!out.length) return { saved: 0 };
  // source 가 undefined 인 행은 기존 값을 유지해야 하므로 두 번에 나눠 저장
  const manual = out.filter((o) => o.source === "manual");
  const rest = out.filter((o) => o.source !== "manual").map((o) => { const { source: _s, ...x } = o; void _s; return x; });
  for (const chunk of [manual, rest]) {
    if (!chunk.length) continue;
    const { error } = await sb.from("cro_catalog").upsert(chunk, { onConflict: "org_id,item_key" });
    if (error) {
      console.error("cro_catalog upsert", error);
      return { saved: 0, error: "저장하지 못했습니다." };
    }
  }
  return { saved: out.length };
}

/** 제출값을 카탈로그의 "최근 회신"으로 되돌린다. 기관이 직접 입력한 칸은 건드리지 않는다. */
export async function learnFromSubmission(
  orgId: string,
  items: { category: string; name: string; avail: string | null; amount: number | null; weeks: number | null; unit?: string | null; unitPrice?: number | null; design?: Record<string, unknown> | null }[],
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const valid = new Map(catalogItems().map((it) => [it.key, it]));
  const { data: existing } = await sb.from("cro_catalog").select("item_key, source, species, weeks").eq("org_id", orgId);
  const by = new Map((existing ?? []).map((r) => [r.item_key as string, r]));
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    if (it.avail === "불가" || it.avail === "") continue;
    const key = itemKey(it.category, it.name === it.category ? it.category : it.name);
    const def = valid.get(key);
    if (!def) continue;
    const prev = by.get(key);
    const learned = it.unit === "per_sample" ? it.unitPrice : it.amount;
    const row: Record<string, unknown> = {
      org_id: orgId, item_key: key, category: def.category, item: def.item,
      last_amount: learned ?? null, last_weeks: it.weeks ?? null, last_quoted_at: now,
    };
    if (!prev) {
      // 카탈로그에 없던 항목: 제출한 설계로 새 행을 만든다
      const d = it.design ?? {};
      Object.assign(row, {
        available: true, source: "learned",
        species: Array.isArray(d.species) ? d.species : [],
        groups_ctrl: d.groups_ctrl ?? null, groups_test: d.groups_test ?? null, per_sex: d.per_sex ?? null,
        recovery_weeks: d.recovery_weeks ?? null, recovery_per_sex: d.recovery_per_sex ?? null,
        route: d.route ?? null, dosing: d.dosing ?? null,
        weeks: it.weeks ?? null, unit: it.unit === "per_sample" ? "per_sample" : "total",
      });
    } else if (prev.source !== "manual") {
      row.source = "learned";
      if (!prev.weeks && it.weeks) row.weeks = it.weeks;
    }
    rows.push(row);
  }
  if (!rows.length) return;
  const { error } = await sb.from("cro_catalog").upsert(rows, { onConflict: "org_id,item_key" });
  if (error) console.error("cro_catalog learn", error);
}
