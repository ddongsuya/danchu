/**
 * 가이드라인 자료실(/guide/library)에 싣는 공개 문서 목록.
 * - 원문은 발행 기관의 공식 주소로만 연결한다(ICH 공식 PDF, 국가법령정보센터, OECD). 파일을 직접 올리지 않는다.
 * - 국내 CRO 자료·사내 자료는 넣지 않는다(중립).
 * - short 는 lib/cite.ts shortCite 가 만드는 화면용 이름과 같게 둔다. 근거 표기(components/Cite.tsx)가 이 값으로 원문 링크를 찾는다.
 * - 주소는 2026-11-03에 열리는지 확인했다(OECD는 자동 접근을 막아 검색 결과의 공식 주소로 넣었다. ICH S1B(R1)은 PDF 주소를 찾지 못해 ICH 안전성 가이드라인 목록으로 잇는다).
 */

export type Product = "drug" | "bio" | "cgt" | "hf" | "cos" | "dev" | "chem";

export const PRODUCTS: { id: Product; label: string }[] = [
  { id: "drug", label: "합성의약품" },
  { id: "bio", label: "바이오의약품" },
  { id: "cgt", label: "세포·유전자치료제" },
  { id: "hf", label: "건강기능식품" },
  { id: "cos", label: "화장품" },
  { id: "dev", label: "의료기기" },
  { id: "chem", label: "화학물질·농약" },
];

export type Topic = { id: string; title: string };

export const TOPICS: Topic[] = [
  { id: "plan", title: "시험 시기와 제출 자료" },
  { id: "general", title: "단회·반복투여독성" },
  { id: "geno", title: "유전독성" },
  { id: "safety", title: "안전성약리" },
  { id: "repro", title: "생식발생독성" },
  { id: "carc", title: "발암성" },
  { id: "tk", title: "독성동태와 분석법" },
  { id: "special", title: "면역독성·광안전성" },
  { id: "product", title: "제품 유형별 기준" },
  { id: "glp", title: "GLP" },
];

export type LibDoc = {
  /** 화면용 짧은 이름. shortCite 결과와 같다. */
  short: string;
  /** 정식 이름 */
  name: string;
  /** 발행 기관 */
  by: string;
  /** 무엇을 다루는지 한 줄 */
  about: string;
  url: string;
  topic: string;
  products: Product[];
};

const ICH = "https://database.ich.org/sites/default/files/";
const LAW = "https://www.law.go.kr/";

export const LIBRARY: LibDoc[] = [
  // 시험 시기와 제출 자료
  { short: "ICH M3", name: "ICH M3(R2) 임상시험 및 품목허가를 위한 비임상 안전성시험", by: "ICH", about: "임상 단계별로 필요한 비임상 안전성시험의 종류와 시기", url: `${ICH}M3_R2__Guideline.pdf`, topic: "plan", products: ["drug", "bio"] },
  { short: "식약처 임상시험 승인 규정", name: "의약품 임상시험 계획 승인에 관한 규정", by: "식품의약품안전처 고시", about: "임상시험계획 승인을 신청할 때 내는 비임상 자료", url: `${LAW}행정규칙/의약품임상시험계획승인에관한규정`, topic: "plan", products: ["drug", "bio", "cgt"] },
  { short: "식약처 품목허가 규정", name: "의약품의 품목허가·신고·심사 규정", by: "식품의약품안전처 고시", about: "의약품 품목허가를 신청할 때 내는 안전성·유효성 자료", url: `${LAW}행정규칙/의약품의품목허가·신고·심사규정`, topic: "plan", products: ["drug"] },

  // 단회·반복투여독성
  { short: "식약처 독성시험기준", name: "의약품등의 독성시험기준", by: "식품의약품안전처 고시", about: "단회·반복투여, 유전, 생식, 발암성 등 독성시험의 방법과 동물 수", url: `${LAW}행정규칙/의약품등의독성시험기준`, topic: "general", products: ["drug", "bio"] },
  { short: "ICH S4", name: "ICH S4 동물 만성독성시험 기간(설치류·비설치류)", by: "ICH", about: "장기 반복투여독성시험의 설치류 6개월, 비설치류 9개월 기준", url: `${ICH}S4_Guideline.pdf`, topic: "general", products: ["drug"] },
  { short: "OECD TG", name: "OECD 화학물질 시험지침 4장(건강 영향)", by: "OECD", about: "급성·반복투여·유전·생식독성 등 시험 방법별 지침(TG 번호)", url: "https://www.oecd.org/en/publications/oecd-guidelines-for-the-testing-of-chemicals-section-4_20745788.html", topic: "general", products: ["drug", "hf", "cos", "chem"] },

  // 유전독성
  { short: "ICH S2", name: "ICH S2(R1) 의약품 유전독성시험과 결과 해석", by: "ICH", about: "복귀돌연변이, 염색체 이상, 체내 소핵 등 유전독성 시험 조합", url: `${ICH}S2_R1_Guideline.pdf`, topic: "geno", products: ["drug"] },

  // 안전성약리
  { short: "ICH S7A", name: "ICH S7A 의약품 안전성약리시험", by: "ICH", about: "중추신경, 심혈관, 호흡기를 보는 코어배터리", url: `${ICH}S7A_Guideline.pdf`, topic: "safety", products: ["drug", "bio"] },
  { short: "ICH S7B", name: "ICH S7B 심실 재분극 지연(QT 간격 연장) 평가", by: "ICH", about: "hERG 시험과 심혈관 원격측정으로 QT 지연 가능성 확인", url: `${ICH}S7B_Guideline.pdf`, topic: "safety", products: ["drug"] },

  // 생식발생독성
  { short: "ICH S5", name: "ICH S5(R3) 의약품 생식·발생독성 평가", by: "ICH", about: "수태능, 배·태자 발생, 출생 전후 발생 시험의 구성", url: `${ICH}S5-R3_Step4_Guideline_2020_0218_1.pdf`, topic: "repro", products: ["drug", "bio"] },

  // 발암성
  { short: "ICH S1A", name: "ICH S1A 의약품 발암성시험의 필요성", by: "ICH", about: "발암성시험이 필요한 경우와 시기", url: `${ICH}S1A_Guideline.pdf`, topic: "carc", products: ["drug"] },
  { short: "ICH S1B", name: "ICH S1B(R1) 의약품 발암성시험", by: "ICH", about: "설치류 발암성시험의 구성과 2년 랫드 시험 생략 판단", url: "https://www.ich.org/page/safety-guidelines", topic: "carc", products: ["drug"] },

  // 독성동태와 분석
  { short: "ICH S3A", name: "ICH S3A 독성시험의 전신 노출 평가(독성동태)", by: "ICH", about: "독성시험에서 함께 하는 TK 채혈과 노출 평가", url: `${ICH}S3A_Guideline.pdf`, topic: "tk", products: ["drug", "bio"] },
  { short: "ICH M10", name: "ICH M10 생체시료 분석법 밸리데이션", by: "ICH", about: "TK·PK 시료를 분석하는 방법의 밸리데이션 기준", url: `${ICH}M10_Guideline_Step4_2022_0524.pdf`, topic: "tk", products: ["drug", "bio"] },
  { short: "ICH Q2", name: "ICH Q2(R2) 분석법 밸리데이션", by: "ICH", about: "조제물분석(함량·균질성·안정성)에 쓰는 분석법의 밸리데이션 기준", url: `${ICH}ICH_Q2%28R2%29_Guideline_2023_1130.pdf`, topic: "tk", products: ["drug", "bio", "hf", "cos", "chem"] },
  { short: "ICH M12", name: "ICH M12 약물상호작용 시험", by: "ICH", about: "대사효소·수송체 기반 약물상호작용 평가", url: `${ICH}ICH_M12_Step4_Guideline_2024_0521.pdf`, topic: "tk", products: ["drug"] },

  // 면역독성·광안전성
  { short: "ICH S8", name: "ICH S8 의약품 면역독성시험", by: "ICH", about: "면역독성 평가가 필요한 경우와 방법. 바이오의약품은 대상이 아니에요", url: `${ICH}S8_Guideline_0.pdf`, topic: "special", products: ["drug"] },
  { short: "ICH S10", name: "ICH S10 의약품 광안전성 평가", by: "ICH", about: "빛에 노출될 때의 독성(광독성) 평가 여부와 방법", url: `${ICH}S10_Guideline.pdf`, topic: "special", products: ["drug"] },

  // 제품 유형별 기준
  { short: "ICH S6", name: "ICH S6(R1) 바이오의약품 비임상 안전성 평가", by: "ICH", about: "적절한 동물종 선택, 시험 기간, 유전독성 생략 등 바이오의약품 기준", url: `${ICH}S6_R1_Guideline_0.pdf`, topic: "product", products: ["bio"] },
  { short: "식약처 생물의약품 심사 규정", name: "생물학적제제 등의 품목허가·심사 규정", by: "식품의약품안전처 고시", about: "바이오의약품과 세포·유전자치료제 허가에 내는 자료", url: `${LAW}행정규칙/생물학적제제등의품목허가·심사규정`, topic: "product", products: ["bio", "cgt"] },
  { short: "ICH S12", name: "ICH S12 유전자치료제 비임상 체내분포", by: "ICH", about: "유전자치료제의 체내분포 시험 설계", url: `${ICH}ICH_S12_Step4_Guideline_2023_0314.pdf`, topic: "product", products: ["cgt"] },
  { short: "ICH S9", name: "ICH S9 항암제 비임상 평가", by: "ICH", about: "진행성 암 환자 대상 항암제의 비임상 시험 범위", url: `${ICH}S9_Guideline.pdf`, topic: "product", products: ["drug", "bio"] },
  { short: "ICH S11", name: "ICH S11 소아용 의약품 비임상 안전성", by: "ICH", about: "소아 임상을 위한 어린 동물 독성시험 여부와 설계", url: `${ICH}S11_Step4_FinalGuideline_2020_0310.pdf`, topic: "product", products: ["drug", "bio"] },
  { short: "식약처 건강기능식품 인정 규정", name: "건강기능식품 기능성 원료 및 기준·규격 인정에 관한 규정", by: "식품의약품안전처 고시", about: "기능성 원료 인정 신청 때 내는 안전성 자료", url: `${LAW}행정규칙/건강기능식품기능성원료및기준·규격인정에관한규정`, topic: "product", products: ["hf"] },
  { short: "식약처 기능성화장품 심사 규정", name: "기능성화장품 심사에 관한 규정", by: "식품의약품안전처 고시", about: "기능성화장품 심사에 내는 안전성 자료", url: `${LAW}행정규칙/기능성화장품심사에관한규정`, topic: "product", products: ["cos"] },
  { short: "식약처 화장품 원료 심사 규정", name: "화장품 원료 사용금지 해제·변경 및 사용기준 지정·변경 심사에 관한 규정", by: "식품의약품안전처 고시", about: "화장품 원료 사용기준 지정·변경 심사에 내는 자료", url: `${LAW}행정규칙/화장품원료사용금지해제·변경및사용기준지정·변경심사에관한규정`, topic: "product", products: ["cos"] },
  { short: "식약처 의료기기 생물학적 안전 기준", name: "의료기기의 생물학적 안전에 관한 공통기준규격", by: "식품의약품안전처 고시", about: "세포독성, 감작성, 자극성 등 의료기기 생물학적 안전성 시험", url: `${LAW}행정규칙/의료기기의생물학적안전에관한공통기준규격`, topic: "product", products: ["dev"] },
  { short: "농약 등록기준", name: "농약 및 원제의 등록기준", by: "농촌진흥청 고시", about: "농약 등록에 내는 독성 자료의 종류", url: `${LAW}행정규칙/농약및원제의등록기준`, topic: "product", products: ["chem"] },
  { short: "화평법 시행규칙", name: "화학물질의 등록 및 평가 등에 관한 법률 시행규칙", by: "환경부령", about: "화학물질 등록 때 톤수별로 내는 유해성 자료", url: `${LAW}법령/화학물질의등록및평가등에관한법률시행규칙`, topic: "product", products: ["chem"] },

  // GLP
  { short: "식약처 GLP 기준", name: "비임상시험관리기준", by: "식품의약품안전처 고시", about: "국내 비임상시험기관의 GLP 운영 기준", url: `${LAW}행정규칙/비임상시험관리기준`, topic: "glp", products: ["drug", "bio", "cgt", "hf", "cos", "dev"] },
  { short: "OECD GLP 원칙", name: "OECD GLP 원칙", by: "OECD", about: "국가 간에 시험 자료를 인정하는 GLP 공통 원칙", url: "https://www.oecd.org/en/publications/oecd-principles-on-good-laboratory-practice_9789264078536-en.html", topic: "glp", products: ["drug", "bio", "cgt", "hf", "cos", "dev", "chem"] },
];

/** 화면용 짧은 이름(예: "ICH M3", "OECD TG 471") → 자료실 문서. OECD TG 번호는 시험지침 묶음으로 잇는다. */
export function findDoc(short: string): LibDoc | undefined {
  const s = short.trim();
  if (/^OECD (TG|GL) /.test(s)) return LIBRARY.find((d) => d.short === "OECD TG");
  return LIBRARY.find((d) => d.short === s);
}

/** 자료실 안의 위치. 근거 표기에서 "자료실에서 보기"로 이을 때 쓴다. */
export function docAnchor(d: LibDoc): string {
  return `/guide/library#${d.topic}`;
}
