/**
 * 의뢰자 홈 "확인 필요" 묶음 (2026-11-27 시안 검토판 r-home). 지금 의뢰자가 해야 할 일만 고른다.
 * - 기관이 계약 체결을 보고했고 의뢰자 확인을 기다리는 요청 (보고 7일 뒤 자동 확정)
 * - 회신 기한이 지났는데 참여한 기관이 없는 요청 (기한 연장은 문의로)
 * 둘 다 없으면 묶음을 통째로 숨긴다.
 */
import { noJoinPastDue } from "./request-story";

export type CheckReq = { rfq_no: string; substance: string; status: string; reply_by: string | null; compared_at: string | null; joined: number; sent: number; submitted: number; selected_quote_id?: string | null };
export type CheckAward = { rfq_no: string; cro_name: string; contract_status: string; contract_reported_at: string | null; contract_confirm_due_at: string | null; confirmed: boolean; disputed: boolean };
export type HomeCheck = { no: string; title: string; line: string; pill: string; tone: "wait" | "late"; href: string; action: string; due: string };

const autoDue = (a: CheckAward) => a.contract_confirm_due_at ?? new Date(new Date(a.contract_reported_at!).getTime() + 7 * 864e5).toISOString();

export function homeChecks(list: CheckReq[], awards: CheckAward[], today: string, md: (d: string) => string): HomeCheck[] {
  const out: HomeCheck[] = [];
  for (const r of list) {
    const title = `${r.rfq_no} · ${r.substance}`;
    const a = awards.find((x) => x.rfq_no === r.rfq_no);
    if (a && a.contract_status === "signed" && a.contract_reported_at && !a.confirmed && !a.disputed && ["selected", "contracting"].includes(r.status)) {
      const due = autoDue(a);
      out.push({ no: r.rfq_no, title, line: `${a.cro_name} 계약 보고 · ${md(due)} 자동 확정`, pill: "확인 대기", tone: "wait", href: `/app/r/${r.rfq_no}#contract-confirm`, action: "계약 내용 확인", due });
    } else if (noJoinPastDue(r, today)) {
      out.push({ no: r.rfq_no, title, line: `회신 기한 ${md(r.reply_by!)} · 참여 ${r.joined}곳`, pill: "기한 지남", tone: "late", href: `/app/support?rfq=${r.rfq_no}&type=${encodeURIComponent("일정")}`, action: "기한 연장 요청", due: r.reply_by! });
    }
  }
  return out.sort((x, y) => x.due.localeCompare(y.due));
}
