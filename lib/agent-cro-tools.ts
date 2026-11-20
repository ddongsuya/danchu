/**
 * 기관 비서 도구 D5 (2026-11-20 설계안: 단추 전체 기능 대조표).
 *   - 시험 목록 고치기: 미리보기(바뀌는 칸 전·후)와 반영. 단가표처럼 사람이 미리보기를 확인한 값만 반영한다.
 *     새 조합 만들기·지우기는 웹에서만(사람).
 *   - 고객관리 찾기: 고객사·담당자·안건·할 일·일정을 이름으로 찾는다. 금액·이메일·전화는 내보내지 않는다(브리핑과 같은 규칙).
 * 순수 함수만 둔다(테스트 대상).
 */
import type { CatalogRow } from "./catalog";
import type { CrmData } from "./crm";

/** 에이전트로 고칠 수 있는 시험 목록 칸. 표준가·옵션 금액은 사람이 앱 입력란에 넣은 값이어야 한다(에이전트 서버 규칙) */
export const CATALOG_FIELDS = [
  "available", "species", "routes", "method", "groups_ctrl", "groups_test", "per_sex", "recovery_weeks", "recovery_per_sex",
  "dosing", "weeks", "includes", "note", "std_price", "options",
] as const;
export type CatalogField = (typeof CATALOG_FIELDS)[number];
export type CatalogPatch = { id: string } & Partial<Pick<CatalogRow, CatalogField>>;
export type CatalogDiff = { id: string; item: string; field: CatalogField; before: unknown; after: unknown };

const INT = (v: unknown, max: number) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max);
const STRS = (v: unknown, n: number) => Array.isArray(v) && v.length <= n && v.every((x) => typeof x === "string" && x.length <= 80);

function validField(k: CatalogField, v: unknown): boolean {
  switch (k) {
    case "available": return typeof v === "boolean";
    case "species": case "routes": case "includes": return STRS(v, 20);
    case "method": case "dosing": case "note": return v === null || (typeof v === "string" && v.length <= 300);
    case "groups_ctrl": case "groups_test": return INT(v, 20);
    case "per_sex": case "recovery_per_sex": return INT(v, 200);
    case "recovery_weeks": case "weeks": return INT(v, 520);
    case "std_price": return INT(v, 100_000_000_000);
    case "options": return Array.isArray(v) && v.length <= 20 && v.every((o) => o && typeof o === "object" && typeof (o as { name?: unknown }).name === "string" && INT((o as { amount?: unknown }).amount ?? null, 100_000_000_000));
  }
}

/**
 * 고칠 행과 칸을 지금 시험 목록과 견준다. 없는 행·모르는 칸·틀린 값은 errors 로, 바뀌는 칸은 diffs 로.
 * rows 는 반영할 전체 행(지금 행 + 고친 칸). 대분류 단위 저장이므로 고친 행만 보낸다.
 */
export function catalogPatch(current: CatalogRow[], patches: unknown): { rows: CatalogRow[]; diffs: CatalogDiff[]; errors: { id: string; field?: string; error: string }[] } {
  const errors: { id: string; field?: string; error: string }[] = [];
  const diffs: CatalogDiff[] = [];
  const rows: CatalogRow[] = [];
  if (!Array.isArray(patches) || patches.length > 100) return { rows, diffs, errors: [{ id: "", error: "bad_request" }] };
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const p of patches) {
    const o = (p ?? {}) as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const cur = byId.get(id);
    if (!cur) { errors.push({ id, error: "not_found" }); continue; }
    const next: CatalogRow = structuredClone(cur);
    let changed = false;
    for (const [k, v] of Object.entries(o)) {
      if (k === "id") continue;
      if (!(CATALOG_FIELDS as readonly string[]).includes(k)) { errors.push({ id, field: k, error: "field_not_allowed" }); continue; }
      const f = k as CatalogField;
      if (!validField(f, v)) { errors.push({ id, field: k, error: "bad_value" }); continue; }
      if (JSON.stringify(cur[f] ?? null) === JSON.stringify(v ?? null)) continue;
      (next as Record<string, unknown>)[f] = v;
      // 대표 경로(route)는 routes[0] 을 따른다
      if (f === "routes") next.route = (v as string[])[0] ?? null;
      diffs.push({ id, item: cur.item, field: f, before: cur[f] ?? null, after: v });
      changed = true;
    }
    if (changed) rows.push(next);
  }
  return { rows, diffs, errors };
}

export type CrmHit = { kind: "company" | "contact" | "deal" | "task" | "event"; id: string; title: string; sub: string; at: string | null; companyId: string | null };

/** 이름·제목으로 찾기. 금액·이메일·전화·메모는 넣지 않는다 */
export function crmFind(d: Pick<CrmData, "companies" | "contacts" | "deals" | "tasks" | "events">, q: string, kinds?: CrmHit["kind"][], limit = 20): CrmHit[] {
  const s = q.trim().toLowerCase();
  const on = (k: CrmHit["kind"]) => !kinds?.length || kinds.includes(k);
  const has = (...xs: (string | null | undefined)[]) => !s || xs.some((x) => (x ?? "").toLowerCase().includes(s));
  const coName = new Map(d.companies.map((c) => [c.id, c.name]));
  const out: CrmHit[] = [];
  if (on("company")) for (const c of d.companies) if (has(c.name, ...(c.aliases ?? []))) out.push({ kind: "company", id: c.id, title: c.name, sub: c.industry ?? "", at: c.updated_at, companyId: c.id });
  if (on("contact")) for (const c of d.contacts) if (has(c.name, coName.get(c.company_id))) out.push({ kind: "contact", id: c.id, title: c.name, sub: [coName.get(c.company_id), c.dept, c.title].filter(Boolean).join(" · "), at: c.updated_at, companyId: c.company_id });
  if (on("deal")) for (const x of d.deals) if (has(x.title, x.substance, x.rfq_no, coName.get(x.company_id ?? ""))) out.push({ kind: "deal", id: x.id, title: x.title, sub: [coName.get(x.company_id ?? ""), x.stage, x.status].filter(Boolean).join(" · "), at: x.expected_on, companyId: x.company_id });
  if (on("task")) for (const t of d.tasks) if (has(t.title, coName.get(t.company_id ?? ""))) out.push({ kind: "task", id: t.id, title: t.title, sub: [coName.get(t.company_id ?? ""), t.done_at ? "완료" : "진행"].filter(Boolean).join(" · "), at: t.due_on, companyId: t.company_id });
  if (on("event")) for (const e of d.events) if (has(e.title, coName.get(e.company_id ?? ""))) out.push({ kind: "event", id: e.id, title: e.title, sub: [coName.get(e.company_id ?? ""), e.kind].filter(Boolean).join(" · "), at: e.starts_at, companyId: e.company_id });
  return out.slice(0, limit);
}
