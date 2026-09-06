/**
 * 단추 표준 RFQ 스키마 — 3단계 위자드
 * 근거: design_handoff_danchu/Danchu-RFQ.dc.html (CONTACT / WIZ / STEP2 / DETAILS / CATS)
 *
 * phase 흐름: contact(순차 노출 6) → wizard(한 화면 한 질문 12) → detail(선택)
 * 세부 조건 값의 키는 `${대분류}.${fieldId}`
 */

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "textarea"
  | "select"
  | "radio"
  | "segmented"
  | "chips"
  | "checkbox"
  | "file";

export interface Field {
  id: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** 라벨 안의 특정 문구를 링크로 (동의 항목에서 약관·처리방침 연결) */
  link?: { text: string; href: string };
}

export interface WizStep {
  eyebrow: string;
  q: string;
  sub?: string;
  fields: Field[];
}

export interface Group {
  title: string;
  fields: Field[];
}

export type Values = Record<string, string | string[] | boolean | undefined>;

const RODENT = ["랫드", "마우스", "기니피그", "토끼"];
const NONROD = ["비글", "미니피그", "원숭이"];
const SPECIES = [...RODENT, ...NONROD];

/** 시험 항목 대분류 */
export const CATS = [
  "단회투여독성",
  "반복투여독성",
  "유전독성",
  "생식발생독성",
  "안전성약리",
  "국소독성(자극·감작)",
  "면역독성",
  "발암성",
  "독성동태(TK)",
  "약물동태(PK)",
  "의료기기 생물학적 안전성",
  "동물대체시험",
  "효력시험",
  "분석법 개발·검증",
] as const;

export type Cat = (typeof CATS)[number];

/** 1단계 · 담당자 정보 — 순차 노출 */
export const CONTACT: Field[] = [
  { id: "company", type: "text", label: "회사명", required: true, placeholder: "(주)바이오벤처" },
  { id: "name", type: "text", label: "담당자", required: true, placeholder: "홍길동" },
  { id: "dept", type: "text", label: "부서·직위", placeholder: "개발팀 · 팀장" },
  { id: "email", type: "email", label: "이메일", required: true, placeholder: "name@company.com" },
  { id: "phone", type: "tel", label: "휴대전화", placeholder: "010-0000-0000" },
  {
    id: "orgType",
    type: "select",
    label: "기관 유형",
    options: ["바이오벤처", "제약사", "화장품", "의료기기", "식품·건강기능식품", "대학·연구소", "기타"],
  },
];

/** 2단계 · 위자드 — 한 화면 한 질문 */
export const WIZ: WizStep[] = [
  {
    eyebrow: "의뢰 개요",
    q: "의뢰 목적이 무엇인가요?",
    fields: [{ id: "purpose", type: "radio", required: true, options: ["허가자료 제출용", "자체 연구용"] }],
  },
  {
    eyebrow: "의뢰 개요",
    q: "개발 분야를 선택해 주세요",
    fields: [
      {
        id: "devField",
        type: "select",
        options: ["합성의약품", "바이오의약품", "세포·유전자치료제", "백신", "의료기기", "화장품", "건강기능식품", "기타"],
      },
    ],
  },
  {
    eyebrow: "의뢰 개요",
    q: "어디에 제출할 자료인가요?",
    sub: "해당하는 곳을 모두 선택하세요. 자체 연구용이면 건너뛰어도 됩니다.",
    fields: [{ id: "authority", type: "chips", options: ["식약처(MFDS)", "FDA", "EMA", "PMDA", "NMPA", "기타"] }],
  },
  {
    eyebrow: "의뢰 개요",
    q: "시험물질명을 입력해 주세요",
    sub: "기밀이 필요하면 코드명으로 입력하세요.",
    fields: [{ id: "substance", type: "text", required: true, placeholder: "DC-101" }],
  },
  {
    eyebrow: "일정·예산",
    q: "언제 착수하고 싶으신가요?",
    fields: [{ id: "start", type: "select", options: ["1개월 이내", "1~3개월", "3~6개월", "6개월 이후", "미정"] }],
  },
  {
    eyebrow: "일정·예산",
    q: "견적 회신은 언제까지 필요하세요?",
    sub: "비워 두면 접수일 기준 7영업일로 안내합니다.",
    fields: [{ id: "replyBy", type: "date" }],
  },
  {
    eyebrow: "일정·예산",
    q: "예산 범위가 있나요?",
    sub: "없으면 미정을 선택하세요.",
    fields: [{ id: "budget", type: "select", options: ["5천만 원 미만", "5천만~1억 원", "1~3억 원", "3억 원 이상", "미정"] }],
  },
  {
    eyebrow: "일정·예산",
    q: "몇 곳의 CRO에서 견적을 받을까요?",
    fields: [{ id: "croCount", type: "segmented", required: true, options: ["3곳", "5곳", "전체"] }],
  },
  {
    eyebrow: "일정·예산",
    q: "기밀 등급을 선택해 주세요",
    sub: "CDA 필요를 선택하면 비밀유지계약을 체결한 CRO에만 전달합니다.",
    fields: [{ id: "confid", type: "radio", required: true, options: ["일반", "CDA 필요"] }],
  },
  {
    eyebrow: "시험 항목",
    q: "필요한 시험 항목을 모두 선택해 주세요",
    sub: "잘 모르면 다음 질문에서 상황을 적어 주세요.",
    fields: [{ id: "categories", type: "chips", required: true, options: [...CATS] }],
  },
  {
    eyebrow: "시험 항목",
    q: "추가로 알려주실 내용이 있나요?",
    fields: [
      {
        id: "notes",
        type: "textarea",
        placeholder: "개발 단계, 예상 임상 설계, 참고할 선행 시험 등 자유롭게 적어 주세요.",
      },
    ],
  },
  {
    eyebrow: "마지막 단계",
    q: "동의가 필요합니다",
    sub: "동의 후 바로 제출하거나, 상세 조건을 더 입력할 수 있습니다.",
    fields: [
      {
        id: "agreePrivacy",
        type: "checkbox",
        label: "개인정보 수집·이용에 동의합니다.",
        required: true,
        link: { text: "개인정보 수집·이용", href: "/privacy" },
      },
      {
        id: "agreeTerms",
        type: "checkbox",
        label: "이용약관에 동의합니다.",
        required: true,
        link: { text: "이용약관", href: "/terms" },
      },
      {
        id: "agreeShare",
        type: "checkbox",
        label: "견적 목적으로 참여 CRO에 요청 내용을 제공하는 것에 동의합니다.",
        required: true,
      },
    ],
  },
];

/** 3단계 · 공통 상세 조건 */
export const STEP2: Group[] = [
  {
    title: "투여·임상 조건",
    fields: [
      { id: "route", type: "select", label: "투여경로", options: ["경구", "정맥", "피하", "근육", "피부", "흡입", "점안", "기타"] },
      {
        id: "clinDuration",
        type: "select",
        label: "임상 예정 투여기간",
        options: ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과", "미정"],
      },
      { id: "hasMethod", type: "radio", label: "분석법 보유 여부", options: ["보유", "미보유", "개발 필요"] },
      { id: "reportLang", type: "chips", label: "보고서 언어", options: ["한국어", "영어"] },
    ],
  },
  {
    title: "규제·산출물",
    fields: [
      { id: "glp", type: "chips", label: "적용 GLP", options: ["KGLP", "OECD GLP", "FDA GLP", "비GLP"] },
      { id: "send", type: "radio", label: "SEND 데이터셋 필요 여부", options: ["필요", "불필요", "미정"] },
      { id: "coa", type: "file", label: "파일 첨부 (COA 등)", placeholder: "PDF, 이미지 · 파일당 20MB 이하" },
    ],
  },
];

/** 3단계 · 대분류별 세부 조건 */
export const DETAILS: Record<Cat, Field[]> = {
  단회투여독성: [
    { id: "species", type: "chips", label: "동물종", options: SPECIES },
    { id: "obs", type: "select", label: "관찰기간", options: ["14일", "기타"] },
  ],
  반복투여독성: [
    { id: "species", type: "chips", label: "동물종", options: SPECIES },
    { id: "duration", type: "chips", label: "투여기간", options: ["2주", "4주", "13주", "26주", "39주"] },
    { id: "recovery", type: "radio", label: "회복군", options: ["포함", "미포함", "미정"] },
    { id: "tk", type: "radio", label: "TK 병행", options: ["필요", "불필요", "미정"] },
  ],
  유전독성: [
    { id: "items", type: "chips", label: "시험 항목", options: ["복귀돌연변이(Ames)", "염색체이상", "소핵", "Comet"] },
  ],
  생식발생독성: [
    {
      id: "segment",
      type: "chips",
      label: "단계",
      options: ["수태능·초기배발생(Seg. I)", "배·태자발생(Seg. II)", "출생전후발생(Seg. III)"],
    },
    { id: "species", type: "chips", label: "동물종", options: ["랫드", "토끼"] },
  ],
  안전성약리: [
    { id: "items", type: "chips", label: "핵심 배터리", options: ["hERG", "중추신경계", "심혈관계", "호흡기계"] },
  ],
  "국소독성(자극·감작)": [
    { id: "items", type: "chips", label: "시험 항목", options: ["피부자극", "안자극", "피부감작", "광독성"] },
  ],
  면역독성: [{ id: "items", type: "chips", label: "시험 항목", options: ["TDAR", "면역표현형", "사이토카인 방출"] }],
  발암성: [
    { id: "species", type: "chips", label: "동물종", options: ["랫드", "마우스", "Tg 마우스"] },
    { id: "duration", type: "select", label: "기간", options: ["6개월", "2년"] },
  ],
  "독성동태(TK)": [
    { id: "matrix", type: "chips", label: "검체", options: ["혈장", "혈청", "조직"] },
    { id: "method", type: "radio", label: "분석법", options: ["LC-MS/MS", "ELISA", "미정"] },
  ],
  "약물동태(PK)": [
    { id: "species", type: "chips", label: "동물종", options: SPECIES },
    { id: "design", type: "chips", label: "설계", options: ["단회", "반복", "조직분포", "배설"] },
  ],
  "의료기기 생물학적 안전성": [
    {
      id: "items",
      type: "chips",
      label: "ISO 10993 항목",
      options: ["세포독성", "감작성", "자극성", "급성전신독성", "아만성독성", "유전독성", "이식", "발열성", "혈액적합성"],
    },
  ],
  동물대체시험: [
    {
      id: "items",
      type: "chips",
      label: "시험 항목",
      options: ["피부자극(OECD 439)", "피부부식(OECD 431)", "안자극(OECD 492)", "피부감작(OECD 442)", "광독성(OECD 432)"],
    },
  ],
  효력시험: [
    { id: "model", type: "text", label: "질환 모델", placeholder: "예: DSS 대장염 마우스" },
    { id: "species", type: "chips", label: "동물종", options: RODENT },
  ],
  "분석법 개발·검증": [
    { id: "items", type: "chips", label: "범위", options: ["분석법 개발", "밸리데이션", "검체 분석"] },
    { id: "method", type: "radio", label: "분석 플랫폼", options: ["LC-MS/MS", "ELISA", "qPCR", "미정"] },
  ],
};

export const DEFAULT_VALUES: Values = { croCount: "3곳", confid: "일반", categories: [] };

/** 전체 진행 스텝 수 = 담당자 6 + 위자드 12 */
export const TOTAL_STEPS = CONTACT.length + WIZ.length;

/** 값이 채워졌는지 */
export function filled(values: Values, id: string): boolean {
  const v = values[id];
  return Array.isArray(v) ? v.length > 0 : !!v;
}

/** 서버 제출 전 필수 검증 — 첫 누락 항목의 안내 문구 반환 */
export function validateRequired(values: Values): string {
  for (const f of CONTACT) {
    if (f.required && !filled(values, f.id)) return `필수 항목을 확인해 주세요: ${f.label}`;
  }
  const email = values.email;
  if (typeof email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "이메일 형식을 확인해 주세요.";
  }
  for (const step of WIZ) {
    for (const f of step.fields) {
      if (f.required && !filled(values, f.id)) return `필수 항목을 확인해 주세요: ${f.label || step.q}`;
    }
  }
  return "";
}

/** id → 사람이 읽는 라벨 (메일 본문·관리용) */
export function labelMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const f of CONTACT) m[f.id] = f.label || f.id;
  for (const s of WIZ) for (const f of s.fields) m[f.id] = f.label || s.q;
  for (const g of STEP2) for (const f of g.fields) m[f.id] = f.label || f.id;
  for (const cat of CATS) for (const f of DETAILS[cat]) m[`${cat}.${f.id}`] = `${cat} · ${f.label}`;
  return m;
}
