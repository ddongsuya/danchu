/**
 * 사전예약 (/early). 양식·API·운영자 화면이 같은 선택지를 쓴다.
 * 선택지 문구를 바꾸면 이미 저장된 값과 집계가 갈라지므로, 바꿀 때는 운영자 화면 집계도 함께 본다.
 */
export type EarlyRole = "req" | "cro";

export const EARLY_KINDS = ["Tox", "PD", "PK", "Other"] as const;
export type EarlyKind = (typeof EARLY_KINDS)[number];
export const EARLY_KIND_LABEL: Record<EarlyKind, string> = { Tox: "독성", PD: "효력", PK: "약동학", Other: "개별 분석" };
/** 의뢰자 설문 (2026-11-06 시안 판 15). 문구를 바꾸면 운영자 화면 집계가 갈라지니 함께 본다 */
export const EARLY_ORG_TYPES = ["제약·바이오", "의료기기", "화장품·건강기능식품", "대학·연구소", "기타"];
export const EARLY_WHEN = ["3개월 안", "6개월 안", "1년 안", "아직 몰라요"];
export const EARLY_YEARLY = ["1~2건", "3~5건", "6~10건", "11건 이상"];
export const EARLY_QUOTE_COUNT = ["1곳", "2~3곳", "4곳 이상"];
/** 기관 설문 */
export const EARLY_GLP = ["있어요", "없어요"];
export const EARLY_MONTHLY = ["10건 미만", "10~30건", "31~50건", "51건 이상"];

/** 시범 운영 시작일. 예약 정보는 이날부터 6개월 뒤 지운다 (개인정보처리방침 3항, lib/retention.ts) */
export const EARLY_OPEN_DATE = "2027-06-01";
export const EARLY_DELETE_AFTER = "2027-12-01";

export const EARLY_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EarlyInput = {
  role: EarlyRole;
  name: string;
  /** 숫자만 (01012345678) */
  phone: string;
  email: string;
  org: string | null;
  orgType: string | null;
  kinds: EarlyKind[];
  timing: string | null;
  yearly: string | null;
  quoteCount: string | null;
  glp: string | null;
  monthly: string | null;
  adAgree: boolean;
  source: string | null;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = (v: unknown, list: readonly string[]) => (typeof v === "string" && list.includes(v) ? v : null);
const pickMany = <T extends string>(v: unknown, list: readonly T[]): T[] =>
  Array.isArray(v) ? list.filter((x) => v.includes(x)) : [];

/** 휴대전화 번호를 숫자만으로. 휴대전화가 아니면 null (lib/sms.ts normalizeMobile 과 같은 규칙) */
export function earlyPhone(raw: unknown): string | null {
  const d = (typeof raw === "string" ? raw : "").replace(/\D/g, "").replace(/^82(?=1)/, "0");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

/** 요청 본문을 검사한다. 문제가 있으면 화면에 그대로 보여 줄 문장을 돌려준다 */
export function parseEarly(b: Record<string, unknown>): { ok: true; value: EarlyInput } | { ok: false; error: string } {
  const role: EarlyRole | null = b.role === "req" || b.role === "cro" ? b.role : null;
  if (!role) return { ok: false, error: "의뢰자와 시험 기관 중 하나를 다시 골라 주세요." };
  const req = role === "req";
  const name = str(b.name, 40);
  if (!name) return { ok: false, error: "이름을 적어 주세요." };
  const phone = earlyPhone(b.phone);
  if (!phone) return { ok: false, error: "휴대폰 번호를 확인해 주세요. 예: 010-1234-5678" };
  const email = str(b.email, 320).toLowerCase();
  if (!EARLY_EMAIL.test(email)) return { ok: false, error: "이메일 주소를 확인해 주세요. 예: name@company.com" };
  const org = str(b.org, 100);
  if (!req && !org) return { ok: false, error: "기관명을 적어 주세요." };
  const kinds = pickMany(b.kinds, EARLY_KINDS);
  if (kinds.length === 0) return { ok: false, error: req ? "견적 받을 시험을 하나 이상 골라 주세요." : "견적 보낼 시험을 하나 이상 골라 주세요." };
  const orgType = req ? pick(b.orgType, EARLY_ORG_TYPES) : null;
  const timing = req ? pick(b.timing, EARLY_WHEN) : null;
  const yearly = req ? pick(b.yearly, EARLY_YEARLY) : null;
  const quoteCount = req ? pick(b.quoteCount, EARLY_QUOTE_COUNT) : null;
  const glp = req ? null : pick(b.glp, EARLY_GLP);
  const monthly = req ? null : pick(b.monthly, EARLY_MONTHLY);
  if (req && (!orgType || !timing || !yearly || !quoteCount)) return { ok: false, error: "설문에 답하지 않은 질문이 있어요. 이전으로 돌아가 골라 주세요." };
  if (!req && (!glp || !monthly)) return { ok: false, error: "설문에 답하지 않은 질문이 있어요. 이전으로 돌아가 골라 주세요." };
  if (b.agree !== true) return { ok: false, error: "[필수] 개인정보 수집·이용에 동의해 주세요." };
  return {
    ok: true,
    value: { role, name, phone, email, org: req ? null : org, orgType, kinds, timing, yearly, quoteCount, glp, monthly, adAgree: b.adAgree === true, source: str(b.source, 120) || null },
  };
}

/** 예약 완료 문자 (승인 시안 문구, [단추] 를 붙이면 98바이트라 장문으로 간다). 앞의 [단추] 는 보낼 때 붙인다 */
export const EARLY_DONE_SMS = "사전예약 완료\n시범 운영은 2027년 6월 1일에 시작해요.\n그 전에도 단추를 둘러보세요.\ndanchu.kr";

/** 시범 운영 시작 문자 (2027-06-01 예약 작업이 보낸다) */
export function earlyOpenSms(role: EarlyRole): string {
  return role === "req"
    ? "시범 운영 시작\n오늘부터 비임상 시험 견적을 단추에 요청하세요.\n2027년 12월 31일까지 무료로 이용해보세요.\ndanchu.kr"
    : "시범 운영 시작\n오늘부터 들어오는 요청에 견적을 보내보세요.\n2027년 12월 31일까지 무료로 이용해보세요.\ndanchu.kr";
}
