/**
 * 선정 뒤 계약 보고가 없는 수주에 보내는 단계. cron 이 매일 부른다.
 * 14일·30일: 기관에 보고 요청. 45일: 운영자·의뢰자에게 진행 여부 확인. 단계마다 rfq_events 에 한 번만 남긴다.
 */
export type ReminderStage = "contract_remind_14" | "contract_remind_30" | "contract_asked";

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 864e5);
}

export function reminderStage(awardedAt: string, now = Date.now()): ReminderStage | null {
  const days = daysSince(awardedAt, now);
  if (days >= 45) return "contract_asked";
  if (days >= 30) return "contract_remind_30";
  if (days >= 14) return "contract_remind_14";
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
