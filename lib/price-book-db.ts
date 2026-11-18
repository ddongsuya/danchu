/**
 * 효력시험 기관 단가표 읽기·쓰기 (0047). 서버(service role)만 부른다. 기관 확인은 부르는 쪽이 세션으로 한다.
 */
import type { Admin } from "./supabase";
import type { Via } from "./db-types";
import { itemFromDb, previewImport, type ImportRow, type ItemInput, type PriceItem } from "./price-book";

export type PriceLog = { id: number; item_name: string; before: number | null; after: number | null; via: string; changed_at: string };
export type PriceBook = { items: PriceItem[]; marginPct: number; log: PriceLog[] };

export async function loadPriceBook(sb: Admin, orgId: string, opts: { archived?: boolean } = {}): Promise<PriceBook> {
  let q = sb.from("cro_price_items").select("*").eq("org_id", orgId);
  if (!opts.archived) q = q.eq("archived", false);
  const [items, set, log] = await Promise.all([
    q.order("category").order("sort").order("created_at"),
    sb.from("cro_price_settings").select("margin_pct").eq("org_id", orgId).maybeSingle(),
    sb.from("cro_price_log").select("id, item_name, before, after, via, changed_at").eq("org_id", orgId).order("changed_at", { ascending: false }).limit(20),
  ]);
  if (items.error) throw items.error;
  return {
    items: (items.data ?? []).flatMap((r) => itemFromDb(r as Record<string, unknown>) ?? []),
    marginPct: Number(set.data?.margin_pct ?? 0) || 0,
    log: (log.data ?? []) as PriceLog[],
  };
}

async function writeLog(sb: Admin, rows: { org_id: string; item_id: string | null; item_name: string; before: number | null; after: number | null; via: Via; changed_by: string | null }[]) {
  if (!rows.length) return;
  const { error } = await sb.from("cro_price_log").insert(rows);
  if (error) console.error("price log", error.code);
}

export async function createItem(sb: Admin, orgId: string, v: ItemInput, by: string | null, via: Via): Promise<PriceItem> {
  const { data, error } = await sb.from("cro_price_items").insert({ org_id: orgId, category: v.category, name: v.name, attrs: v.attrs, unit: v.unit, price: v.price, memo: v.memo, sort: v.sort ?? 0 }).select("*").single();
  if (error || !data) throw error ?? new Error("insert");
  const it = itemFromDb(data as Record<string, unknown>)!;
  await writeLog(sb, [{ org_id: orgId, item_id: it.id, item_name: it.name, before: null, after: it.price, via, changed_by: by }]);
  return it;
}

/** 고치기. 다른 기관 행이면 null */
export async function updateItem(sb: Admin, orgId: string, id: string, v: ItemInput, by: string | null, via: Via): Promise<PriceItem | null> {
  const { data: cur } = await sb.from("cro_price_items").select("price").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!cur) return null;
  const { data, error } = await sb.from("cro_price_items").update({ category: v.category, name: v.name, attrs: v.attrs, unit: v.unit, price: v.price, memo: v.memo, ...(v.sort === undefined ? {} : { sort: v.sort }) }).eq("id", id).eq("org_id", orgId).select("*").single();
  if (error || !data) throw error ?? new Error("update");
  const it = itemFromDb(data as Record<string, unknown>)!;
  if (Number(cur.price) !== it.price) await writeLog(sb, [{ org_id: orgId, item_id: id, item_name: it.name, before: Number(cur.price), after: it.price, via, changed_by: by }]);
  return it;
}

/** 숨기기 (지우지 않는다: 옛 모델 표준·견적서가 가리킬 수 있다) */
export async function archiveItem(sb: Admin, orgId: string, id: string, by: string | null, via: Via): Promise<boolean> {
  const { data } = await sb.from("cro_price_items").update({ archived: true }).eq("id", id).eq("org_id", orgId).eq("archived", false).select("name, price").maybeSingle();
  if (!data) return false;
  await writeLog(sb, [{ org_id: orgId, item_id: id, item_name: String(data.name), before: Number(data.price), after: null, via, changed_by: by }]);
  return true;
}

export async function setMargin(sb: Admin, orgId: string, pct: number): Promise<void> {
  const { error } = await sb.from("cro_price_settings").upsert({ org_id: orgId, margin_pct: pct, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  if (error) throw error;
}

/**
 * 가져오기. preview 는 비교만, apply 는 새 항목 추가·바뀐 단가 고치기 (오류 줄과 그대로인 줄은 건너뛴다).
 * apply 도 저장 직전에 다시 비교한다 (미리보기와 저장 사이에 단가표가 바뀌었을 수 있다).
 */
export async function importItems(sb: Admin, orgId: string, rows: unknown[], mode: "preview" | "apply", by: string | null, via: Via): Promise<{ rows: ImportRow[]; added: number; changed: number }> {
  const book = await loadPriceBook(sb, orgId);
  const res = previewImport(rows, book.items);
  if (mode === "preview") return { rows: res, added: 0, changed: 0 };
  let added = 0;
  let changed = 0;
  for (const r of res) {
    if (r.status === "new") { await createItem(sb, orgId, r.value, by, via); added++; }
    else if (r.status === "changed") { if (await updateItem(sb, orgId, r.id, r.value, by, via)) changed++; }
  }
  return { rows: res, added, changed };
}
