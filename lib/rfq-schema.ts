/**
 * 단추 표준 RFQ 스키마 — 3단계 위자드
 *
 * 설계 원칙: 특정 CRO 기준이 아니라 **국내 비임상 CRO 전체를 아우르는 합집합**.
 * 근거: 국내CRO_문의양식_조사_v0.1.md (켐온·센트럴바이오·Dt&CRO·바이오톡스텍·KIT·KTR)
 *      + 표준RFQ_양식_초안_v0.1.md
 *      + design_handoff_danchu/Danchu-RFQ.dc.html (화면 구조·흐름)
 *
 * phase 흐름: contact(순차 노출 6) → wizard(한 화면 한 질문 12) → detail(선택)
 * - 1단계(contact+wizard)만 제출해도 배포 가능 — Dt&CRO 수준의 간단함
 * - 2단계(detail)는 센트럴바이오·KIT 수준의 상세 변수를 선택 입력
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
  desc?: string;
  fields: Field[];
}

export type Values = Record<string, string | string[] | boolean | undefined>;

/* ---------- 공통 옵션 (6개사 합집합) ---------- */

/** 동물종 — 켐온·센트럴바이오·바이오톡스텍 합집합 */
const SPECIES = ["마우스", "랫드", "누드마우스", "기니피그", "토끼", "개(비글)", "미니피그", "원숭이(영장류)", "기타"];
const RODENT = ["마우스", "랫드", "기니피그", "토끼"];

/** 투여경로 — 켐온(IV/IP/IM/SC/PO) + 센트럴(Infusion·뇌내) + 바이오톡스텍(복강·경피) 합집합 */
const ROUTES = [
  "경구(PO)",
  "정맥(IV)",
  "정맥 지속주입(Infusion)",
  "피하(SC)",
  "근육(IM)",
  "복강(IP)",
  "경피·피부",
  "점안",
  "흡입",
  "비강",
  "직장",
  "질",
  "뇌내",
  "관절강내",
  "이식",
  "기타",
];

/** 분석법 보유 — 바이오톡스텍 기준 확장 */
const ASSAY_OWNED = ["없음", "HPLC", "LC-MS", "LC-MS/MS", "GC-MS", "ELISA", "qPCR", "기타"];

/** GLP 적용 — 바이오톡스텍(4종) + KIT(7종) 합집합. 환경부는 2025-10 기후에너지환경부로 개편 */
const GLP = [
  "식약처(KGLP)",
  "OECD GLP",
  "US FDA GLP",
  "US EPA GLP",
  "기후에너지환경부·국립환경과학원",
  "농촌진흥청",
  "농림축산검역본부",
  "Non-GLP",
  "미정",
];

/** 항목별 GLP 여부 — KIT 시험의뢰서의 항목별 GLP/Non-GLP 체크 방식 */
const GLP_LEVEL: Field = { id: "glpLevel", type: "radio", label: "GLP 적용", options: ["GLP", "Non-GLP", "미정"] };
const yn = (id: string, label: string): Field => ({ id, type: "radio", label, options: ["포함", "미포함", "미정"] });

/** 시험 항목 대분류 (15) — 켐온 13분류 골격 + 바이오톡스텍 발암성 분리 + 센트럴 대체독성 */
export const CATS = [
  "일반독성",
  "발암성·종양원성",
  "유전독성",
  "생식발생독성",
  "항원성·면역독성",
  "국소독성",
  "국소내성",
  "안전성약리",
  "동물대체시험",
  "조제물분석",
  "PK/TK/ADME·생체시료분석",
  "효력시험(약효)",
  "환경유해성",
  "의료기기 생물학적 안전성",
  "기타(임상병리·조직병리 등)",
] as const;

export type Cat = (typeof CATS)[number];

/* ---------- 1단계 · 담당자 정보 (순차 노출) ---------- */

export const CONTACT: Field[] = [
  { id: "company", type: "text", label: "회사·기관명", required: true, placeholder: "(주)바이오벤처" },
  { id: "name", type: "text", label: "담당자 성명", required: true, placeholder: "홍길동" },
  { id: "dept", type: "text", label: "부서·직위", placeholder: "개발팀 · 팀장" },
  { id: "email", type: "email", label: "이메일", required: true, placeholder: "name@company.com" },
  { id: "phone", type: "tel", label: "휴대전화", placeholder: "010-0000-0000" },
  {
    id: "orgType",
    type: "select",
    label: "기관 유형",
    options: ["바이오벤처", "제약사", "화장품", "의료기기", "식품·건강기능식품", "화학·농약", "대학·연구소", "공공기관", "기타"],
  },
];

/* ---------- 2단계 · 위자드 (한 화면 한 질문) ---------- */

export const WIZ: WizStep[] = [
  {
    eyebrow: "의뢰 개요",
    q: "의뢰 목적이 무엇인가요?",
    sub: "허가자료 제출용이면 GLP 시험이 필요해 견적이 달라집니다.",
    fields: [{ id: "purpose", type: "radio", required: true, options: ["허가자료 제출용", "자체 연구용", "기타"] }],
  },
  {
    eyebrow: "의뢰 개요",
    q: "개발 분야를 선택해 주세요",
    fields: [
      {
        id: "devField",
        type: "select",
        options: [
          "의약품(합성)",
          "의약품(바이오·생물학적제제)",
          "의약품(천연물)",
          "백신",
          "세포·유전자치료제",
          "의약외품",
          "화장품",
          "의료기기",
          "건강기능식품",
          "식품·식품첨가물",
          "동물용의약품",
          "농약·작물보호제",
          "일반화학물질",
          "생활화학제품",
          "LMO(유전자변형생물체)",
          "기타",
        ],
      },
    ],
  },
  {
    eyebrow: "의뢰 개요",
    q: "어디에 제출할 자료인가요?",
    sub: "해당하는 곳을 모두 선택하세요. 자체 연구용이면 건너뛰어도 됩니다.",
    fields: [
      {
        id: "authority",
        type: "chips",
        options: [
          "식약처(MFDS)",
          "기후에너지환경부·국립환경과학원",
          "농촌진흥청",
          "농림축산검역본부",
          "US FDA",
          "US EPA",
          "EMA",
          "PMDA(일본)",
          "NMPA(중국)",
          "OECD 국가",
          "기타",
        ],
      },
    ],
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
    sub: "없으면 미정을 선택하세요. CRO에는 구간만 전달됩니다.",
    fields: [
      {
        id: "budget",
        type: "select",
        options: ["1천만 원 미만", "1천만~3천만 원", "3천만~5천만 원", "5천만~1억 원", "1~3억 원", "3억 원 이상", "미정·비공개"],
      },
    ],
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
    fields: [
      { id: "confid", type: "radio", required: true, options: ["일반", "CDA 필요 (단추 표준 CDA)", "자체 CDA 사용"] },
    ],
  },
  {
    eyebrow: "시험 항목",
    q: "필요한 시험 항목을 모두 선택해 주세요",
    sub: "잘 모르면 다음 질문에서 상황을 적어 주세요. 세부 조건은 나중에 입력합니다.",
    fields: [{ id: "categories", type: "chips", required: true, options: [...CATS] }],
  },
  {
    eyebrow: "시험 항목",
    q: "추가로 알려주실 내용이 있나요?",
    fields: [
      {
        id: "notes",
        type: "textarea",
        placeholder: "개발 단계, 예상 임상 설계, 참고할 선행 시험, 특이 요구사항 등 자유롭게 적어 주세요.",
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

/* ---------- 3단계 · 공통 상세 조건 ---------- */
/* 바이오톡스텍 "00.기본사항" 공통 블록 + KIT 시험의뢰서 계약 단계 항목 + 센트럴바이오 분석 조건 */

export const STEP2: Group[] = [
  {
    title: "시험물질·투여 조건",
    desc: "한 번 입력하면 선택한 모든 시험에 적용됩니다.",
    fields: [
      { id: "route", type: "select", label: "시험 투여경로", options: ROUTES },
      { id: "clinRoute", type: "select", label: "임상 예정 투여경로", options: ROUTES, help: "시험 투여경로와 다를 경우" },
      {
        id: "clinDuration",
        type: "select",
        label: "임상 예정 투여기간",
        options: ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과·만성", "미정"],
        help: "반복투여독성 기간을 정하는 근거가 됩니다.",
      },
      {
        id: "storage",
        type: "select",
        label: "시험물질 보관조건",
        options: ["실온", "냉장(2~8℃)", "냉동(-20℃)", "초저온(-70℃ 이하)", "기타"],
      },
      { id: "amount", type: "text", label: "시험물질 보유량", placeholder: "예: 50 g" },
    ],
  },
  {
    title: "분석법·표준품",
    fields: [
      { id: "assayMethod", type: "select", label: "함량분석법 보유", options: ASSAY_OWNED },
      { id: "bioMethod", type: "select", label: "생체시료 분석법 보유", options: ASSAY_OWNED },
      { id: "standards", type: "radio", label: "표준품·내부표준품 제공", options: ["가능", "불가", "미정"] },
    ],
  },
  {
    title: "규제·산출물",
    fields: [
      {
        id: "guideline",
        type: "chips",
        label: "시험법 가이드라인",
        options: ["식약처", "OECD", "ICH", "국립환경과학원", "농촌진흥청", "US FDA", "US EPA", "ISO", "기타"],
      },
      { id: "glp", type: "chips", label: "적용 GLP", options: GLP },
      { id: "reportLang", type: "chips", label: "보고서 원문 언어", options: ["국문", "영문", "일문"] },
      { id: "reportTrans", type: "chips", label: "번역보고서 언어", options: ["국문", "영문", "일문", "없음"] },
      { id: "draftDue", type: "date", label: "보고서 초안 제출 희망일" },
      { id: "send", type: "radio", label: "SEND 데이터셋 필요", options: ["필요", "불필요", "미정"] },
      { id: "sendPurpose", type: "select", label: "SEND 전환 목적", options: ["IND", "NDA·BLA", "ANDA", "기타"] },
    ],
  },
  {
    title: "계약·운영 조건",
    desc: "KIT 등 일부 기관은 견적 단계에서 함께 확인합니다.",
    fields: [
      { id: "archive", type: "select", label: "자료 보관기간", options: ["3년", "5년", "10년", "기타", "미정"] },
      { id: "residual", type: "radio", label: "잔여 시험물질 처리", options: ["반환", "폐기", "미정"] },
      { id: "multisite", type: "radio", label: "다지점시험", options: ["해당 없음", "수행 예정", "미정"] },
      { id: "managerName", type: "text", label: "시험관리자 성명", placeholder: "의뢰 담당자와 다를 경우" },
      { id: "managerEmail", type: "email", label: "시험관리자 이메일", placeholder: "manager@company.com" },
      {
        id: "coa",
        type: "file",
        label: "파일 첨부 (COA, 시험물질 자료 등)",
        placeholder: "PDF, 이미지, 문서 · 파일당 20MB 이하",
        help: "COA는 시험 개시 전 필수 자료입니다. 지금 첨부하면 견적 정확도가 올라갑니다.",
      },
    ],
  },
];

/* ---------- 3단계 · 대분류별 세부 조건 ---------- */

export const DETAILS: Record<Cat, Field[]> = {
  일반독성: [
    {
      id: "items",
      type: "chips",
      label: "시험 종류",
      options: [
        "단회(급성)투여독성",
        "용량결정(DRF) 1주",
        "용량결정(DRF) 2주",
        "용량결정(DRF) 4주",
        "반복투여 1주",
        "반복투여 2주",
        "반복투여 4주",
        "반복투여 13주",
        "반복투여 26주",
        "반복투여 39주",
        "반복투여 52주",
        "기타",
      ],
    },
    { id: "species", type: "chips", label: "동물종", options: SPECIES },
    { id: "recovery", type: "select", label: "회복시험", options: ["없음", "2주", "4주", "기타", "미정"] },
    yn("tk", "TK 병행"),
    yn("formulation", "조제물분석 포함"),
    yn("doseRange", "용량설정시험 포함"),
    yn("histopath", "조직병리 포함"),
    { id: "interval", type: "select", label: "투여 간격", options: ["매일", "주 5회", "주 3회", "주 1회", "격일", "기타"] },
    { id: "doses", type: "text", label: "총 투여 횟수", placeholder: "예: 28회" },
    GLP_LEVEL,
  ],
  "발암성·종양원성": [
    {
      id: "items",
      type: "chips",
      label: "시험 종류",
      options: ["장기발암성(2년)", "단기발암성(rasH2 Tg, 26주)", "종양원성 26주", "종양원성 52주", "기타"],
    },
    { id: "species", type: "chips", label: "동물종", options: ["랫드", "마우스", "rasH2 Tg 마우스", "기타"] },
    yn("doseRange", "용량설정시험 포함"),
    GLP_LEVEL,
  ],
  유전독성: [
    {
      id: "items",
      type: "chips",
      label: "시험 항목",
      options: [
        "복귀돌연변이(Ames, TG 471)",
        "염색체이상 in vitro(TG 473)",
        "소핵 in vitro(TG 487)",
        "소핵 in vivo(마우스)",
        "소핵 in vivo(랫드)",
        "MLA 마우스림프종(TG 490)",
        "Comet(TG 489)",
        "Pig-a",
        "기타",
      ],
    },
    { id: "species", type: "chips", label: "동물종 (in vivo)", options: ["마우스", "랫드", "기타"] },
    yn("exposure", "노출증명 포함"),
    yn("formulation", "조제물분석 포함"),
    GLP_LEVEL,
  ],
  생식발생독성: [
    {
      id: "segment",
      type: "chips",
      label: "단계",
      options: [
        "수태능·초기배발생(Seg. I)",
        "배·태자발생 예비(DRF)",
        "배·태자발생(Seg. II)",
        "출생전후발생(Seg. III)",
        "생식발생 스크리닝",
        "기타",
      ],
    },
    { id: "species", type: "chips", label: "동물종", options: ["랫드", "마우스", "토끼", "기타"] },
    yn("doseRange", "용량설정시험 포함"),
    yn("tk", "TK 병행"),
    yn("formulation", "조제물분석 포함"),
    GLP_LEVEL,
  ],
  "항원성·면역독성": [
    {
      id: "items",
      type: "chips",
      label: "시험 항목",
      options: [
        "ASA(능동전신아나필락시스)",
        "PCA(수동피부아나필락시스)",
        "피부감작성 GPMT",
        "피부감작성 Buehler",
        "피부감작성 LLNA",
        "세포매개성 면역독성",
        "체액성 면역독성(TDAR)",
        "면역표현형(Immunophenotyping)",
        "사이토카인 방출",
        "기타",
      ],
    },
    { id: "species", type: "chips", label: "동물종", options: ["마우스", "랫드", "기니피그", "기타"] },
    GLP_LEVEL,
  ],
  국소독성: [
    {
      id: "items",
      type: "chips",
      label: "시험 항목",
      options: [
        "피부 1차 자극",
        "누적첩포 자극",
        "안점막 자극(세안군 적용)",
        "안점막 자극(세안군 비적용)",
        "구강점막 자극",
        "광독성",
        "광감작성",
        "기타",
      ],
    },
    { id: "species", type: "chips", label: "동물종", options: ["토끼", "기니피그", "마우스", "랫드", "기타"] },
    GLP_LEVEL,
  ],
  국소내성: [
    { id: "species", type: "chips", label: "동물종", options: ["마우스", "랫드", "토끼", "개(비글)", "기타"] },
    { id: "site", type: "text", label: "투여 부위", placeholder: "예: 정맥 주위, 근육" },
    GLP_LEVEL,
  ],
  안전성약리: [
    {
      id: "items",
      type: "chips",
      label: "핵심 배터리",
      options: [
        "중추신경계(Irwin test)",
        "중추신경계(FOB)",
        "호흡기계(Whole body plethysmography)",
        "심혈관계(Telemetry)",
        "hERG(in vitro)",
        "보조시험(기타)",
      ],
    },
    { id: "species", type: "chips", label: "동물종", options: ["마우스", "랫드", "기니피그", "개(비글)", "미니피그", "원숭이(영장류)", "기타"] },
    GLP_LEVEL,
  ],
  동물대체시험: [
    {
      id: "items",
      type: "chips",
      label: "시험 항목 (OECD TG)",
      options: [
        "피부자극 인체피부모델(TG 439)",
        "피부부식 인체피부모델(TG 431)",
        "피부부식 막희석(TG 435)",
        "안자극 각막모델(TG 492)",
        "안자극 BCOP(TG 437)",
        "피부흡수(TG 428)",
        "광독성 3T3 NRU(TG 432)",
        "피부감작 DPRA(TG 442C)",
        "피부감작 KeratinoSens(TG 442D)",
        "피부감작 h-CLAT(TG 442E)",
        "피부감작 LLNA:BrdU-ELISA(TG 442B)",
        "기타",
      ],
    },
    GLP_LEVEL,
  ],
  조제물분석: [
    { id: "items", type: "chips", label: "분석 항목", options: ["함량", "균질성", "안정성", "검량선", "기타"] },
    { id: "method", type: "chips", label: "분석 플랫폼", options: ["HPLC", "LC-MS", "LC-MS/MS", "GC-MS", "ELISA", "기타"] },
    { id: "methodProvided", type: "radio", label: "분석법 제공", options: ["제공", "미제공", "개발 필요"] },
    { id: "standards", type: "radio", label: "표준품 제공", options: ["가능", "불가", "미정"] },
    { id: "count", type: "text", label: "대상 물질 수", placeholder: "예: 2종(원물질 + 대사체)" },
    GLP_LEVEL,
  ],
  "PK/TK/ADME·생체시료분석": [
    {
      id: "items",
      type: "chips",
      label: "시험 종류",
      options: [
        "PK(약물동태)",
        "TK(독성동태)",
        "ADME",
        "조직분포",
        "배설",
        "대사체 프로파일링",
        "생체시료 분석법 개발",
        "분석법 검증(Partial)",
        "분석법 검증(Full)",
        "검체 분석",
        "기타",
      ],
    },
    { id: "species", type: "chips", label: "동물종", options: SPECIES },
    { id: "design", type: "chips", label: "설계", options: ["단회", "반복"] },
    {
      id: "matrix",
      type: "chips",
      label: "검체(Matrix)",
      options: ["혈장", "혈청", "전혈", "뇨", "분변", "담즙", "조직", "뇌척수액", "기타"],
    },
    {
      id: "anticoag",
      type: "select",
      label: "항응고제",
      options: ["헤파린", "EDTA-K2", "EDTA-K3", "구연산나트륨", "없음", "미정"],
    },
    {
      id: "instrument",
      type: "select",
      label: "분석 장비",
      options: ["LC-MS/MS", "HPLC", "ELISA", "qPCR", "LSC(방사능)", "기타", "미정"],
    },
    { id: "sampling", type: "text", label: "채혈 시기·횟수", placeholder: "예: 0.5, 1, 2, 4, 8, 24h · 총 6회" },
    GLP_LEVEL,
  ],
  "효력시험(약효)": [
    {
      id: "area",
      type: "select",
      label: "질환 영역",
      options: ["항암", "대사·내분비", "심혈관", "면역·염증", "신경계", "감염", "호흡기", "소화기", "피부", "근골격", "안과", "비뇨생식", "희귀질환", "기타"],
    },
    { id: "species", type: "chips", label: "동물종", options: [...RODENT, "누드마우스", "기타"] },
    { id: "model", type: "textarea", label: "질환 모델·설계", placeholder: "예: DSS 대장염 마우스, 군당 8마리, 양성대조군 포함" },
    GLP_LEVEL,
  ],
  환경유해성: [
    {
      id: "items",
      type: "chips",
      label: "시험 항목 (OECD TG)",
      options: [
        "조류 생장저해(TG 201)",
        "물벼룩 급성 유영저해(TG 202)",
        "물벼룩 번식(TG 211)",
        "어류 급성독성(TG 203)",
        "어류 초기생활단계(TG 210)",
        "지렁이 급성독성(TG 207)",
        "육상식물 생장(TG 208)",
        "꿀벌 급성독성(TG 213·214)",
        "n-옥탄올/물 분배계수(TG 107·117)",
        "생분해성(TG 301)",
        "가수분해(TG 111)",
        "흡착·탈착(TG 106)",
        "기타",
      ],
    },
    { id: "fish", type: "text", label: "어종", placeholder: "예: 송사리(Oryzias latipes)" },
    GLP_LEVEL,
  ],
  "의료기기 생물학적 안전성": [
    {
      id: "items",
      type: "chips",
      label: "ISO 10993 항목",
      options: [
        "세포독성(10993-5)",
        "감작성(10993-10)",
        "자극성·피내반응(10993-23)",
        "급성전신독성(10993-11)",
        "아급성·아만성독성(10993-11)",
        "만성독성(10993-11)",
        "유전독성(10993-3)",
        "발암성(10993-3)",
        "생식발생독성(10993-3)",
        "이식(10993-6)",
        "혈액적합성(10993-4)",
        "발열성(10993-11)",
        "화학적 특성 분석(10993-18)",
        "허용가능한계 설정(10993-17)",
        "기타",
      ],
    },
    {
      id: "extract",
      type: "select",
      label: "추출 조건",
      options: ["표준(37℃ 72h)", "50℃ 72h", "70℃ 24h", "121℃ 1h", "가혹", "기타", "미정"],
    },
    { id: "device", type: "text", label: "기기 분류·접촉 부위·기간", placeholder: "예: 2등급, 점막 접촉, 24h 미만" },
    GLP_LEVEL,
  ],
  "기타(임상병리·조직병리 등)": [
    {
      id: "items",
      type: "chips",
      label: "항목",
      options: ["임상병리", "조직병리(판독)", "병리 피어리뷰", "다지점시험", "시험물질 특성분석(순도 등)", "위탁 보관", "기타"],
    },
    { id: "desc", type: "textarea", label: "상세 내용", placeholder: "필요한 시험을 자유롭게 적어 주세요." },
  ],
};

export const DEFAULT_VALUES: Values = { croCount: "3곳", confid: "일반", categories: [] };

/** 전체 진행 스텝 수 = 담당자 6 + 위자드 12 */
export const TOTAL_STEPS = CONTACT.length + WIZ.length;

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
