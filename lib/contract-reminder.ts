/**
 * 선정 뒤 계약 보고가 없는 수주에 보내는 단계. cron 이 매일 부른다.
 * 기관 계약 보고 기한은 선정 후 14일(2026-11-24 사용자 결정). 13일째(기한 하루 전)에 한 번 알린다.
 * 30일: 기한이 지난 뒤 다시 요청. 45일: 운영자·의뢰자에게 진행 여부 확인. 단계마다 rfq_events 에 한 번만 남긴다.
 * 첫 단계의 이력 이름은 예전 그대로 contract_remind_14 로 둔다. 바꾸면 이미 14일 알림을 받은 수주가 같은 알림을 또 받는다.
 */
export type ReminderStage = "contract_remind_14" | "contract_remind_30" | "contract_asked";

/** 기관 계약 보고 기한: 선정 후 며칠 */
export const CONTRACT_REPORT_DAYS = 14;

/** 기관 계약 보고 기한(선정 시각 + 14일) */
export function contractReportDue(awardedAt: string): string {
  return new Date(new Date(awardedAt).getTime() + CONTRACT_REPORT_DAYS * 864e5).toISOString();
}

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 864e5);
}

export function reminderStage(awardedAt: string, now = Date.now()): ReminderStage | null {
  const days = daysSince(awardedAt, now);
  if (days >= 45) return "contract_asked";
  if (days >= 30) return "contract_remind_30";
  if (days >= CONTRACT_REPORT_DAYS - 1) return "contract_remind_14";
  return null;
}

/**
 * 의뢰자 계약 확인 기한 하루 전 알림(2026-11-24 사용자 결정: 기한 하루 전에 한 번).
 * 예약 작업은 하루 한 번 돈다. 기한이 지금부터 24시간 안에 있으면 이번이 기한 전 마지막 실행이라 이때 한 번 보낸다.
 */
export function confirmDueSoon(dueAt: string | null, now = Date.now()): boolean {
  if (!dueAt) return false;
  const left = new Date(dueAt).getTime() - now;
  return left > 0 && left <= 864e5;
}
