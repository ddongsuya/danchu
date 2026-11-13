import { EARLY_DONE_LINE, EARLY_KIND_LABEL, EARLY_ROLE_LABEL, type EarlyInput } from "./early";
import { esc, mailWrap, sendMail } from "./mail";
import { operatorReplyTo } from "./notify";

type EarlyMailInput = Pick<EarlyInput, "role" | "name" | "org" | "kinds">;

/**
 * 사전예약 완료 메일 (2026-11-13). 의뢰자·시험 기관 각각, 예약한 사람에게 한 번 (early_signups.done_mail_at, 0043).
 * 본문은 완료 문자와 같은 문장 + 명사 라벨 정보표. 이용을 권하는 문장·버튼·링크는 넣지 않는다 (넣으면 광고성 정보).
 * 회신은 운영자에게 간다 (예약 변경·취소).
 */
export function earlyDoneMail(v: EarlyMailInput, at: Date = new Date()): { subject: string; html: string } {
  const day = at.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
  const rows: [string, string][] = [
    ["예약자", v.name],
    ...(v.role === "cro" && v.org ? ([["기관명", v.org]] as [string, string][]) : []),
    ["예약일", day],
    ["시험 분야", v.kinds.map((k) => EARLY_KIND_LABEL[k]).join(", ")],
    ["시범 운영", "2027년 6월 1일 ~ 12월 31일, 무료"],
    ["정식 운영", "2028년 1월 1일"],
    ["안내 문자", "시범 운영 개시"],
    ["변경·취소", "이 메일로 회신"],
  ];
  const td = "border-top:1px solid #e3e3dd;padding:8px 0;vertical-align:top";
  const table = rows
    .map(([k, val]) => `<tr><td style="${td};color:#61615c;width:96px;padding-right:12px">${esc(k)}</td><td style="${td}">${esc(val)}</td></tr>`)
    .join("");
  return {
    subject: "[단추] 사전예약 완료",
    html: mailWrap(`
      <h2 style="margin:0 0 12px;font-size:20px">${esc(EARLY_ROLE_LABEL[v.role])} 사전예약 완료</h2>
      <p style="margin:0 0 16px">${esc(EARLY_DONE_LINE)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">${table}</table>`),
  };
}

/** 보내기. 실패해도 던지지 않는다 (sendMail 이 기록) */
export async function sendEarlyDoneMail(to: string, v: EarlyMailInput): Promise<boolean> {
  return sendMail({ to, ...earlyDoneMail(v), replyTo: operatorReplyTo() });
}
