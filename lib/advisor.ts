/**
 * 세미 컨설팅 — 의뢰자의 상황(물질·단계·임상 계획·보유 자료)을 묻고,
 * 공개 가이드라인에 근거해 시험 구성과 확인할 점을 제안한다.
 *
 * 원칙 (기술문서/10_질문흐름_설계_합성의약품.md)
 * - 중립: 가이드라인이 요구하는 것만 제안한다. 기관마다 다른 부분은 값을 정하지 않고 "기관에 물을 것"으로 넘긴다.
 * - 제안은 미리 채운 선택일 뿐이다. 의뢰자가 빼거나 더한다.
 * - 모든 제안과 안내에 근거 조항을 붙인다.
 *
 * 1차 범위: 합성의약품. 규칙 번호(R-…)는 기술 문서의 규칙과 같다.
 */
import { repeatDoseFor, type ClinDuration, type Stage as TableStage } from "./design-guide";
import type { Values } from "./rfq-schema";

export const ADVISOR_DISCLAIMER = "공개 가이드라인에 근거한 참고용 제안입니다. 최종 시험 구성과 설계는 시험기관 및 규제기관 상담으로 확정하세요.";

export type Answers = Record<string, string | string[] | undefined>;

export type Question = {
  id: string;
  step: 1 | 2 | 3;
  q: string;
  sub?: string;
  multi?: boolean;
  options: string[];
  required?: boolean;
  /** 앞 답에 따라 묻지 않는 경우 */
  when?: (a: Answers) => boolean;
};

export const PRODUCTS = ["합성의약품", "바이오의약품", "세포·유전자치료제", "건강기능식품", "화장품", "의료기기", "화학물질·농약"] as const;
/** 지금 제안을 만들 수 있는 유형 */
export const SUPPORTED_PRODUCTS: readonly string[] = ["합성의약품"];

const PRIOR = [
  "없음",
  "용량결정시험(DRF)",
  "반복투여 2주 (GLP)",
  "반복투여 4주 (GLP)",
  "반복투여 13주 (GLP)",
  "단회투여독성 (GLP)",
  "복귀돌연변이 (GLP)",
  "체외 염색체 손상 시험 (GLP)",
  "체내 소핵 (GLP)",
  "hERG (GLP)",
  "hERG (Non-GLP 선별)",
  "안전성약리 코어배터리 (GLP)",
  "생체시료 분석법 검증",
  "조제물 분석법 검증",
];

export const QUESTIONS: Question[] = [
  { id: "product", step: 1, q: "무엇을 개발하시나요?", options: [...PRODUCTS], required: true },
  { id: "stage", step: 1, q: "어느 단계를 준비하시나요?", sub: "단계에 따라 필요한 시험 범위가 달라집니다.", options: ["1상 진입", "2상", "3상", "품목허가", "자체 연구"], required: true },
  { id: "auth", step: 1, q: "어디에 제출하시나요?", sub: "해당하는 곳을 모두 고르세요.", multi: true, options: ["식약처", "미국 FDA", "유럽 EMA", "일본 PMDA", "기타"], required: true, when: (a) => a.stage !== "자체 연구" },
  { id: "indication", step: 1, q: "적응증은 어디에 해당하나요?", options: ["진행암", "중대하거나 생명을 위협하는 질환", "그 외"], required: true },
  { id: "route", step: 2, q: "임상 투여경로는 무엇인가요?", options: ["경구", "정맥", "피하", "근육", "국소 적용(피부·점안 등)", "흡입", "기타"], required: true },
  { id: "duration", step: 2, q: "임상에서 얼마나 투여할 예정인가요?", sub: "반복투여독성 기간을 정합니다.", options: ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과·만성", "미정"], required: true },
  { id: "freq", step: 2, q: "임상 투여 빈도는요?", options: ["1일 1회", "1일 2회 이상", "주 1회", "간헐", "지속주입", "미정"] },
  { id: "wocbp", step: 2, q: "임상에 가임 여성이 포함되나요?", options: ["예", "아니오", "미정"], required: true },
  { id: "prior", step: 3, q: "이미 가진 시험 자료를 모두 골라 주세요", sub: "가진 시험은 제안에서 제외합니다.", multi: true, options: PRIOR, required: true },
];

export function visibleQuestions(a: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.when || q.when(a));
}

/* ── 제안 ─────────────────────────────────────────────── */

export type Suggest = {
  /** 고유 키 */
  key: string;
  label: string;
  /** 요청서 대분류·세부 항목 (DETAILS 와 정확히 일치) */
  category: string;
  item: string;
  reason: string;
  basis: string;
  rule: string;
  /** 기본 포함 여부 */
  on: boolean;
  /** 요청서 세부 조건에 함께 채울 값 (대분류.필드id → 값) */
  fill?: Record<string, string | string[]>;
};

export type Note = { text: string; basis: string; rule: string };
export type Later = { label: string; when: string; basis: string };

export type Advice = {
  supported: boolean;
  message?: string;
  tests: Suggest[];
  owned: string[];
  later: Later[];
  notes: Note[];
  /** 가이드라인이 정하지 않아 기관 회신에서 확인할 항목 */
  askCro: string[];
  /** 독성시험 착수 전에 끝나야 하는 것 */
  prereq: string[];
};

const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const has = (a: Answers, id: string, v: string) => arr(a[id]).includes(v);

export function advise(a: Answers): Advice {
  const product = String(a.product ?? "");
  if (!SUPPORTED_PRODUCTS.includes(product)) {
    return {
      supported: false,
      message: `${product || "이 유형"}의 제안은 준비 중입니다. 지금은 시험 항목을 직접 골라 요청해 주세요. 패키지로 시작하면 항목을 한 번에 채울 수 있습니다.`,
      tests: [], owned: [], later: [], notes: [], askCro: [], prereq: [],
    };
  }

  const tests: Suggest[] = [];
  const notes: Note[] = [];
  const later: Later[] = [];
  const askCro = new Set<string>();
  const prereq: string[] = [];

  const stage = String(a.stage ?? "");
  const research = stage === "자체 연구";
  const approval = stage === "품목허가";
  const auth = arr(a.auth);
  const mfds = auth.includes("식약처");
  const overseas = auth.some((x) => x !== "식약처");
  const onc = a.indication === "진행암";
  const topical = String(a.route ?? "").startsWith("국소");
  const prior = arr(a.prior);
  const owned = prior.filter((p) => p !== "없음");
  const own = (s: string) => owned.some((p) => p.startsWith(s));
  const dur = String(a.duration ?? "미정");
  const glp = research ? "미정" : "GLP";

  /* ── 일반독성 ── */
  const tableStage: TableStage = approval ? "품목허가 신청" : "임상시험 진입";
  const repeatItems = dur === "미정" ? ["반복투여 4주"] : repeatDoseFor(dur as ClinDuration, tableStage).items;
  const species = ["랫드", "개(비글)"];

  if (dur === "미정") {
    notes.push({ text: "임상 투여기간이 정해지지 않아 1상에 흔한 4주로 제안했습니다. 1상이 2주 이내라면 2주 시험으로도 진입할 수 있지만, 이후 임상이 길어지면 시험을 다시 해야 합니다.", basis: "ICH M3(R2) 표 1", rule: "R-A1-03" });
  }
  const split = repeatItems.length === 2; // 만성: 설치류와 비설치류의 기간이 다르다
  for (const [i, it] of repeatItems.entries()) {
    const who = split ? (i === 0 ? "설치류" : "비설치류") : "설치류와 비설치류";
    const weeks = parseInt(it.replace(/\D/g, ""), 10);
    const already = own(`반복투여 ${weeks}주`);
    if (already) continue;
    const firstGlp = !own("반복투여");
    tests.push({
      key: `repeat-${weeks}`, label: `${it} · ${who}`, category: "일반독성", item: it,
      reason: approval ? "적응 투여기간에 맞는 허가용 반복투여독성" : "임상 투여기간 이상으로 두 종에서 표적 장기와 무독성량을 확인",
      basis: approval ? "ICH M3(R2) 표 2 · 고시 별표 2 ③" : "ICH M3(R2) 표 1 · 고시 별표 2 ③", rule: approval ? "R-A1-02" : "R-A1-01", on: true,
      fill: { "일반독성.species": split ? [species[i]] : species, "일반독성.tk": research ? "미정" : "포함", "일반독성.formulation": research ? "미정" : "포함", "일반독성.histopath": "포함", "일반독성.glpLevel": glp, "일반독성.recovery": firstGlp ? (weeks >= 13 ? "4주" : "2주") : "미정" },
    });
    if (firstGlp) notes.push({ text: "첫 GLP 반복투여독성이므로 회복 평가를 포함해 제안했습니다. 한 번 가역성을 확인하면 이후 시험에서는 생략할 수 있습니다.", basis: "고시 별표 2 ② 4 · ICH M3(R2) 질의응답 3장", rule: "R-A1-12" });
    if (weeks >= 13 && !own("반복투여")) notes.push({ text: `${weeks}주 시험을 하기 전에 더 짧은 반복투여독성시험이 먼저 필요합니다. 보유 자료가 없다면 4주 시험을 함께 검토하세요.`, basis: "고시 별표 2 ② 2", rule: "R-A1-04" });
  }
  if (!own("용량결정시험") && !own("반복투여")) {
    tests.push({ key: "drf", label: "용량결정시험(DRF) 2주", category: "일반독성", item: "용량결정(DRF) 2주", reason: "본시험의 고용량과 용량 간격을 정하는 예비시험", basis: "고시 별표 2 ② 3", rule: "R-A1-05", on: true });
    askCro.add("용량결정시험의 구성과 본시험 견적 포함 여부");
  }
  if (!own("단회투여독성") && !research) {
    if (mfds) {
      tests.push({ key: "single", label: "단회투여독성", category: "일반독성", item: "단회(급성)투여독성", reason: "식약처 제출. 독성시험기준의 시험 항목", basis: "고시 별표 1", rule: "R-A1-06", on: true });
      notes.push({ text: overseas ? "단회투여독성은 해외 제출에는 별도 시험이 권고되지 않습니다. 식약처 제출분은 용량결정시험으로 인정받을 수 있는지 제출 전에 확인하세요." : "용량결정시험을 단회투여독성으로 인정받을 수 있습니다. 제출 전에 식약처와 확인하면 별도 시험을 줄일 수 있습니다.", basis: "고시 별표 1 ① 1 · ICH M3(R2) §4", rule: "R-A1-06" });
    } else {
      tests.push({ key: "single", label: "단회투여독성", category: "일반독성", item: "단회(급성)투여독성", reason: "해외 제출만이면 별도 단회시험은 권고되지 않음", basis: "ICH M3(R2) §4", rule: "R-A1-07", on: false });
    }
  }
  if (tests.some((t) => t.key.startsWith("repeat"))) {
    askCro.add("회복 동물의 지정 방식과 투여 종료 시·회복 종료 시 부검 동물 수");
    askCro.add("조직병리 확대 판독과 특수염색의 견적 포함 여부");
    if (!research) {
      askCro.add("독성동태의 채혈 방식(위성군·미량채혈), 시점 수, 예상 검체 수");
      notes.push({ text: "독성동태를 반복투여독성에 병행하도록 제안했습니다. 투여 첫날과 종료 무렵에 평가합니다.", basis: "고시 별표 2 ⑤ · ICH S3A §4.3", rule: "R-B1-01" });
    }
  }
  if (a.freq === "지속주입") notes.push({ text: "지속주입은 카테터 수술과 전용 장비가 필요해 수행 가능한 기관이 제한됩니다.", basis: "", rule: "R-A1-17" });
  if (dur === "6개월 초과·만성") {
    notes.push({ text: auth.length === 1 && auth[0] === "유럽 EMA" ? "유럽 제출만이면 비설치류 만성시험은 6개월로 가능합니다." : "비설치류 만성시험은 9개월이 기준입니다. 면역원성, 간헐적 단기 노출 등 일부 경우에는 6개월이 인정됩니다.", basis: "ICH M3(R2) 표 1 주석 d · 고시 [주5]", rule: "R-A1-10" });
    if (a.indication !== "그 외") notes.push({ text: "중대하거나 생명을 위협하는 적응증은 만성시험 자료의 제출 시기가 완화될 수 있습니다.", basis: "ICH M3(R2) 표 1 주석 b", rule: "R-A1-11" });
  }

  /* ── 유전독성 ── */
  if (!research) {
    const single = dur === "단회";
    const full = stage !== "1상 진입" || a.wocbp === "예";
    if (!own("복귀돌연변이")) tests.push({ key: "ames", label: "복귀돌연변이(Ames)", category: "유전독성", item: "복귀돌연변이(Ames, TG 471)", reason: "유전자 돌연변이 평가. 첫 임상 전 필요", basis: "ICH M3(R2) §9 · 고시 별표 4", rule: "R-A4-02", on: true, fill: { "유전독성.glpLevel": "GLP" } });
    if (!own("체외 염색체 손상")) tests.push({ key: "invitro-ca", label: "체외 염색체 손상 시험 (염색체이상 또는 소핵)", category: "유전독성", item: "염색체이상 in vitro(TG 473)", reason: single && !full ? "단회 투여 임상은 복귀돌연변이로 진입할 수 있습니다. 반복 투여 임상 전에 필요" : "반복 투여 임상 전에 염색체 손상 평가가 필요", basis: "ICH M3(R2) §9", rule: single && !full ? "R-A4-02" : "R-A4-03", on: !(single && !full) });
    if (!own("체내 소핵")) {
      tests.push({ key: "invivo-mn", label: "체내 소핵", category: "유전독성", item: "소핵 in vivo(랫드)", reason: full ? "전체 배터리. 2상 전 또는 가임 여성 포함 전에 필요" : "전체 배터리는 2상 전까지. 반복투여독성에 통합하면 동물을 따로 쓰지 않습니다", basis: "ICH M3(R2) §9, §11.3 · ICH S2(R1) §4.3.2", rule: full ? "R-A4-04" : "R-A4-05", on: full });
      if (!full) later.push({ label: "유전독성 전체 배터리 (체내 시험 포함)", when: "2상 개시 전, 또는 가임 여성 포함 전", basis: "ICH M3(R2) §9" });
      notes.push({ text: "체내 소핵시험은 반복투여독성시험에 통합할 수 있습니다. 통합하려면 독성시험의 최고용량이 조건을 충족해야 하며, 임상 노출 배수만으로 정한 용량은 인정되지 않습니다.", basis: "ICH S2(R1) §4.3.2 · 고시 [주40]", rule: "R-A4-06" });
    }
    askCro.add("유전독성의 용량 설정 예비시험·확인 시험 포함 여부");
    // 진행암: 임상 진입에는 필수가 아니고 허가 신청 때 필요 (ICH S9 §2.6 — 조항 원문 재확인 대상)
    if (onc && !approval) {
      for (const t of tests) if (t.category === "유전독성") { t.on = false; t.reason = "진행암 환자 대상 임상에는 필수가 아닙니다. 허가 신청 때 필요"; t.basis = "ICH S9 §2.6"; t.rule = ""; }
      const i = later.findIndex((l) => l.label.startsWith("유전독성"));
      if (i >= 0) later.splice(i, 1);
      later.push({ label: "유전독성시험", when: "품목허가 신청 전", basis: "ICH S9 §2.6" });
    }
  }

  /* ── 안전성약리 ── */
  if (!research) {
    if (onc) {
      notes.push({ text: "진행암 환자 대상 항암제는 독립된 안전성약리시험이 요구되지 않습니다. 반복투여독성의 상세 임상 관찰과 비설치류 심전도로 평가합니다. 항암제는 기준(ICH S9)이 따로 있어 시험 구성 전반이 달라질 수 있습니다.", basis: "ICH S9 §2.2", rule: "R-A13-07" });
    } else if (topical) {
      notes.push({ text: "국소 적용제는 전신 노출이 낮음이 입증되면 안전성약리시험을 생략할 수 있습니다. 전신 노출 자료가 먼저 필요합니다.", basis: "ICH S7A §2.9", rule: "R-A13-09" });
    } else {
      if (!own("안전성약리 코어배터리")) {
        tests.push({ key: "sp-cns", label: "안전성약리 · 중추신경계", category: "안전성약리", item: "중추신경계(FOB)", reason: "코어배터리. 초회 사람 투여 전 필요", basis: "ICH S7A §2.7.1, §2.10.1", rule: "R-A13-01", on: true, fill: { "안전성약리.glpLevel": "GLP" } });
        tests.push({ key: "sp-resp", label: "안전성약리 · 호흡기계", category: "안전성약리", item: "호흡기계(Whole body plethysmography)", reason: "코어배터리. 호흡 기능은 정량 측정이 필요", basis: "ICH S7A §2.7.3", rule: "R-A13-01", on: true });
        tests.push({ key: "sp-cv", label: "안전성약리 · 심혈관계 (비설치류 텔레메트리)", category: "안전성약리", item: "심혈관계(Telemetry)", reason: "코어배터리. 혈압·심박수·심전도", basis: "ICH S7A §2.7.2 · ICH S7B §3.1.3", rule: "R-A13-01", on: true });
        notes.push({ text: "심혈관 시험은 비설치류로 합니다. 성체 랫드와 마우스는 QT 평가에 부적절합니다. 독성시험의 비설치류와 같은 종이 바람직합니다.", basis: "ICH S7B §3.1.3 · 질의응답 3.1", rule: "R-A13-03" });
        askCro.add("텔레메트리 동물 수와 설계(교차·병행), 노출 확인 포함 여부");
      }
      if (!own("hERG (GLP)")) {
        tests.push({ key: "herg", label: "hERG (체외)", category: "안전성약리", item: "hERG(in vitro)", reason: "심실 재분극 지연 평가. 체내 QT 시험과 함께 수행", basis: "ICH S7B §1.4", rule: "R-A13-01", on: true });
        if (own("hERG (Non-GLP")) notes.push({ text: "보유한 hERG 자료가 선별용이라 제출용 GLP 시험이 따로 필요합니다.", basis: "ICH S7B §1.4", rule: "R-A13-15" });
        askCro.add("hERG 방식(수동·자동), 농도 수, 농도 검증 포함 여부");
      }
      if (mfds) notes.push({ text: "국내 제출용 안전성약리 코어배터리는 GLP 자료여야 합니다.", basis: "의약품 품목허가·신고·심사 규정 제7조제5호", rule: "R-A13-02" });
    }
  }

  /* ── 분석 ── */
  const glpTox = !research && tests.some((t) => t.category === "일반독성" && t.on);
  if (glpTox) {
    if (!own("생체시료 분석법 검증")) {
      tests.push({ key: "ba-val", label: "생체시료 분석법 검증", category: "PK/TK/ADME·생체시료분석", item: "분석법 검증(Full)", reason: "독성동태 검체를 분석하려면 검증된 분석법이 필요", basis: "ICH M10 §1.3 · ICH S3A §3.10", rule: "R-B1-05", on: true });
      prereq.push("생체시료 분석법 검증 (독성시험 착수 전 완료)");
      askCro.add("생체시료 분석법 검증의 종류(전체·부분)와 횟수, 종별 구분");
    }
    tests.push({ key: "tk", label: "독성동태(TK) 검체 분석", category: "PK/TK/ADME·생체시료분석", item: "TK(독성동태)", reason: "동물의 실제 노출을 측정해 사람 노출과 비교", basis: "ICH S3A §2 · 고시 별표 2 ⑤", rule: "R-B1-01", on: true });
    tests.push({ key: "form-conc", label: "조제물분석 · 함량", category: "조제물분석", item: "함량", reason: "투여한 조제물의 농도 확인. GLP 시험에 따라옵니다", basis: "OECD GLP 원칙 II.6.2.5 · 비임상시험관리기준 제24조", rule: "R-B4-01", on: true });
    tests.push({ key: "form-stab", label: "조제물분석 · 안정성", category: "조제물분석", item: "안정성", reason: "조제 후 투여까지 농도가 유지되는지. 조제 주기를 정합니다", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-06", on: true });
    tests.push({ key: "form-homo", label: "조제물분석 · 균질성", category: "조제물분석", item: "균질성", reason: "현탁액 등 용액이 아닌 조제물에 필요. 진용액이면 빼세요", basis: "OECD GLP 원칙 II.6.2.5", rule: "R-B4-02", on: true });
    if (!own("조제물 분석법 검증")) prereq.push("조제물 분석법 검증 (독성시험 착수 전 완료)");
    prereq.push("조제물 안정성 확인 (결과에 따라 조제 주기가 정해짐)");
    askCro.add("조제물 분석법 검증 횟수와 구분 (체외 유전독성·체외 약리·체내 등 부형제별)");
    askCro.add("조제물분석의 허용 기준, 분석 횟수, 독성시험 금액 포함 여부");
    notes.push({ text: "분석법 검증은 부형제가 다르면 각각 필요합니다. 체외 시험과 체내 시험은 따로이며, 횟수는 기관마다 다릅니다. 회신에서 확인하세요.", basis: "기술문서 B4", rule: "R-B4-16" });
  }

  /* ── 나중 단계 ── */
  if (a.wocbp !== "예" && !research) later.push({ label: "배·태자 발생시험 등 생식·발생독성", when: "가임 여성을 임상에 포함하기 전", basis: "ICH M3(R2) §11" });
  if (a.wocbp === "예") notes.push({ text: "가임 여성이 임상에 포함되면 생식·발생독성시험의 시기를 검토해야 합니다. 이 부분의 상세 제안은 준비 중입니다.", basis: "ICH M3(R2) §11", rule: "" });
  if (!approval && !research && ["1개월 이내", "2주 이내", "단회", "미정"].includes(dur)) later.push({ label: "더 긴 반복투여독성 (13주 이상)", when: "임상 투여기간이 늘어날 때", basis: "ICH M3(R2) 표 1" });
  if (!research && stage !== "1상 진입") later.push({ label: "사람 주요 대사체의 노출 평가", when: "3상 전. 사람에서 총 노출의 10%를 넘는 대사체가 있을 때", basis: "ICH M3(R2) §3" });
  if (overseas) notes.push({ text: "해외 제출이 포함되어 있습니다. 영문 보고서가 필요한지, 미국 제출이면 SEND 자료가 필요한지 확인하세요.", basis: "", rule: "R-A1-21" });
  if (research) notes.push({ text: "자체 연구용으로 보고 GLP를 지정하지 않았습니다. 나중에 허가 자료로 쓰려면 GLP로 다시 해야 합니다.", basis: "", rule: "" });

  const seen = new Set<string>();
  const uniq = notes.filter((n) => !seen.has(n.text) && !!seen.add(n.text));
  return { supported: true, tests, owned, later, notes: uniq, askCro: [...askCro], prereq };
}

/* ── 요청서 값으로 옮기기 ─────────────────────────────── */

const AUTH_MAP: Record<string, string> = { "식약처": "식약처(MFDS)", "미국 FDA": "US FDA", "유럽 EMA": "EMA", "일본 PMDA": "PMDA(일본)", "기타": "기타" };
const ROUTE_MAP: Record<string, string> = { "경구": "경구(PO)", "정맥": "정맥(IV)", "피하": "피하(SC)", "근육": "근육(IM)", "국소 적용(피부·점안 등)": "경피·피부", "흡입": "흡입", "기타": "기타" };

/** 세부 항목 필드 id (일반독성은 items, 생식은 segment) */
const ITEMS_FIELD: Record<string, string> = { "생식발생독성": "segment" };

export function toRequestValues(a: Answers, advice: Advice, selected: Set<string>): Values {
  const v: Values = {};
  const add = (key: string, vals: string[]) => {
    const cur = Array.isArray(v[key]) ? (v[key] as string[]) : [];
    v[key] = [...new Set([...cur, ...vals])];
  };
  v.purpose = a.stage === "자체 연구" ? "자체 연구용" : "허가자료 제출용";
  v.devField = "의약품(합성)";
  const auth = arr(a.auth).map((x) => AUTH_MAP[x]).filter(Boolean);
  if (auth.length) v.authority = auth;
  const route = ROUTE_MAP[String(a.route ?? "")];
  if (route) { v.route = route; v.clinRoute = route; }
  if (a.duration && a.duration !== "미정") v.clinDuration = String(a.duration);
  if (auth.some((x) => x !== "식약처(MFDS)")) add("reportLang", ["영문"]);

  for (const t of advice.tests) {
    if (!selected.has(t.key)) continue;
    add("categories", [t.category]);
    if (t.item !== t.category) add(`${t.category}.${ITEMS_FIELD[t.category] ?? "items"}`, [t.item]);
    for (const [k, val] of Object.entries(t.fill ?? {})) {
      if (Array.isArray(val)) add(k, val);
      else if (v[k] === undefined) v[k] = val;
    }
  }

  // 기관과 의뢰자 화면에 함께 전달되는 기록
  v.advisorUsed = "예";
  v.advisorAnswers = visibleQuestions(a)
    .map((q) => { const x = arr(a[q.id]); return x.length ? `${q.q.replace(/\?$/, "")}: ${x.join(", ")}` : ""; })
    .filter(Boolean);
  v.advisorAsk = advice.askCro;
  v.advisorNotes = advice.notes.map((n) => (n.basis ? `${n.text} (${n.basis})` : n.text));
  v.advisorPrereq = advice.prereq;
  return v;
}
