/**
 * 선정 전 연락처 가리기 (0034 우회 계약 방지, 2026-11-03 대표 요구 3).
 * 단추는 선정하는 순간 양쪽 연락처를 연다. 그 전에 자유 입력란(견적 비고, 요청서 추가 내용)에 적힌
 * 이메일·전화번호·링크·메신저 아이디는 상대 화면에서 가린다. 원문은 그대로 저장되고, 선정 뒤에는 그대로 보인다.
 */

export const CONTACT_MASK = "[연락처는 선정 뒤 공개]";

const PATTERNS: RegExp[] = [
  // 이메일
  /[A-Za-z0-9._%+-]+\s?(?:@|＠|\(at\)|\[at\])\s?[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi,
  // 링크 (http, www, 흔한 도메인 끝)
  /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi,
  /\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|kr|co\.kr|or\.kr|io|me|ai|biz|info)(?:\/[^\s<>"')]*)?/gi,
  // 오픈채팅·메신저
  /open\.kakao\.com\/[^\s]+/gi,
  /(?:카카오톡|카톡|kakao|텔레그램|telegram|라인|line|위챗|wechat)\s*(?:아이디|id|ID)?\s*[:：]?\s*[A-Za-z0-9._-]{3,}/gi,
  // 국제 표기 +82 10 1234 5678
  /\+\s?82[\s.-]?\(?0?\)?\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}/g,
  // 국내 전화 010-1234-5678, 02 123 4567, 031.123.4567, 1588-1234
  /(?<!\d)0\d{1,2}[\s.)-]{0,2}\d{3,4}[\s.-]?\d{4}(?!\d)/g,
  /(?<!\d)1[5-9]\d{2}[\s.-]\d{4}(?!\d)/g,
];

/** 자유 입력 글에서 연락처를 가린다. 가린 게 있으면 masked true */
export function maskContacts(text: string | null | undefined): { text: string; masked: boolean } {
  if (!text) return { text: text ?? "", masked: false };
  let out = text;
  for (const p of PATTERNS) out = out.replace(p, CONTACT_MASK);
  // 이어진 가림 표시는 하나로
  out = out.replace(new RegExp(`(?:${escape(CONTACT_MASK)}[\\s,/·]*){2,}`, "g"), `${CONTACT_MASK} `).trim();
  return { text: out, masked: out !== text.trim() };
}

/** 가린 글만 (화면용) */
export function maskedText(text: string | null | undefined): string {
  return maskContacts(text).text;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
