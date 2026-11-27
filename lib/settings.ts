import { earlyPhone } from "./early";

/** 알림 스위치 저장 실패 문구 (시안 r-set-noti~fail): 무엇을 못 했는지 + 원래대로 둔 상태 */
export function notiFailText(label: string, to: boolean): string {
  const c = label.charCodeAt(label.length - 1);
  const eul = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 0 ? "를" : "을";
  return `${label}${eul} ${to ? "켜지" : "끄지"} 못했어요. ${to ? "꺼짐" : "켜짐"}으로 되돌렸어요.`;
}

/** 담당자 정보의 휴대전화 칸 (시안 r-set-company~ferr). 비우면 괜찮고, 적었으면 휴대전화 번호여야 한다 */
export function phoneError(raw: string): string | null {
  return !raw.trim() || earlyPhone(raw) ? null : "휴대전화 번호를 확인해 주세요.";
}
