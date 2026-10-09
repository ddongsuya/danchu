/**
 * 요청 정보 공개와 배포 정책. 화면 문구가 아니라 여기의 함수가 접근을 정한다.
 *
 * - 회사명·담당자 연락처: 모든 요청에서 선정(또는 해당 기관의 CDA 체결 확인) 전까지 기관에 보이지 않는다.
 *   기관이 선정 전에 의뢰자에게 직접 연락할 길을 없애, 견적 비교와 선정이 단추 안에서 끝나게 하기 위한 장치다.
 * - 첨부: '일반' 요청은 초대받은 기관에 공개, CDA 요청은 체결 확인 후 공개 (confidentialAccess).
 */

/** Display copy is not an access policy. Unknown nonempty legacy values fail closed. */
export function needsCda(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && value !== "일반";
}

/** 첨부·상세 자료 공개 여부: 일반 요청이거나 이 기관의 CDA 체결이 확인됨 */
export function confidentialAccess(value: unknown, signedAt?: string | null): boolean {
  return !needsCda(value) || !!signedAt;
}

/** 회사명·연락처 공개 여부: 이 기관이 선정됐거나 CDA 체결이 확인됨. 기밀 등급과 무관하게 선정 전에는 비공개 */
export function identityVisible(opts: { awarded: boolean; signedAt?: string | null }): boolean {
  return opts.awarded || !!opts.signedAt;
}

/**
 * 선정 전 기관에 보여 줄 첨부 이름. 원본 파일명("㈜바이오벤처_시험계획서.pdf")에 회사명이 들어 있으면
 * 회사명 익명화가 뚫리므로 종류와 크기만 보여 준다
 */
export function anonymousFileLabel(index: number, fileName: string, sizeBytes: number): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toUpperCase().slice(0, 6) : "파일";
  const mb = sizeBytes / 1024 / 1024;
  const size = mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(sizeBytes / 1024))}KB`;
  return `첨부 ${index + 1} (${ext}, ${size})`;
}

/** 사업자등록번호 정규화: 숫자만. DB 의 cro_orgs.business_no_norm 과 같은 규칙 */
export function normalizeBusinessNo(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/[^0-9]/g, "");
  return d || null;
}

/** 선정 전 기관에 보여 줄 의뢰자 표시명 */
export function maskedClientLabel(orgType: string | null | undefined): string {
  return `${orgType || "의뢰기관"} (선정 시 공개)`;
}

/** 의뢰자가 고르는 전달 기관 수·기밀 등급 (rfq-schema 의 선택지와 같아야 한다) */
export const CRO_COUNT_OPTIONS = ["3곳", "5곳", "전체"] as const;
export const CONFIDENTIALITY_OPTIONS = ["일반", "CDA 필요 (단추 표준 CDA)", "자체 CDA 사용"] as const;

export function invitationLimit(value: string | null | undefined): number {
  return value === "전체" ? Number.POSITIVE_INFINITY : value === "5곳" ? 5 : 3;
}

export function remainingInvites(value: string | null | undefined, existing: number): number {
  return Math.max(0, invitationLimit(value) - existing);
}

/** 초대 한도에 세는 초대인지. 회신하지 않음·만료는 자리를 비운 것이다 (DB 트리거와 같은 규칙, 0012) */
export function countsTowardLimit(status: string): boolean {
  return status !== "declined" && status !== "expired";
}

/** 회신 링크 만료 시각: 기한 날 자정(서울) + 7일 */
export function inviteExpiresAt(replyBy: string): Date {
  const d = new Date(`${replyBy}T23:59:59+09:00`);
  d.setDate(d.getDate() + 7);
  return d;
}

/** 전달 출처. matched: 분야 자동 매칭 · nominated: 의뢰자 지명 · manual: 운영자 수동 */
export type InviteSource = "matched" | "nominated" | "manual";

/** 기관의 월 전달 한도 안인지. 한도가 없으면(null) 항상 가능 */
export function withinMonthlyCap(cap: number | null | undefined, usedThisMonth: number): boolean {
  return cap == null || cap <= 0 || usedThisMonth < cap;
}

/** 요청 성격 선택지. 셋 다 정상 요청이며 기관에 그대로 전달한다. 전달 제외 사유가 아니다 */
export const INTENTS = ["발주 예정", "비교 견적", "예산 검토"] as const;
export type Intent = (typeof INTENTS)[number];
export function isIntent(v: unknown): v is Intent {
  return typeof v === "string" && (INTENTS as readonly string[]).includes(v);
}

/** 서울 기준 이번 달 [시작, 다음 달 시작) ISO 범위 */
export function seoulMonthRange(d = new Date()): { from: string; to: string } {
  const ymd = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const [y, m] = ymd.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${y}-${pad(m)}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { from, to };
}
