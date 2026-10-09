import type { Admin } from "./supabase";
import { anonymizeRequests } from "./account";

/** 개인정보처리방침 3항과 같은 값. 바꾸면 app/privacy 도 같이 고친다 */
export const RETENTION = {
  /** 접속 기록(IP·User-Agent) */
  accessLogDays: 90,
  /** 견적 요청 정보·첨부 */
  requestYears: 3,
  /** 읽은 앱 알림 (처리방침 약속은 아니고 정리 목적) */
  readNotificationDays: 180,
} as const;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString();
}

/**
 * 보존기간이 지난 개인정보를 지운다. 매일 cron 에서 한 번. 멱등.
 * 1) 90일 지난 접속 기록 비우기
 * 2) 3년 지난 요청서 익명화 + 미선정 첨부 삭제 (한 번에 최대 200건)
 * 3) 180일 지난 읽은 알림 삭제
 */
export async function runRetention(sb: Admin): Promise<{ accessLogs: number; requests: number; files: number; notifications: number }> {
  const out = { accessLogs: 0, requests: 0, files: 0, notifications: 0 };

  const { data: logs } = await sb
    .from("rfq_requests")
    .select("id")
    .lt("created_at", daysAgo(RETENTION.accessLogDays))
    .or("ip.not.is.null,user_agent.not.is.null")
    .limit(500);
  if (logs?.length) {
    const { error } = await sb.from("rfq_requests").update({ ip: null, user_agent: null }).in("id", logs.map((r) => r.id));
    if (!error) out.accessLogs = logs.length;
  }

  const { data: old } = await sb
    .from("rfq_requests")
    .select("id")
    .lt("created_at", daysAgo(RETENTION.requestYears * 365))
    .is("anonymized_at", null)
    .limit(200);
  if (old?.length) {
    const r = await anonymizeRequests(sb, old.map((x) => x.id));
    out.requests = r.anonymized;
    out.files = r.filesDeleted;
  }

  const { data: read } = await sb.from("notifications").select("id").lt("read_at", daysAgo(RETENTION.readNotificationDays)).limit(1000);
  if (read?.length) {
    const { error } = await sb.from("notifications").delete().in("id", read.map((n) => n.id));
    if (!error) out.notifications = read.length;
  }
  return out;
}
