import { participation, type JoinFields } from "./request-policy";
import { addBusinessDays } from "./dates";

/**
 * 운영자 홈 "멈춘 요청" (2026-10-29 과업 점검 1·4·5·6). 요청이 사람 손 없이는 앞으로 가지 않는 이유를 하나씩 찾는다.
 * 운영 데이터에서 실제로 본 네 가지: 참여 안내 메일 미발송(16건 전부), 기한 지남·참여 0(6건), 기한이 너무 가까워 자동 안내 보류, 선택 뒤 계약 보고 없음(0006, 30일)
 */
export type StuckRfq = { rfq_no: string; status: string; reply_by: string | null; compared_at: string | null; cro_count: string | null; distributed_at: string | null };
export type StuckInvite = JoinFields & { mailed_at: string | null; sent_at: string };

/**
 * 메일 발송 기록(mailed_at)을 믿을 수 있는 시점. 2026-10-29 점검: 그 전 초대 16건은 Resend 기록상 배달됐는데 mailed_at 이 비어 있다.
 * 그 전 초대는 "메일 미발송"으로 보지 않는다
 */
export const MAIL_TRACKED_FROM = "2026-10-30";
export function mailMissing(i: StuckInvite): boolean {
  return !i.mailed_at && !i.revoked_at && ["sent", "draft"].includes(i.status) && i.sent_at >= MAIL_TRACKED_FROM;
}
export type StuckAward = { awarded_at: string; contract_reported_at: string | null; cro_name: string } | null;
export type Stuck = { kind: "mail" | "no_join" | "too_soon" | "contract"; label: string; action: string; days: number };

/** 계약 보고를 기다리는 날 수. 14일 리마인더(contract_remind_14)와 같은 기준 */
export const CONTRACT_WAIT_DAYS = 14;

const daysSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 864e5));

export function stuckReasons(r: StuckRfq, invites: StuckInvite[], award: StuckAward, today: string, now = Date.now()): Stuck[] {
  const out: Stuck[] = [];
  const open = ["received", "distributed", "quoted"].includes(r.status) && !r.compared_at;
  if (open) {
    const unmailed = invites.filter(mailMissing);
    if (unmailed.length) out.push({ kind: "mail", label: `참여 안내 메일 미발송 ${unmailed.length}곳`, action: "메일 재발송", days: r.distributed_at ? daysSince(r.distributed_at, now) : 0 });
    if (r.reply_by && r.reply_by < today && r.status !== "received" && participation(r.cro_count, invites).joined === 0) {
      out.push({ kind: "no_join", label: "회신 기한 지남 · 참여 0곳", action: "기한 변경 또는 마무리", days: daysSince(`${r.reply_by}T15:00:00Z`, now) });
    }
    // 자동 안내는 기한까지 2영업일이 안 남으면 보내지 않는다 (lib/distribute.ts distributeTo)
    const soon = addBusinessDays(new Date(`${today}T12:00:00Z`), 2).toISOString().slice(0, 10);
    if (r.status === "received" && !invites.length && r.reply_by && r.reply_by < soon) out.push({ kind: "too_soon", label: "회신 기한이 가까워 자동 안내를 보내지 못함", action: "기한 변경", days: 0 });
  }
  if (award && !award.contract_reported_at && ["selected", "contracting"].includes(r.status)) {
    const d = daysSince(award.awarded_at, now);
    if (d >= CONTRACT_WAIT_DAYS) out.push({ kind: "contract", label: `${award.cro_name} 선택 후 ${d}일 · 계약 보고 없음`, action: "기관에 확인", days: d });
  }
  return out;
}
