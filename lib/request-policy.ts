/**
 * 요청 정보 공개와 배포 정책. 화면 문구가 아니라 여기의 함수가 접근을 정한다.
 *
 * - 회사명·담당자 연락처: 모든 요청에서 의뢰자가 그 기관을 선정할 때까지 기관에 보이지 않는다 (identityVisible).
 *   CDA 체결 확인도 신원을 열지 않는다 (약관 제4조4항·제9조2항). 기관이 선정 전에 의뢰자에게 직접 연락할 길을 없애,
 *   견적 비교와 선정이 단추 안에서 끝나게 하기 위한 장치다. 첨부 파일명도 회사명이 들어 있을 수 있어 선정 전에는 가린다.
 * - 첨부: '일반' 요청은 초대받은 기관에 공개, CDA 요청은 체결 확인 후 공개 (confidentialAccess). 신원 공개와 독립이다.
 */

/** Display copy is not an access policy. Unknown nonempty legacy values fail closed. */
export function needsCda(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && value !== "일반";
}

/** 첨부·상세 자료 공개 여부: 일반 요청이거나 이 기관의 CDA 체결이 확인됨 */
export function confidentialAccess(value: unknown, signedAt?: string | null): boolean {
  return !needsCda(value) || !!signedAt;
}

/** 회사명·연락처·원본 첨부 파일명 공개 여부: 이 기관이 선정됐을 때만. 기밀 등급·CDA 체결과 무관하게 선정 전에는 비공개 */
export function identityVisible(opts: { awarded: boolean }): boolean {
  return opts.awarded;
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

/** 의뢰자가 고르는 참여 자리 수·기밀 등급 (rfq-schema 의 선택지와 같아야 한다) */
export const CRO_COUNT_OPTIONS = ["3곳", "5곳", "전체"] as const;
export const CONFIDENTIALITY_OPTIONS = ["일반", "CDA 필요 (단추 표준 CDA)", "자체 CDA 사용"] as const;

/**
 * 참여 자리 수 (0023). 3곳·5곳·전체는 "보낼 곳"이 아니라 "참여 자리"다. 안내는 분야가 맞는 기관 모두에게 간다.
 * 전체면 무한대. DB 함수 join_offer·offer_seat_state 와 같은 규칙
 */
export function invitationLimit(value: string | null | undefined): number {
  return value === "전체" ? Number.POSITIVE_INFINITY : value === "5곳" ? 5 : 3;
}

/** 남은 참여 자리 (자리 수 - 이미 쓴 자리). 쓴 자리는 occupiesSeat 로 센 수 */
export function remainingInvites(value: string | null | undefined, existing: number): number {
  return Math.max(0, invitationLimit(value) - existing);
}

/**
 * 상태값만으로 본 "살아 있는 초대"인지 (불참·철회(declined)·만료가 아님). 참여 여부를 모르므로 자리 계산에는 occupiesSeat 를 쓴다 (0023)
 */
export function countsTowardLimit(status: string): boolean {
  return status !== "declined" && status !== "expired";
}

/* ── 참여 (0023) ── */

/**
 * 기관이 참여할 때 보여 주고 참여 기록(rfq_invites.join_terms_version)에 남기는 이용 조건 판.
 * 판 이름은 여기 한 곳에서만 정한다. 참여 화면(components/cro/JoinPanel.tsx), 참여 라우트(app/api/quote/[token]/join, 화면의 판과 다르면 409),
 * 참여 전 요약(lib/quote-load.ts), 기관 이용 조건 문서(app/for-cro/page.tsx 의 #cro-terms)가 이 값을 그대로 쓴다.
 * 시범운영 중 이 판으로 참여한 요청은 끝까지 무료다. 조건 문구(for-cro 이용 조건, 약관 제4조·제5조, JOIN_CONSENT)를 바꾸면 판 이름을 바꾼다.
 * 유료 전환 때는 유료 조건 판을 새로 만들고, 기관 서면 합의와 그 판으로 누른 참여를 함께 요구한다 (설계 4절 5번).
 * 판 이력
 * - pilot-2026-10-20: 첫 판. 참여 안내와 참여, 참여한 요청에 제출한 견적만 청구 단위, 시범 중 참여한 요청은 끝까지 무료 (약관 v1.1 제2조·제4조·제5조와 함께)
 *   (개발 중 쓰던 pilot-2026-10 은 운영 배포(main) 전에 바꿨다)
 * - pilot-2026-10-20b: 참여 기록에 IP·브라우저를 남기고 3개월 뒤 지운다는 것, 재제출·금액 수정 때 청구 월과 구간을 정하는 규칙(대표 결정 5 "상향 수정 재청구도 조건 문서에")을 더했다.
 *   운영 배포(main) 전에 바꿨으므로 앞 판으로 참여한 운영 기록은 없다
 * 판 이름이 pilot- 으로 시작하면 청구 함수(0023 billing_lines·billing_awards)가 시범 참여로 보고 청구하지 않는다. 유료 조건 판은 pilot- 이 아닌 이름으로 만든다.
 */
export const CRO_TERMS_VERSION = "pilot-2026-10-20b";

/** 참여 버튼 옆에 그대로 보여 주는 동의 문장 (설계 규칙표 "참여 버튼 문구"). 이 문장을 보고 누른 것이 참여 기록이다 */
export const JOIN_CONSENT = "이 요청에 참여합니다. 요청서 내용은 이 견적에만 쓰고 외부에 알리지 않습니다. 견적을 제출하면 그 1건이 이용 조건에 따른 청구 단위가 됩니다(시범 운영 중 무료). 제출 전에는 언제든 철회할 수 있고, 철회하면 청구하지 않습니다.";

/** 참여 단계 판정에 쓰는 초대 열 */
export type JoinFields = { status: string; joined_at?: string | null; withdrawn_at?: string | null; revoked_at?: string | null };

/** 기관 본인(또는 0023 전 작성 중·제출, legacy)이 참여한 초대인지 */
export function isJoined(inv: Pick<JoinFields, "joined_at">): boolean {
  return !!inv.joined_at;
}

/**
 * 자리에 세는 초대인지: 참여·작성 중·제출 (철회·불참·취소·만료는 세지 않는다).
 * offer_seat_state 의 used 와 같은 규칙. 0023 전환으로 draft·submitted 는 모두 joined_at 이 있지만, 빠진 행도 같게 센다
 */
export function occupiesSeat(inv: JoinFields): boolean {
  if (inv.revoked_at || inv.withdrawn_at) return false;
  if (!["sent", "draft", "submitted"].includes(inv.status)) return false;
  return !!inv.joined_at || inv.status === "draft" || inv.status === "submitted";
}

/**
 * 초대 목록으로 본 자리 사용 (화면 표시용, 지명 예약 제외). cap 이 null 이면 자리 제한 없음(전체).
 * 참여를 정하는 것은 DB 의 join_offer 다. 이 함수는 "참여 2/3곳" 같은 표시와 운영자 자리 수 변경 검사에 쓴다
 */
export function seatUsage(croCount: string | null | undefined, invites: JoinFields[]): { cap: number | null; used: number; open: number | null } {
  const limit = invitationLimit(croCount);
  const cap = Number.isFinite(limit) ? limit : null;
  const used = invites.filter(occupiesSeat).length;
  return { cap, used, open: cap == null ? null : Math.max(0, cap - used) };
}

/** 자리 현황 (offer_seat_state 결과, lib/rpc.ts SeatState 와 같은 모양). cap·open 이 null 이면 자리 제한 없음(전체) */
export type SeatInfo = { cap: number | null; used: number; reserved: number; open: number | null; join_by: string | null };

/**
 * 기관에게 보여 주는 자리 표시: "자리 3곳 중 2곳 남음" · "자리 제한 없음".
 * 참여 전 기관에는 설계 규칙표의 "자리 수와 남은 자리"만 보인다. 참여한 기관 수(전체 요청)와 지명 기관 수는 적지 않는다
 */
export function seatsLabel(s: SeatInfo | null | undefined): string {
  if (!s) return "-";
  if (s.cap == null) return "자리 제한 없음";
  const open = s.open ?? Math.max(0, s.cap - s.used - s.reserved);
  const reserved = s.reserved > 0 ? " (일부 자리는 참여 결정 기한까지 지명 기관 몫)" : "";
  return open > 0 ? `자리 ${s.cap}곳 중 ${open}곳 남음${reserved}` : `자리 ${s.cap}곳 모두 찼습니다${reserved}`;
}

/** 운영자 화면용 자리 표시: 참여 수와 지명 기관 몫 수까지 적는다 */
export function seatsDetailLabel(s: SeatInfo | null | undefined): string {
  if (!s) return "-";
  if (s.cap == null) return `자리 제한 없음 · 지금 ${s.used}곳 참여`;
  const open = s.open ?? Math.max(0, s.cap - s.used - s.reserved);
  const reserved = s.reserved > 0 ? ` (지명 기관 몫 ${s.reserved}곳 별도)` : "";
  return open > 0 ? `자리 ${s.cap}곳 중 ${open}곳 남음${reserved}` : `자리 ${s.cap}곳 모두 찼습니다${reserved}`;
}

/**
 * 참여 결정 기한: 안내한 날부터 2영업일, 회신 기한이 5영업일 안이면 1영업일 (설계 규칙표 "기한"). 평일 기준, 공휴일 미반영.
 * from·replyBy 는 서울 날짜(YYYY-MM-DD). 그날 서울 자정 직전 시각(ISO)을 돌려준다. 접수 라우트가 rfq_requests.join_by 에 쓴다
 */
export function joinDeadline(from: string, replyBy: string | null | undefined): string {
  const addBiz = (ymd: string, n: number) => {
    const d = new Date(`${ymd}T12:00:00Z`);
    let k = 0;
    while (k < n) {
      d.setUTCDate(d.getUTCDate() + 1);
      const w = d.getUTCDay();
      if (w !== 0 && w !== 6) k++;
    }
    return d.toISOString().slice(0, 10);
  };
  const short = !!replyBy && replyBy <= addBiz(from, 5);
  let day = addBiz(from, short ? 1 : 2);
  // 회신 기한을 넘기지 않는다
  if (replyBy && day > replyBy) day = replyBy;
  return new Date(`${day}T23:59:59+09:00`).toISOString();
}

/** 평일 기준 n 영업일 전 날짜 (YYYY-MM-DD, 토·일 제외, 공휴일 미반영). DB 의 business_days_before 와 같은 규칙 */
export function businessDaysBefore(ymd: string, n: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  let k = Math.max(0, n);
  while (k > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) k--;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * 늦은 참여가 아직 가능한지 (join_offer 의 cutoff 와 같은 규칙): 회신 기한이 지나지 않았고,
 * 참여 결정 기한 안이거나 회신 기한 3영업일 전까지. today 는 서울 날짜(YYYY-MM-DD)
 */
export function lateJoinOpen(replyBy: string | null | undefined, joinBy: string | null | undefined, today: string, now = Date.now()): boolean {
  if (!replyBy) return true;
  if (today > replyBy) return false;
  if (joinBy && now <= new Date(joinBy).getTime()) return true;
  return today <= businessDaysBefore(replyBy, 3);
}

/** 자리 계산에 쓰는 초대 열 (offer_seat_state 와 같은 규칙으로 센다) */
export type SeatInvite = JoinFields & { id?: string; source?: string | null };

/**
 * 초대 목록으로 본 자리 현황 (지명 예약 포함). DB 함수 offer_seat_state 와 같은 규칙:
 * reserved 는 참여 결정 기한 전, 아직 결정하지 않은 지명 기관 수. open 은 일반 기관이 지금 참여할 수 있는 자리 수(전체면 null)
 */
export function seatState(croCount: string | null | undefined, joinBy: string | null | undefined, invites: SeatInvite[], now = Date.now()): SeatInfo {
  const { cap, used } = seatUsage(croCount, invites);
  const inWindow = !!joinBy && now < new Date(joinBy).getTime();
  const reserved = inWindow ? invites.filter(nomineePending).length : 0;
  return { cap, used, reserved, open: cap == null ? null : Math.max(0, cap - used - reserved), join_by: joinBy ?? null };
}

/** 아직 결정하지 않은 지명 기관 초대 (offer_seat_state 의 nominees_pending) */
export function nomineePending(i: SeatInvite): boolean {
  return i.source === "nominated" && !i.joined_at && i.status === "sent" && !i.revoked_at;
}

/** 참여를 아직 결정하지 않았고 지금 참여할 수 있는 안내 (빈 자리 재안내 대상) */
export function undecidedOffer(i: SeatInvite & { expires_at?: string | null }, now = Date.now()): boolean {
  return i.status === "sent" && !i.joined_at && !i.revoked_at && !i.withdrawn_at && (!i.expires_at || new Date(i.expires_at).getTime() > now);
}

/**
 * 자리를 비운 초대 (빈 자리 재안내의 근거). 참여 뒤 철회·취소, 지명 기관의 불참, 참여 결정 기한까지 결정하지 않은 지명 기관.
 * 같은 초대는 한 번만 센다 (cron 이 이미 본 id 를 기억한다)
 */
export function seatReleased(i: SeatInvite, joinBy: string | null | undefined, now = Date.now()): boolean {
  if (i.joined_at) return !!(i.withdrawn_at || i.revoked_at);
  if (i.source !== "nominated") return false;
  // 지명 기관 몫: 불참·취소·만료로 결정이 끝났거나, 결정 기한이 지났다
  if (i.revoked_at || i.status === "declined" || i.status === "expired") return true;
  return nomineePending(i) && !!joinBy && now >= new Date(joinBy).getTime();
}

/**
 * 참여가 모자란지 (설계 규칙표 "참여가 모자랄 때"). 자리 3곳이면 참여 2곳 미만, 그 밖에는 자리의 절반 미만.
 * 전체(자리 제한 없음)는 안내한 기관 수의 절반 미만이거나 2곳 미만일 때
 */
export function lowParticipation(croCount: string | null | undefined, joined: number, offered: number): boolean {
  const limit = invitationLimit(croCount);
  if (limit === 3) return joined < 2;
  if (Number.isFinite(limit)) return joined * 2 < limit;
  return joined < 2 || joined * 2 < offered;
}

/** 회신 링크 만료 시각: 기한 날 자정(서울) + 7일 */
export function inviteExpiresAt(replyBy: string): Date {
  const d = new Date(`${replyBy}T23:59:59+09:00`);
  d.setDate(d.getDate() + 7);
  return d;
}

/** 전달 출처. matched: 분야 자동 매칭 · nominated: 의뢰자 지명 · manual: 운영자 수동 */
export type InviteSource = "matched" | "nominated" | "manual";

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

/**
 * 기관명 중복 판정에 쓰는 회사명 정규화: 공백·법인 표기(주식회사, (주), ㈜, 유한회사 등)·기호를 떼고 소문자로.
 * "㈜바이오벤처" 와 "바이오벤처 주식회사" 를 같은 회사로 본다
 */
export function normalizeCompanyName(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .replace(/주식회사|유한회사|유한책임회사|합자회사|합명회사|\(주\)|㈜|\(유\)|co\.,?\s*ltd\.?|inc\.?|corp\.?|ltd\.?/g, "")
    .replace(/[\s·.,()\-_]/g, "");
}

/** 의뢰자가 지명한 기관 이름을 정리한다: 문자열만, 중복 제거, 한도(기관 수) 안에서, 승인된 기관 이름에 있는 것만 */
export function cleanNominees(raw: unknown, croCount: string | null | undefined, approvedNames: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const approved = new Map(approvedNames.map((n) => [n.trim().toLowerCase(), n]));
  const limit = Math.min(5, invitationLimit(croCount));
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const hit = approved.get(v.trim().toLowerCase());
    if (!hit || out.includes(hit)) continue;
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/** "보류"로 마무리한 요청을 의뢰자가 다시 열 수 있는 기간 (일) */
export const REOPEN_DAYS = 90;
