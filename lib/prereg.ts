import { EARLY_OPEN_DATE } from "./early";

/**
 * 사전예약 모드 (2026-11-06 사용자 결정).
 * - 시범 운영 시작(2027-06-01 00:00 KST) 전에는 새로 가입한 계정이 로그인하면 "지금은 사전예약 기간이에요" 대기 화면만 본다.
 *   요청 보내기·견적 내기 같은 실제 기능은 열리지 않는다.
 * - 이 기준 시각 전에 만든 계정(개발·운영자·테스트 계정)은 지금처럼 모든 기능을 쓴다.
 * - 운영자 계정은 언제나 예외. 나중에 테스트 계정을 더 열려면 PREREG_EXEMPT_EMAILS(쉼표로 구분)에 넣는다.
 * - 시범 운영 날짜가 지나면 아무것도 바꾸지 않아도 모든 계정이 열린다.
 */
export const PREREG_EXEMPT_BEFORE = "2026-11-06T06:00:00Z";
export const PILOT_START = `${EARLY_OPEN_DATE}T00:00:00+09:00`;

/** 지금이 사전예약 기간인가 (시범 운영 시작 전) */
export function preregActive(now: Date = new Date()): boolean {
  return now.getTime() < new Date(PILOT_START).getTime();
}

/** 시범 운영까지 남은 날 (한국 날짜 기준, 당일이면 0) */
export function daysToPilot(now: Date = new Date()): number {
  const today = new Date(now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) + "T00:00:00+09:00");
  return Math.max(0, Math.round((new Date(PILOT_START).getTime() - today.getTime()) / 86400000));
}

function exemptEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.PREREG_EXEMPT_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export type PreregViewer = { role: string; email: string; created_at?: string | null };

/** 이 계정이 사전예약 모드로 보이는가 */
export function inPrereg(p: PreregViewer | null | undefined, now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): boolean {
  if (!p || !preregActive(now)) return false;
  if (p.role === "admin") return false;
  if (exemptEmails(env).includes(p.email.toLowerCase())) return false;
  // 만든 시각을 모르면 막지 않는다 (옛 계정일 가능성이 크다)
  if (!p.created_at) return false;
  return new Date(p.created_at).getTime() >= new Date(PREREG_EXEMPT_BEFORE).getTime();
}

/** 사전예약 모드에서도 열리는 화면 (대기 화면 = 역할 홈, 프로필, 기관 정보) */
export function preregAllowedPath(path: string): boolean {
  return /^\/(app|cro)\/?$/.test(path) || /^\/(app|cro)\/profile(\/|$)/.test(path) || /^\/cro\/org(\/|$)/.test(path);
}

/** 요청 보내기를 막을 때 보여 줄 문장 */
export const PREREG_BLOCKED = "지금은 사전예약 기간이에요. 2027년 6월 1일부터 견적을 요청할 수 있어요.";
