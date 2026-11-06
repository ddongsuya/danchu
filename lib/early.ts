/**
 * 사전예약 (/early). 양식·API·운영자 화면이 같은 선택지를 쓴다.
 * 선택지 문구를 바꾸면 이미 저장된 값과 집계가 갈라지므로, 바꿀 때는 운영자 화면 집계도 함께 본다.
 */
export type EarlyRole = "req" | "cro";

export const EARLY_KINDS = ["Tox", "PD", "PK", "Other"] as const;
export type EarlyKind = (typeof EARLY_KINDS)[number];
export const EARLY_KIND_LABEL: Record<EarlyKind, string> = { Tox: "독성", PD: "효력", PK: "약동학", Other: "개별 분석" };
export const EARLY_ORG_TYPES = ["제약", "바이오텍", "화장품", "건강기능식품", "의료기기", "화학·농약", "연구소·대학", "기타"];
export const EARLY_WHEN = ["3개월 안", "6개월 안", "1년 안", "아직 미정"];
export const EARLY_GLP = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "없음"];
export const EARLY_INTENT = ["오픈 전에 먼저 등록할게요", "요청서를 한번 받아보고 정할게요", "오픈 소식만 받을게요", "아직 잘 모르겠어요"];

/** 시범 운영 시작일. 예약 정보는 이날부터 6개월 뒤 지운다 (개인정보처리방침 3항, lib/retention.ts) */
export const EARLY_OPEN_DATE = "2027-06-01";
export const EARLY_DELETE_AFTER = "2027-12-01";

export const EARLY_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EarlyInput = {
  role: EarlyRole;
  email: string;
  org: string | null;
  orgType: string | null;
  kinds: EarlyKind[];
  timing: string | null;
  glp: string[];
  intent: string | null;
  ask: string | null;
  source: string | null;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = (v: unknown, list: readonly string[]) => (typeof v === "string" && list.includes(v) ? v : null);
const pickMany = <T extends string>(v: unknown, list: readonly T[]): T[] =>
  Array.isArray(v) ? list.filter((x) => v.includes(x)) : [];

/** 요청 본문을 검사한다. 문제가 있으면 화면에 그대로 보여 줄 문장을 돌려준다 */
export function parseEarly(b: Record<string, unknown>): { ok: true; value: EarlyInput } | { ok: false; error: string } {
  const role: EarlyRole | null = b.role === "req" || b.role === "cro" ? b.role : null;
  if (!role) return { ok: false, error: "예약 갈래를 다시 골라 주세요." };
  const email = str(b.email, 320).toLowerCase();
  const org = str(b.org, 100);
  if (role === "cro" && !org) return { ok: false, error: "기관명을 적어 주세요." };
  if (!EARLY_EMAIL.test(email)) return { ok: false, error: "이메일 주소를 확인해 주세요. 예: name@company.com" };
  const kinds = pickMany(b.kinds, EARLY_KINDS);
  if (kinds.length === 0) return { ok: false, error: role === "req" ? "맡길 시험을 하나 이상 골라 주세요." : "수행 분야를 하나 이상 골라 주세요." };
  const intent = role === "cro" ? pick(b.intent, EARLY_INTENT) : null;
  if (role === "cro" && !intent) return { ok: false, error: "참여 생각을 골라 주세요." };
  if (b.agree !== true) return { ok: false, error: "개인정보 수집·이용에 동의해 주세요." };
  return {
    ok: true,
    value: {
      role,
      email,
      org: role === "cro" ? org : null,
      orgType: role === "req" ? pick(b.orgType, EARLY_ORG_TYPES) : null,
      kinds,
      timing: role === "req" ? pick(b.timing, EARLY_WHEN) : null,
      glp: role === "cro" ? pickMany(b.glp, EARLY_GLP) : [],
      intent,
      ask: role === "cro" ? str(b.ask, 1000) || null : null,
      source: str(b.source, 120) || null,
    },
  };
}
