/**
 * 에이전트 요청서 도구 (2026-11-20 설계안 D1: 에이전트가 단추를 직접 쓰는 구조).
 *
 * 에이전트는 요청서 양식을 따로 갖지 않는다. 단추 양식(lib/rfq-schema.ts)을 그대로 받아 칸을 채우고(request_schema),
 * 보내기 전에 단추가 같은 규칙으로 검사한다(request_check). 접수(create)도 같은 검사를 거친다.
 *
 * - 양식 판(REQUEST_SCHEMA_VERSION)은 양식 정의에서 계산한다. 선택지가 바뀌면 판이 바뀌고, 옛 판으로 보낸 요청은 schema_outdated.
 * - 옛 앱 유예: 판을 보내지 않은 접수(현장에 깔린 앱)는 검사에 걸려도 경고만 남기고 받는다. AGENT_REQUEST_STRICT=1 이면 모두 엄격.
 * 이 파일은 순수 함수만 둔다(테스트 대상). 기관 맞추기·실행은 lib/agent-actions.ts.
 */
import { createHash } from "node:crypto";
import { CATS, CONTACT, DETAILS, STEP2, WIZ, detailRequired, labelMap, validateRequired, type Field, type Values } from "./rfq-schema";
import { quoteRowsFromPayload, type QuoteLineDef } from "./quote-items";

export type SchemaField = {
  key: string;
  type: Field["type"];
  label: string;
  required: boolean;
  options?: string[];
  /** 같은 분야의 칸(키 전체)에 이 값 중 하나가 있으면 필수. 숫자가 들어가야 한다 */
  requiredIf?: { key: string; anyOf: string[] };
};
export type RequestSchema = {
  schemaVersion: string;
  /** 요청 전체 칸(위자드·상세 조건). 담당자 정보는 단추 프로필에서 채우므로 없다 */
  fields: SchemaField[];
  /** 분야별 조건 칸. 키는 `<분야>.<칸>` */
  categories: { name: string; fields: SchemaField[]; itemsKey: string | null }[];
};

const toField = (f: Field, key = f.id, fallbackLabel = f.id, cat?: string): SchemaField => ({
  key,
  type: f.type,
  label: f.label || fallbackLabel,
  required: !!f.required,
  ...(f.options?.length ? { options: [...f.options] } : {}),
  ...(f.requiredIf && cat ? { requiredIf: { key: `${cat}.${f.requiredIf.field}`, anyOf: [...f.requiredIf.anyOf] } } : {}),
});

/** 분야의 시험 종류 칸(items, 생식발생독성은 segment). 없으면 null */
export function itemsFieldOf(cat: string): string | null {
  const fs = DETAILS[cat as (typeof CATS)[number]] ?? [];
  return fs.find((f) => f.id === "items")?.id ?? fs.find((f) => f.id === "segment")?.id ?? null;
}

function buildSchema(): Omit<RequestSchema, "schemaVersion"> {
  // 파일 칸은 에이전트로 받지 않는다(첨부는 따로). 동의 칸은 확인 카드에서 사람이 체크한다
  const fields: SchemaField[] = [
    ...WIZ.flatMap((s) => s.fields.map((f) => toField(f, f.id, s.q))),
    ...STEP2.flatMap((g) => g.fields.filter((f) => f.type !== "file").map((f) => toField(f))),
  ];
  const categories = CATS.map((cat) => ({
    name: cat,
    fields: DETAILS[cat].map((f) => toField(f, `${cat}.${f.id}`, f.id, cat)),
    itemsKey: itemsFieldOf(cat) ? `${cat}.${itemsFieldOf(cat)}` : null,
  }));
  return { fields, categories };
}

const BUILT = buildSchema();
/** 양식 판: 칸·선택지·필수 여부에서 계산한다(사람이 올리는 것을 잊지 않게) */
export const REQUEST_SCHEMA_VERSION = createHash("sha256").update(JSON.stringify(BUILT)).digest("hex").slice(0, 12);

export function requestSchema(): RequestSchema {
  return { schemaVersion: REQUEST_SCHEMA_VERSION, ...structuredClone(BUILT) };
}

export type IssueCode = "required" | "items_missing" | "bad_option" | "unknown_field";
export type RequestIssue = { key: string; label: string; code: IssueCode; message?: string };

/** 접수 때 단추가 붙이는 칸과 담당자 칸(프로필에서 채움). 검사에서 모르는 칸으로 보지 않는다 */
const SYSTEM_KEYS = new Set(["source", "consentVersion", "orgType", "website", "advisorAnswers", "advisorNotes", "advisorPrereq", "advisorAsk", ...CONTACT.map((f) => f.id)]);
const CHOICE: ReadonlySet<Field["type"]> = new Set(["select", "radio", "segmented", "chips"]);

const KNOWN: Map<string, SchemaField> = new Map([
  ...BUILT.fields.map((f) => [f.key, f] as const),
  ...BUILT.categories.flatMap((c) => c.fields.map((f) => [f.key, f] as const)),
]);

/**
 * 요청서 본문 검사. 막는 것: 필수 칸(웹과 같은 규칙), 분야에 시험 종류가 없음, 선택지에 없는 값.
 * 막지 않는 것(경고): 양식에 없는 칸. 이런 칸은 기관에게 칸 이름 그대로 보이므로 정리된 본문에서 뺀다.
 */
export function checkRequestValues(values: Values): { issues: RequestIssue[]; warnings: RequestIssue[]; payload: Values; rows: QuoteLineDef[] } {
  const labels = labelMap();
  const issues: RequestIssue[] = [];
  const warnings: RequestIssue[] = [];
  const payload: Values = {};

  const required = validateRequired({ ...values });
  // 조건부 필수(PK 동물 시험의 군 수·군당 마릿수)는 칸마다 알려 준다. 앱이 그 칸을 바로 묻게
  const details = detailRequired(values);
  if (required && !details.some((d) => d.message === required)) issues.push({ key: "", label: "", code: "required", message: required });
  for (const d of details) issues.push({ key: d.key, label: labels[d.key] ?? d.key, code: "required", message: d.message });

  const cats = Array.isArray(values.categories) ? values.categories.filter((c) => (CATS as readonly string[]).includes(c)) : [];
  for (const cat of cats) {
    const k = itemsFieldOf(cat);
    if (!k) continue;
    const v = values[`${cat}.${k}`];
    if (!Array.isArray(v) || v.length === 0) issues.push({ key: `${cat}.${k}`, label: labels[`${cat}.${k}`] ?? cat, code: "items_missing" });
  }

  for (const [key, v] of Object.entries(values)) {
    if (SYSTEM_KEYS.has(key)) continue;
    const f = KNOWN.get(key);
    if (!f) {
      warnings.push({ key, label: key, code: "unknown_field" });
      continue;
    }
    payload[key] = v;
    if (!CHOICE.has(f.type) || !f.options || v === undefined || v === "") continue;
    const list = Array.isArray(v) ? v : [v];
    const badOne = list.find((x) => typeof x !== "string" || !f.options!.includes(x));
    if (badOne !== undefined) issues.push({ key, label: labels[key] ?? f.label, code: "bad_option", message: String(badOne).slice(0, 80) });
  }
  return { issues, warnings, payload, rows: quoteRowsFromPayload(payload) };
}

export type CreateGate =
  | { kind: "ok" }
  | { kind: "outdated" }
  | { kind: "reject"; error: "items_missing" | "invalid_request"; issues: RequestIssue[] }
  | { kind: "lenient"; codes: IssueCode[] };

/**
 * 접수 관문. 판을 보낸 앱(새 앱)과 AGENT_REQUEST_STRICT=1 은 엄격하게, 판 없는 옛 앱은 경고만.
 * 필수 칸 누락은 여기서 막지 않는다(웹 처리 prepareValues 가 같은 문구로 막는다).
 */
export function createGate(schemaVersion: unknown, issues: RequestIssue[], strictEnv = process.env.AGENT_REQUEST_STRICT === "1"): CreateGate {
  if (schemaVersion !== undefined && schemaVersion !== REQUEST_SCHEMA_VERSION) return { kind: "outdated" };
  const blocking = issues.filter((i) => i.code === "items_missing" || i.code === "bad_option");
  if (!blocking.length) return { kind: "ok" };
  if (schemaVersion === undefined && !strictEnv) return { kind: "lenient", codes: [...new Set(blocking.map((i) => i.code))] };
  return { kind: "reject", error: blocking.some((i) => i.code === "items_missing") ? "items_missing" : "invalid_request", issues: blocking };
}
