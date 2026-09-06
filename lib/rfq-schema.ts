/**
 * 단추 표준 RFQ 스키마
 * 근거: 표준RFQ_양식_초안_v0.1.md (항목·옵션) + design_handoff_danchu (레이아웃·타입)
 *
 * - 1단계(STEP1)만 제출해도 접수 완료
 * - 2단계(STEP2 공통 + DETAILS 대분류별)는 선택
 * - 세부 조건 값의 키는 `${대분류}.${fieldId}`
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
  label: string;
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** 라벨 안의 특정 문구를 링크로 (동의 항목에서 약관·처리방침 연결) */
  link?: { text: string; href: string };
}

export interface Group {
  title: string;
  desc?: string;
  fields: Field[];
}

export type Values = Record<string, string | string[] | boolean | undefined>;

// ---------- 공통 옵션 ----------
const RODENT = ["마우스", "랫드", "기니피그", "토끼"];
const NONROD = ["비글", "미니피그", "영장류"];
const SPECIES_ALL = [...RODENT, ...NONROD, "기타"];

/** 시험항목 대분류 (B10 · D1~D14, 켐온 13분류 골격 + 기타) */
export const CATS = [
  "일반독성",
  "유전독성",
  "생식발생독성",
  "항원성·면역독성",
  "국소독성",
  "국소내성",
  "안전성약리",
  "동물대체시험",
  "조제물분석",
  "PK/TK/ADME",
  "약효(효력)",
  "환경유해성",
  "의료기기 생물학적 안전성",
  "기타",
] as const;

// ---------- 1단계 ----------
export const STEP1: Group[] = [
  {
    title: "담당자 정보",
    desc: "견적 회신을 받을 담당자 정보입니다.",
    fields: [
      { id: "company", type: "text", label: "회사/기관명", required: true, placeholder: "(주)바이오벤처" },
      { id: "name", type: "text", label: "담당자 성명", required: true, placeholder: "홍길동" },
      { id: "dept", type: "text", label: "부서·직위", placeholder: "개발팀 · 팀장" },
      { id: "email", type: "email", label: "이메일", required: true, placeholder: "name@company.com" },
      { id: "phone", type: "tel", label: "휴대전화", placeholder: "010-0000-0000" },
      {
        id: "orgType",
        type: "select",
        label: "기관 유형",
        options: ["바이오벤처", "제약사", "화장품", "의료기기", "식품·건강기능식품", "대학·연구소", "기타"],
      },
      { id: "managerName", type: "text", label: "시험관리자 성명", placeholder: "의뢰 담당자와 다를 경우", help: "선택 항목입니다." },
      { id: "managerEmail", type: "email", label: "시험관리자 이메일", placeholder: "manager@company.com" },
    ],
  },
  {
    title: "의뢰 개요",
    fields: [
      { id: "purpose", type: "radio", label: "의뢰 목적", options: ["허가자료 제출용", "자체 연구용", "기타"] },
      {
        id: "devField",
        type: "select",
        label: "개발 분야",
        options: [
          "의약품(합성)",
          "의약품(바이오)",
          "의약품(천연물)",
          "백신",
          "세포·유전자치료제",
          "의약외품",
          "화장품",
          "의료기기",
          "건강기능식품",
          "식품·첨가물",
          "동물용의약품",
          "농약",
          "화학물질",
          "기타",
        ],
      },
      {
        id: "authority",
        type: "chips",
        label: "제출처(규제기관)",
        full: true,
        options: ["식약처(MFDS)", "US FDA", "EMA", "OECD 국가", "환경부(국립환경과학원)", "농촌진흥청", "농림축산검역본부", "기타"],
        help: "허가자료 제출용일 때 선택하세요. 복수 선택 가능.",
      },
      {
        id: "substance",
        type: "text",
        label: "시험물질명",
        required: true,
        full: true,
        placeholder: "DC-101 (코드명 가능)",
        help: "기밀이 필요하면 코드명으로 입력하세요.",
      },
    ],
  },
  {
    title: "일정·예산",
    fields: [
      { id: "start", type: "select", label: "희망 착수 시기", options: ["즉시", "1~3개월", "3~6개월", "6개월 이후", "미정"] },
      { id: "replyBy", type: "date", label: "견적 회신 희망일", help: "비워 두면 접수일 기준 7영업일로 안내합니다." },
      {
        id: "budget",
        type: "select",
        label: "예산 범위",
        options: ["1천만 원 미만", "1천만~3천만 원", "3천만~1억 원", "1~3억 원", "3억 원 이상", "미정·비공개"],
      },
      { id: "croCount", type: "segmented", label: "견적 받을 CRO 수", options: ["3곳", "5곳", "전체", "직접 지정"] },
      {
        id: "confid",
        type: "radio",
        label: "기밀 등급",
        full: true,
        options: ["일반", "CDA 필요 (단추 표준 CDA)", "자체 CDA 사용"],
        help: "CDA를 선택하면 비밀유지계약을 체결한 CRO에만 요청서를 전달합니다.",
      },
    ],
  },
  {
    title: "시험 항목",
    fields: [
      {
        id: "categories",
        type: "chips",
        label: "시험 항목 대분류",
        required: true,
        full: true,
        options: [...CATS],
        help: "필요한 항목을 모두 선택하세요. 잘 모르면 자유 기술란에 상황을 적어 주세요.",
      },
      {
        id: "notes",
        type: "textarea",
        label: "자유 기술란",
        full: true,
        placeholder: "개발 단계, 예상 임상 설계, 참고할 선행 시험 등 자유롭게 적어 주세요.",
      },
    ],
  },
  {
    title: "동의",
    fields: [
      {
        id: "agreePrivacy",
        type: "checkbox",
        label: "개인정보 수집·이용에 동의합니다.",
        required: true,
        full: true,
        link: { text: "개인정보 수집·이용", href: "/privacy" },
      },
      {
        id: "agreeTerms",
        type: "checkbox",
        label: "이용약관에 동의하며, 요청서가 참여 CRO에 배포되는 것을 확인했습니다.",
        required: true,
        full: true,
        link: { text: "이용약관", href: "/terms" },
      },
      {
        id: "agreeShare",
        type: "checkbox",
        label: "입력 정보는 견적 목적으로만 참여 CRO에 전달되며, 기밀 등급에 따라 CDA 체결 후 전달됩니다.",
        required: true,
        full: true,
      },
    ],
  },
];

// ---------- 2단계 공통 ----------
const ROUTES = ["경구", "정맥", "정맥(Infusion)", "피하", "근육", "복강", "경피", "흡입", "점안", "뇌내", "기타"];
const METHOD_OWN = ["없음", "HPLC", "LC-MS/MS", "ELISA", "기타"];

export const STEP2: Group[] = [
  {
    title: "투여·임상 조건",
    fields: [
      { id: "route", type: "select", label: "투여경로", options: ROUTES },
      { id: "clinRoute", type: "select", label: "임상 예정 투여경로", options: ROUTES, help: "시험 투여경로와 다를 경우" },
      {
        id: "clinDuration",
        type: "select",
        label: "임상 예정 투여기간",
        options: ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과·만성", "미정"],
      },
      { id: "assayMethod", type: "select", label: "함량분석법 보유", options: METHOD_OWN },
      { id: "bioMethod", type: "select", label: "생체시료 분석법 보유", options: METHOD_OWN },
      { id: "standards", type: "radio", label: "표준품·내부표준품 제공", options: ["가능", "불가", "미정"] },
    ],
  },
  {
    title: "규제·산출물",
    fields: [
      { id: "glp", type: "chips", label: "적용 GLP", full: true, options: ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "환경부", "농진청", "Non-GLP"] },
      { id: "reportLang", type: "chips", label: "보고서 원문 언어", options: ["국문", "영문", "일문"] },
      { id: "reportTrans", type: "chips", label: "번역본 필요", options: ["국문", "영문", "일문", "없음"] },
      { id: "send", type: "radio", label: "SEND 데이터셋 필요", options: ["필요", "불필요", "미정"] },
      { id: "sendPurpose", type: "select", label: "SEND 용도", options: ["IND", "NDA", "기타"] },
      {
        id: "files",
        type: "file",
        label: "파일 첨부 (COA, 기타 자료)",
        full: true,
        placeholder: "PDF, 이미지, 문서 · 파일당 20MB 이하",
      },
    ],
  },
];

// ---------- 2단계 대분류별 세부 조건 ----------
const GLP_LEVEL: Field = { id: "glpLevel", type: "radio", label: "GLP 적용", options: ["GLP", "Non-GLP", "미정"] };

export const DETAILS: Record<(typeof CATS)[number], Field[]> = {
  일반독성: [
    { id: "items", type: "chips", label: "시험 종류", full: true, options: ["단회투여독성", "DRF(용량결정) 1주", "DRF 2주", "DRF 4주", "반복투여 2주", "반복투여 4주", "반복투여 13주", "반복투여 26주", "반복투여 39주", "반복투여 52주", "발암성", "종양원성"] },
    { id: "species", type: "chips", label: "동물종", full: true, options: SPECIES_ALL },
    { id: "recovery", type: "select", label: "회복군", options: ["없음", "2주", "4주", "기타", "미정"] },
    { id: "tk", type: "radio", label: "TK 포함", options: ["포함", "미포함", "미정"] },
    { id: "formulation", type: "radio", label: "조제물분석 포함", options: ["포함", "미포함", "미정"] },
    { id: "interval", type: "select", label: "투여 간격", options: ["매일", "주 3회", "주 1회", "기타"] },
    GLP_LEVEL,
  ],
  유전독성: [
    { id: "items", type: "chips", label: "시험 항목", full: true, options: ["복귀돌연변이(Ames)", "염색체이상", "소핵(마우스)", "소핵(랫드)", "MLA", "Comet", "Pig-a"] },
    { id: "exposure", type: "radio", label: "노출증명 포함", options: ["포함", "미포함", "미정"] },
    GLP_LEVEL,
  ],
  생식발생독성: [
    { id: "segment", type: "chips", label: "단계", full: true, options: ["수태능·초기배발생(Seg. I)", "배·태자발생 DRF", "배·태자발생(Seg. II)", "출생전후발생(Seg. III)", "스크리닝"] },
    { id: "species", type: "chips", label: "동물종", options: ["랫드", "토끼", "마우스"] },
    { id: "doseRange", type: "radio", label: "용량설정시험 포함", options: ["포함", "미포함", "미정"] },
    { id: "tk", type: "radio", label: "TK 포함", options: ["포함", "미포함", "미정"] },
    GLP_LEVEL,
  ],
  "항원성·면역독성": [
    { id: "items", type: "chips", label: "시험 항목", full: true, options: ["ASA", "PCA", "피부감작(GPMT)", "피부감작(Buehler)", "피부감작(LLNA)", "세포매개성 면역", "체액성 면역", "TDAR"] },
    GLP_LEVEL,
  ],
  국소독성: [
    { id: "items", type: "chips", label: "시험 항목", full: true, options: ["피부 1차 자극", "누적첩포", "안점막 자극(세안군 적용)", "안점막 자극(세안군 비적용)", "구강점막 자극", "광독성", "광감작"] },
    GLP_LEVEL,
  ],
  국소내성: [
    { id: "species", type: "chips", label: "동물종", full: true, options: ["마우스", "랫드", "토끼", "비글"] },
    { id: "site", type: "text", label: "투여 부위", placeholder: "예: 정맥 주위, 근육" },
    GLP_LEVEL,
  ],
  안전성약리: [
    { id: "items", type: "chips", label: "핵심 배터리", full: true, options: ["중추신경계(Irwin·FOB)", "호흡기계", "심혈관계(Telemetry)", "hERG"] },
    { id: "species", type: "chips", label: "동물종", full: true, options: ["마우스", "랫드", "비글", "영장류", "미니피그"] },
    GLP_LEVEL,
  ],
  동물대체시험: [
    { id: "items", type: "chips", label: "시험 항목", full: true, options: ["LLNA-BrdU(TG 442B)", "DPRA(TG 442C)", "h-CLAT(TG 442E)", "안자극 모델(TG 492)", "피부자극 모델(TG 439)", "피부부식(TG 431/435)", "피부흡수(TG 428)", "3T3 NRU 광독성(TG 432)"] },
    GLP_LEVEL,
  ],
  조제물분석: [
    { id: "method", type: "chips", label: "분석 플랫폼", full: true, options: ["HPLC", "LC-MS/MS", "ELISA", "기타"] },
    { id: "methodProvided", type: "radio", label: "분석법 제공", options: ["제공", "미제공", "개발 필요"] },
    { id: "standards", type: "radio", label: "표준품 제공", options: ["가능", "불가", "미정"] },
    GLP_LEVEL,
  ],
  "PK/TK/ADME": [
    { id: "items", type: "chips", label: "시험 종류", full: true, options: ["PK", "TK", "ADME", "생체시료 분석법 검증(Partial)", "생체시료 분석법 검증(Full)"] },
    { id: "species", type: "chips", label: "동물종", full: true, options: SPECIES_ALL },
    { id: "matrix", type: "chips", label: "검체(Matrix)", options: ["혈장", "혈청", "전혈", "조직", "뇨", "기타"] },
    { id: "instrument", type: "radio", label: "분석장비", options: ["LC-MS/MS", "ELISA", "기타", "미정"] },
    { id: "sampling", type: "text", label: "채혈 시기·횟수", full: true, placeholder: "예: 투여 후 0.5, 1, 2, 4, 8, 24h · 총 6회" },
    GLP_LEVEL,
  ],
  "약효(효력)": [
    { id: "area", type: "select", label: "질환 영역", options: ["항암", "대사·내분비", "심혈관", "면역·염증", "신경계", "감염", "호흡기", "소화기", "피부", "근골격", "안과", "기타"] },
    { id: "species", type: "chips", label: "동물종", options: RODENT },
    { id: "model", type: "textarea", label: "질환 모델·설계", full: true, placeholder: "예: DSS 대장염 마우스, 군당 8마리, 양성대조군 포함" },
    GLP_LEVEL,
  ],
  환경유해성: [
    { id: "items", type: "chips", label: "시험 항목", full: true, options: ["조류 생장저해", "물벼룩 급성독성", "어류 급성독성", "분배계수", "이분해성"] },
    { id: "fish", type: "text", label: "어종", placeholder: "예: 송사리, 잉어" },
    GLP_LEVEL,
  ],
  "의료기기 생물학적 안전성": [
    { id: "items", type: "chips", label: "ISO 10993 항목", full: true, options: ["세포독성", "감작성", "자극성", "급성전신독성", "아급성·아만성독성", "유전독성", "이식", "혈액적합성", "발열성", "중대동물 안전성"] },
    { id: "extract", type: "select", label: "추출 조건", options: ["표준(37℃ 72h)", "가혹", "기타", "미정"] },
    GLP_LEVEL,
  ],
  기타: [
    { id: "items", type: "chips", label: "항목", full: true, options: ["임상병리", "조직병리", "다지점시험", "기타"] },
    { id: "desc", type: "textarea", label: "상세 내용", full: true, placeholder: "필요한 시험을 자유롭게 적어 주세요." },
  ],
};

export const DEFAULT_VALUES: Values = {
  croCount: "3곳",
  confid: "일반",
  categories: [],
};

/** 1단계 필수 검증 — 첫 누락 항목 라벨을 담은 에러 문구 반환 */
export function validateStep1(values: Values): string {
  for (const g of STEP1) {
    for (const f of g.fields) {
      if (!f.required) continue;
      const v = values[f.id];
      if (v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0)) {
        return `필수 항목을 확인해 주세요: ${f.label}`;
      }
    }
  }
  const email = values.email;
  if (typeof email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "이메일 형식을 확인해 주세요.";
  }
  return "";
}

/** 모든 필드 라벨 (id → label) — 메일 본문·관리용 */
export function labelMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const g of [...STEP1, ...STEP2]) for (const f of g.fields) m[f.id] = f.label;
  for (const cat of CATS) for (const f of DETAILS[cat]) m[`${cat}.${f.id}`] = `${cat} · ${f.label}`;
  return m;
}
