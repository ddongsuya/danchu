import type { Admin } from "./supabase";
import { anonymizeRequests } from "./account";
import { EARLY_DELETE_AFTER } from "./early";

/** 개인정보처리방침 3항과 같은 값. 바꾸면 app/privacy 도 같이 고친다 */
export const RETENTION = {
  /** 접속 기록(IP·User-Agent) */
  accessLogDays: 90,
  /** 견적 요청 정보·첨부 */
  requestYears: 3,
  /** 견적 에이전트 이용 동의 기록: 철회하거나 탈퇴한 날부터 */
  agentConsentYears: 3,
  /** 읽은 앱 알림 (처리방침 약속은 아니고 정리 목적) */
  readNotificationDays: 180,
  /** 에이전트가 바로 실행한 기록을 되돌릴 수 있는 기간. 지나면 바꾸기 전 값을 비운다 (0050) */
  agentUndoDays: 7,
} as const;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString();
}

/**
 * 보존기간이 지난 개인정보를 지운다. 매일 cron 에서 한 번. 멱등.
 * 1) 90일 지난 접속 기록 비우기 (요청 접수 IP·브라우저, 기관 참여 기록의 IP·브라우저)
 * 2) 3년 지난 요청서 익명화 + 미선정 첨부 삭제 (한 번에 최대 200건)
 * 3) 180일 지난 읽은 알림 삭제
 * 4) 시범 운영 시작 6개월 뒤(2027-12-01)부터 사전예약 삭제 (0030)
 * 5) 90일 지난 문자 알림 기록 삭제 (0033)
 * 6) 철회·탈퇴한 지 3년 지난 견적 에이전트 동의 기록 삭제 (0049)
 * 7) 7일 지난 에이전트 실행 기록의 되돌리기 값(before) 비우기 (0050, lib/agent-actions.ts UNDO_DAYS)
 */
export async function runRetention(sb: Admin, now = new Date()): Promise<{ accessLogs: number; requests: number; files: number; notifications: number; early: number; sms: number; agentConsents: number; agentUndo: number }> {
  const out = { accessLogs: 0, requests: 0, files: 0, notifications: 0, early: 0, sms: 0, agentConsents: 0, agentUndo: 0 };

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

  // 참여 기록의 IP·브라우저 (0023). 시각·경로·누른 사람·조건 판은 남기고 이 둘만 비운다.
  // DB 트리거(rfq_invites_guard_join)는 참여한 지 90일이 지난 기록에서만 비우기를 허용한다
  const { data: joins } = await sb
    .from("rfq_invites")
    .select("id")
    .lt("joined_at", daysAgo(RETENTION.accessLogDays))
    .or("join_ip.not.is.null,join_ua.not.is.null")
    .limit(500);
  if (joins?.length) {
    const { error } = await sb.from("rfq_invites").update({ join_ip: null, join_ua: null }).in("id", joins.map((r) => r.id));
    if (!error) out.accessLogs += joins.length;
    else console.error("retention join_ip", error.message);
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

  if (now.toISOString().slice(0, 10) >= EARLY_DELETE_AFTER) {
    const { data: early, error } = await sb.from("early_signups").delete().not("id", "is", null).select("id");
    if (!error) out.early = early?.length ?? 0;
    else console.error("retention early", error.message);
  }

  const { data: sms, error: smsError } = await sb.from("sms_log").delete().lt("created_at", daysAgo(RETENTION.accessLogDays)).select("id");
  if (!smsError) out.sms = sms?.length ?? 0;
  else console.error("retention sms", smsError.message);

  const { data: consents, error: consentError } = await sb.from("agent_consents").delete().lt("revoked_at", daysAgo(RETENTION.agentConsentYears * 365)).select("user_id");
  if (!consentError) out.agentConsents = consents?.length ?? 0;
  else console.error("retention agent consents", consentError.message);

  // 되돌리기 기간이 지난 실행 기록은 바꾸기 전 값(고객 이름 등)을 비운다. 기록 줄은 남는다
  const { data: undo, error: undoError } = await sb.from("agent_action_log").update({ before: null }).lt("created_at", daysAgo(RETENTION.agentUndoDays)).not("before", "is", null).select("id");
  if (!undoError) out.agentUndo = undo?.length ?? 0;
  else console.error("retention agent undo", undoError.message);
  return out;
}
