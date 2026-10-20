/**
 * 운영자 대행 모드의 규칙 (0019). 화면과 라우트가 같이 쓰는 순수 함수만 둔다 (브라우저에서도 import 한다).
 *
 * - 운영자 관리 기관(managed): 운영자가 직접 등록한 기관. 담당자 계정이 없어 메일 링크는 로그인 없는 /q/{token} 으로 간다.
 * - 대리 입력(entry_source = operator): 운영자가 기관이 보낸 견적서 PDF 를 보고 회신 링크에서 숫자를 옮겨 적은 견적.
 *   기준 문서는 기관 PDF 원본이다. 기관 카탈로그 학습에는 쓰지 않는다.
 * - 계약 진행 상태(contract_status): 체결 보고가 signed 를 만들고, 운영자는 협의 중·미체결을 기록한다.
 */
import { CATS } from "./rfq-schema";
import { normalizeBusinessNo, normalizeCompanyName } from "./request-policy";
import type { ContractStatus, QuoteEntrySource } from "./db-types";

/** 기관 GLP 인증 선택지 (CRO 가입·기관 정보와 같은 값) */
export const GLP_OPTIONS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"] as const;

/* ── 1) 운영자 관리 기관 ── */

export type ManagedOrgInput = {
  name: string;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  categories: string[];
  business_no: string | null;
  glp_certs: string[];
  aaalac: boolean | null;
  other_certs: string | null;
  website: string | null;
};

// lib/auth-links.ts 의 EMAIL_RE 와 같다 (그 파일은 서버 전용이라 여기서 import 하지 않는다)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 운영자 기관 추가 폼 본문 검증. 문제가 있으면 안내 문구를 돌려준다 */
export function parseManagedOrg(raw: unknown): ManagedOrgInput | string {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (k: string, max = 120) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const pick = (k: string, allow: readonly string[]) =>
    Array.isArray(b[k]) ? [...new Set((b[k] as unknown[]).filter((x): x is string => typeof x === "string" && allow.includes(x)))] : [];
  const name = s("name");
  const email = s("contactEmail", 200).toLowerCase();
  const categories = pick("categories", CATS);
  if (!name) return "기관명을 입력해 주세요.";
  if (!email) return "대표 이메일을 입력해 주세요. 요청서와 회신 링크가 이 주소로 갑니다.";
  if (!EMAIL.test(email)) return "대표 이메일 형식을 확인해 주세요.";
  if (!categories.length) return "수행 분야를 하나 이상 선택해 주세요.";
  const bizRaw = s("businessNo", 40);
  if (bizRaw && !normalizeBusinessNo(bizRaw)) return "사업자등록번호는 숫자로 입력해 주세요.";
  return {
    name,
    contact_email: email,
    contact_name: s("contactName") || null,
    contact_phone: s("contactPhone", 40) || null,
    categories,
    business_no: bizRaw || null,
    glp_certs: pick("glpCerts", GLP_OPTIONS),
    aaalac: typeof b.aaalac === "boolean" ? b.aaalac : null,
    other_certs: s("otherCerts", 200) || null,
    website: s("website", 200) || null,
  };
}

/**
 * 같은 기관이 이미 있는지. 사업자번호(숫자만)가 같으면 이름이 달라도 같은 기관이고,
 * 아니면 법인 표기·공백·기호를 뗀 이름으로 본다 ("㈜바이오랩" = "바이오랩 주식회사").
 */
export function findDuplicateOrg<T extends { name: string; business_no?: string | null }>(
  cand: { name: string; business_no?: string | null },
  orgs: T[],
  opts: { strictBusinessNo?: boolean } = {},
): T | null {
  const biz = normalizeBusinessNo(cand.business_no);
  if (biz) {
    const hit = orgs.find((o) => normalizeBusinessNo(o.business_no) === biz);
    if (hit) return hit;
  }
  const key = normalizeCompanyName(cand.name);
  if (!key) return null;
  return (
    orgs.find((o) => {
      if (normalizeCompanyName(o.name) !== key) return false;
      // strictBusinessNo: 양쪽 다 사업자번호가 있는데 다르면 이름이 같아도 다른 회사다 (가입 신청을 남의 기관에 붙이지 않게)
      const other = normalizeBusinessNo(o.business_no);
      return !(opts.strictBusinessNo && biz && other && other !== biz);
    }) ?? null
  );
}

/* ── 2) 메일 링크 ── */

/**
 * 기관에 보내는 메일의 회신 링크 경로.
 * 담당자 계정이 있는 기관은 포털(/cro/r/{초대}), 운영자 관리 기관이나 계정이 없는 기관은 로그인 없는 /q/{token}.
 * /cro 는 로그인이 필요해 계정 없는 기관에는 막힌 길이 된다.
 */
export function replyPath(inv: { id: string; token: string }, org: { managed?: boolean | null; members: number }): string {
  return org.managed || org.members === 0 ? `/q/${inv.token}` : `/cro/r/${inv.id}`;
}

/* ── 3) 대리 입력 ── */

/**
 * 참여 선택 (0023): 참여는 기관 본인만 누른다. 운영자는 기관 대신 참여할 수 없고(join_offer 가 operator_not_allowed 로 거절),
 * 기관이 참여하기 전에는 견적을 대신 입력할 수 없다(save_quote 가 not_joined 로 거절). 화면과 라우트는 DB 보다 먼저 같은 규칙으로 막는다.
 * 기관이 메일로 알린 불참·철회 기록은 운영자가 할 수 있다 (감사 기록을 남긴다).
 */
export function canJoinAs(role: string | null | undefined): boolean {
  return role !== "admin";
}
/** 운영자 대리 입력이 열리는지: 그 초대에 기관 본인의 참여 기록이 있을 때만 */
export function proxyEntryAllowed(inv: { joined_at?: string | null } | { joined: boolean }): boolean {
  return "joined" in inv ? inv.joined : !!inv.joined_at;
}
export const OPERATOR_JOIN_DENIED = "운영자는 기관 대신 참여할 수 없습니다. 기관이 회신 링크나 포털에서 직접 참여하기를 눌러야 합니다. 참여를 권하려면 기관에 전화나 메일로 안내해 주세요.";
export const PROXY_BEFORE_JOIN = "기관이 이 요청에 참여하기 전이라 견적을 대신 입력할 수 없습니다. 기관이 회신 링크에서 참여하기를 누른 뒤 PDF 견적을 옮겨 적어 주세요.";

/** 제출한 세션의 역할로 입력 주체를 정한다. 운영자가 회신 링크로 제출하면 대리 입력이다 */
export function entrySourceFor(role: string | null | undefined): QuoteEntrySource {
  return role === "admin" ? "operator" : "cro";
}

/** 회신 링크를 연 사람이 기관 열람으로 기록될지. 운영자가 대리 입력하려고 연 것은 기관이 읽은 것이 아니다 */
export function marksOpened(role: string | null | undefined): boolean {
  return role !== "admin";
}

/**
 * 회신 링크를 여는 사람에 따른 불러오기 옵션 (lib/quote-load.ts LoadOpts).
 * 운영자는 기관 열람으로 남기지 않고, 회신 마감 전이면 회신 기한·링크 만료와 관계없이 대리 입력한 견적을 고칠 수 있다.
 * 기한 날 늦게 온 PDF 를 옮겨 적거나 오타를 고칠 때 기한 잠금이 막으면 안 된다. 마감 뒤에 받은 PDF 는 운영자가 기한을 늘려 다시 연 뒤 입력한다.
 */
export function loadOptsFor(role: string | null | undefined): { markOpened: boolean; operator: boolean } {
  return { markOpened: marksOpened(role), operator: role === "admin" };
}

/** 비교표의 "견적 구분" 칸 */
export function quoteKindLabel(q: { auto?: boolean | null; entry_source?: string | null }): string {
  if (q.auto) return "기관 확인 전 예비 견적";
  if (q.entry_source === "operator") return "단추 정리 · 기관 PDF 기준";
  return "기관 제출 견적";
}

/* ── 4) 계약 진행 상태 ── */

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  pending: "확인 전",
  negotiating: "협의 중",
  signed: "체결",
  not_signed: "미체결",
};
export const CONTRACT_STATUS_TONE: Record<ContractStatus, string> = {
  pending: "pill--sf",
  negotiating: "pill--tint",
  signed: "pill--ok",
  not_signed: "pill--warn",
};

/** 운영자가 체결 보고 없이 기록할 수 있는 상태. signed 는 체결 보고(report_contract)로만 만든다 */
export const MANUAL_CONTRACT_STATUSES = ["pending", "negotiating", "not_signed"] as const;
export type ManualContractStatus = (typeof MANUAL_CONTRACT_STATUSES)[number];

export function isContractStatus(v: unknown): v is ContractStatus {
  return typeof v === "string" && v in CONTRACT_STATUS_LABEL;
}

/** 운영자 계약 상태 기록 본문 검증 */
export function parseContractStatus(raw: unknown, reported: boolean): { status: ManualContractStatus; note: string } | string {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const status = typeof b.status === "string" ? b.status : "";
  if (!(MANUAL_CONTRACT_STATUSES as readonly string[]).includes(status)) return "계약 상태 값이 올바르지 않습니다. 체결은 체결일과 금액으로 기록해 주세요.";
  if (reported) return "체결이 보고된 수주입니다. 체결 내용을 고치려면 체결 정보를 다시 저장해 주세요.";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  if (status === "not_signed" && !note) return "미체결 사유를 적어 주세요 (예: 의뢰자 일정 보류, 다른 경로로 진행).";
  return { status: status as ManualContractStatus, note };
}

/** 계약 리마인더를 계속 보낼 수주인지. 미체결로 기록된 수주는 더 묻지 않는다 */
export function needsContractReminder(a: { contract_reported_at: string | null; contract_status?: string | null }): boolean {
  return !a.contract_reported_at && a.contract_status !== "not_signed";
}
