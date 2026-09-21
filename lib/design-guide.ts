/**
 * 시험 설계 단서 — 의뢰자가 "무슨 시험을 어떤 설계로"에서 막힐 때 보여 주는 근거 있는 출발점.
 * 공개된 가이드라인(ICH, 식약처 고시, OECD TG)만 근거로 쓴다. 참고용이며 최종 설계는 기관·규제 상담으로 확정한다.
 *
 * 1차: 의약품. 건강기능식품·의료기기·화학물질은 검토 후 추가.
 */
import type { Values } from "./rfq-schema";

/** 운영자(실무자) 검토 전에는 공개 페이지를 검색에서 숨기고 메뉴에 걸지 않는다 */
export const GUIDE_REVIEWED = false;

export const DISCLAIMER = "참고용 안내입니다. 최종 시험 설계는 시험기관 및 규제기관 상담으로 확정하세요.";

/* ── 1. 임상 투여기간 → 반복투여독성 기간 (ICH M3(R2) 표 1·표 2) ─────────── */

export type ClinDuration = "단회" | "2주 이내" | "1개월 이내" | "3개월 이내" | "6개월 이내" | "6개월 초과·만성";
export const CLIN_DURATIONS: ClinDuration[] = ["단회", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 초과·만성"];
export type Stage = "임상시험 진입" | "품목허가 신청";

export type DurationAdvice = { rodent: string; nonRodent: string; items: string[]; note?: string };

/** 표 1: 임상시험을 뒷받침하는 최소 기간 / 표 2: 허가 신청 시 권장 기간 */
export function repeatDoseFor(clin: ClinDuration, stage: Stage): DurationAdvice {
  if (stage === "임상시험 진입") {
    switch (clin) {
      case "단회":
      case "2주 이내":
        return { rodent: "2주", nonRodent: "2주", items: ["반복투여 2주"], note: clin === "단회" ? "단회 임상은 지역에 따라 확장 단회투여독성시험으로 뒷받침할 수도 있습니다." : undefined };
      case "1개월 이내":
        return { rodent: "4주(1개월)", nonRodent: "4주(1개월)", items: ["반복투여 4주"] };
      case "3개월 이내":
        return { rodent: "13주(3개월)", nonRodent: "13주(3개월)", items: ["반복투여 13주"] };
      case "6개월 이내":
        return { rodent: "26주(6개월)", nonRodent: "26주(6개월)", items: ["반복투여 26주"] };
      case "6개월 초과·만성":
        return { rodent: "26주(6개월)", nonRodent: "39주(9개월)", items: ["반복투여 26주", "반복투여 39주"], note: "비설치류 9개월은 지역별 예외(6개월 인정 조건)가 있어 제출처와 확인이 필요합니다." };
    }
  }
  switch (clin) {
    case "단회":
    case "2주 이내":
      return { rodent: "1개월", nonRodent: "1개월", items: ["반복투여 4주"] };
    case "1개월 이내":
      return { rodent: "3개월", nonRodent: "3개월", items: ["반복투여 13주"] };
    case "3개월 이내":
      return { rodent: "6개월", nonRodent: "6개월", items: ["반복투여 26주"] };
    default:
      return { rodent: "6개월", nonRodent: "9개월", items: ["반복투여 26주", "반복투여 39주"] };
  }
}

export const M3_TABLE1: [string, string, string][] = [
  ["2주 이내", "2주", "2주"],
  ["2주 초과 ~ 6개월", "임상 기간과 같게", "임상 기간과 같게"],
  ["6개월 초과", "6개월", "9개월"],
];
export const M3_TABLE2: [string, string, string][] = [
  ["2주 이내", "1개월", "1개월"],
  ["2주 초과 ~ 1개월", "3개월", "3개월"],
  ["1개월 초과 ~ 3개월", "6개월", "6개월"],
  ["3개월 초과", "6개월", "9개월"],
];

/* ── 2. 패키지의 근거 ─────────────────────────────────────── */

export type PackageWhy = { presetKey: string; headline: string; basis: string[]; blocks: { t: string; why: string }[]; later: string[] };

export const PACKAGE_WHY: PackageWhy[] = [
  {
    presetKey: "ind_small",
    headline: "합성의약품이 사람에게 처음 투여되기 전에 확인해야 하는 것들입니다.",
    basis: ["ICH M3(R2) 비임상 안전성시험의 실시 시기", "ICH S7A·S7B 안전성약리", "ICH S2(R1) 유전독성", "ICH S3A 독성동태", "식약처 「의약품등의 독성시험기준」"],
    blocks: [
      { t: "반복투여독성 — 설치류 1종 + 비설치류 1종", why: "임상 투여기간 이상으로 두 종에서 독성 표적 장기와 무독성량(NOAEL)을 확인해 초회 임상 용량의 근거로 씁니다. 기간은 위의 기간 대응표를 따릅니다." },
      { t: "용량결정시험(DRF)", why: "본시험의 용량 단계를 정하기 위한 예비시험입니다. 보통 Non-GLP로 수행합니다." },
      { t: "단회투여독성", why: "급성 독성 정보를 얻습니다. ICH M3는 용량결정시험 등에서 같은 정보를 얻었다면 별도 시험을 요구하지 않으므로, 제출처 요구를 확인하고 포함 여부를 정합니다." },
      { t: "유전독성 — 복귀돌연변이 + 염색체이상(또는 in vitro 소핵)", why: "초회 임상 전에 유전자 돌연변이와 염색체 손상 평가가 필요합니다. in vivo 소핵은 반복투여독성에 통합하거나 2상 전까지 완료하는 구성이 일반적입니다." },
      { t: "안전성약리 코어배터리 — 중추신경계·심혈관계·호흡기계, hERG", why: "생명 유지 기능에 대한 영향을 초회 임상 전에 평가합니다. 심혈관계는 비설치류 텔레메트리와 in vitro hERG를 함께 봅니다." },
      { t: "독성동태(TK)와 조제물분석", why: "독성시험에서 실제 노출량을 확인해 사람 노출과 비교할 수 있게 합니다. GLP 독성시험은 투여 조제물의 함량·균질성·안정성 확인이 따라옵니다." },
    ],
    later: ["생식발생독성(가임 여성 포함 시점에 따라)", "발암성(장기 투여 의약품)", "국소내성(투여 경로에 따라 독성시험에 통합 가능)", "면역독성·광안전성(해당 시)"],
  },
  {
    presetKey: "ind_bio",
    headline: "바이오의약품은 약리학적으로 의미 있는 동물종에서만 평가한다는 점이 다릅니다.",
    basis: ["ICH S6(R1) 생물의약품의 비임상 안전성 평가", "ICH M3(R2)", "ICH S8 면역독성"],
    blocks: [
      { t: "관련 동물종 선정", why: "표적에 결합하고 약리 활성이 나타나는 종이어야 합니다. 관련 종이 하나뿐이면 1종 시험도 인정됩니다. 종 선정 근거(결합·활성 자료)를 먼저 준비하세요." },
      { t: "반복투여독성 + 회복군 + TK + 항약물항체(ADA)", why: "면역원성 때문에 노출이 떨어질 수 있어 TK와 ADA를 함께 봐야 결과를 해석할 수 있습니다." },
      { t: "안전성약리는 독성시험에 통합 가능", why: "ICH S6는 별도 시험 대신 반복투여독성시험 안에서 평가하는 것을 허용합니다." },
      { t: "유전독성은 통상 불필요", why: "DNA와 직접 반응하지 않는 단백질 의약품에는 표준 유전독성 배터리가 적용되지 않습니다. 링커·저분자 부분이 있으면 예외입니다." },
      { t: "국소내성·조직교차반응성", why: "주사제는 투여 부위 반응을 독성시험에서 함께 평가하고, 항체 의약품은 사람 조직 교차반응성 시험을 검토합니다." },
    ],
    later: ["생식발생독성(관련 종이 영장류뿐이면 ePPND 설계)", "발암성 평가(시험 대신 위해성 평가서로 대체하는 경우 많음)"],
  },
];

/* ── 3. 항목별 표준 설계 카드 (의약품 · 일반독성) ───────────────── */

export type DesignCard = {
  /** 요청서 세부 항목명 (정확히 일치) */
  items: string[];
  title: string;
  purpose: string;
  rows: [string, string][];
  basis: string[];
  /** "표준 설계로 요청" — 일반독성 세부 조건에 채울 값 (필드 id → 값) */
  fill: Record<string, string | string[]>;
};

export const DESIGN_CARDS: DesignCard[] = [
  {
    items: ["단회(급성)투여독성"],
    title: "단회투여독성",
    purpose: "한 번 투여했을 때의 독성 양상과 개략의 치사량을 봅니다.",
    rows: [
      ["동물종", "설치류 1종 + 비설치류 1종 (통상 랫드, 비글)"],
      ["동물 수", "설치류 군당 암수 각 5마리 이상, 비설치류 암수 각 2마리 이상"],
      ["용량", "설치류는 용량 단계별 군 구성, 비설치류는 같은 동물에 용량을 올려 가는 용량증량법"],
      ["관찰", "투여 후 14일, 일반증상·체중·부검"],
      ["GLP", "허가 제출용이면 GLP"],
    ],
    basis: ["식약처 「의약품등의 독성시험기준」", "ICH M3(R2) — 다른 시험에서 급성 독성 정보를 얻었다면 생략 가능"],
    fill: { species: ["랫드", "개(비글)"], method: ["ICH M3 단회 설계"], glpLevel: "GLP", recovery: "없음", tk: "미포함" },
  },
  {
    items: ["용량결정(DRF) 1주", "용량결정(DRF) 2주", "용량결정(DRF) 4주"],
    title: "용량결정시험(DRF)",
    purpose: "본시험의 고용량과 용량 간격을 정하기 위한 예비시험입니다.",
    rows: [
      ["동물종", "본시험과 같은 종·계통"],
      ["동물 수", "설치류 군당 암수 각 3~5마리, 비설치류 암수 각 1~2마리 수준"],
      ["평가", "일반증상·체중·사료섭취·임상병리·부검. 조직병리는 선택"],
      ["TK", "본시험 채혈 시점을 잡기 위해 소규모로 병행하기도 합니다"],
      ["GLP", "보통 Non-GLP"],
    ],
    basis: ["ICH M3(R2)", "식약처 「의약품등의 독성시험기준」 해설"],
    fill: { glpLevel: "Non-GLP", recovery: "없음", histopath: "미정", method: ["ICH M3/S4 반복투여"] },
  },
  {
    items: ["반복투여 1주", "반복투여 2주", "반복투여 4주"],
    title: "반복투여독성 (2~4주)",
    purpose: "초회 임상(1상)을 뒷받침하는 핵심 시험입니다. 표적 장기와 무독성량(NOAEL)을 확인합니다.",
    rows: [
      ["동물종", "설치류 1종 + 비설치류 1종"],
      ["군 구성", "대조군 + 3용량 이상"],
      ["동물 수", "설치류 군당 암수 각 10마리 이상, 비설치류 암수 각 3마리 이상"],
      ["회복군", "대조군과 고용량군에 추가(통상 설치류 암수 각 5, 비설치류 각 2). 회복 기간 2~4주"],
      ["TK", "병행. 설치류는 위성군으로 채혈하는 경우가 많습니다"],
      ["평가", "일반증상, 체중, 사료섭취, 안과검사, 임상병리, 뇨검사, 부검, 장기중량, 조직병리(검경 포함)"],
      ["GLP", "GLP"],
    ],
    basis: ["식약처 「의약품등의 독성시험기준」", "ICH M3(R2)", "ICH S3A 독성동태"],
    fill: { species: ["랫드", "개(비글)"], recovery: "2주", tk: "포함", formulation: "포함", histopath: "포함", glpLevel: "GLP", method: ["ICH M3/S4 반복투여"] },
  },
  {
    items: ["반복투여 13주"],
    title: "반복투여독성 (13주)",
    purpose: "3개월까지의 임상 또는 1개월 이내 의약품의 허가 신청을 뒷받침합니다.",
    rows: [
      ["동물종", "설치류 1종 + 비설치류 1종"],
      ["군 구성", "대조군 + 3용량 이상"],
      ["동물 수", "설치류 군당 암수 각 10마리 이상, 비설치류 암수 각 3~4마리"],
      ["회복군", "대조군과 고용량군에 추가, 회복 기간 4주가 일반적"],
      ["TK", "병행 (투여 첫날과 마지막 주)"],
      ["GLP", "GLP"],
    ],
    basis: ["식약처 「의약품등의 독성시험기준」", "ICH M3(R2)"],
    fill: { species: ["랫드", "개(비글)"], recovery: "4주", tk: "포함", formulation: "포함", histopath: "포함", glpLevel: "GLP", method: ["ICH M3/S4 반복투여"] },
  },
  {
    items: ["반복투여 26주", "반복투여 39주", "반복투여 52주"],
    title: "만성 반복투여독성 (26주 이상)",
    purpose: "6개월을 넘는 임상과 장기 투여 의약품의 허가 신청을 뒷받침합니다.",
    rows: [
      ["기간", "설치류 6개월(26주), 비설치류 9개월(39주)이 ICH 기준"],
      ["동물 수", "설치류 군당 암수 각 10마리 이상(중간 부검을 두면 추가), 비설치류 암수 각 4마리 수준"],
      ["회복군", "대조군과 고용량군에 추가"],
      ["TK", "병행"],
      ["GLP", "GLP"],
    ],
    basis: ["ICH M3(R2)", "ICH S4 만성독성시험 기간", "식약처 「의약품등의 독성시험기준」"],
    fill: { recovery: "4주", tk: "포함", formulation: "포함", histopath: "포함", glpLevel: "GLP", method: ["ICH M3/S4 반복투여"] },
  },
];

export function cardsFor(items: string[]): DesignCard[] {
  return DESIGN_CARDS.filter((c) => c.items.some((i) => items.includes(i)));
}

/* ── 4. 용어 풀이 ─────────────────────────────────────────── */

export const GLOSSARY: [string, string][] = [
  ["GLP", "비임상시험관리기준. 허가 자료로 쓰려면 GLP 인증 기관에서 GLP로 수행해야 합니다."],
  ["TK (독성동태)", "독성시험 동물의 혈중 약물 농도를 측정해 실제 노출량을 확인합니다. 사람 노출과 비교하는 근거가 됩니다."],
  ["회복군", "투여를 멈춘 뒤 독성 변화가 회복되는지 보기 위해 대조군과 고용량군에 추가하는 동물입니다."],
  ["위성군", "TK 채혈처럼 본시험 동물에 부담을 주는 조작을 따로 하기 위해 두는 추가 동물입니다."],
  ["NOAEL (무독성량)", "유해한 영향이 관찰되지 않은 최대 용량. 초회 임상 용량 산정의 출발점입니다."],
  ["DRF (용량결정시험)", "본시험의 용량을 정하기 위한 예비시험. 보통 Non-GLP입니다."],
  ["조제물분석", "동물에 투여한 조제물의 함량·균질성·안정성을 확인하는 분석. GLP 독성시험에 따라옵니다."],
  ["조직병리", "장기를 현미경으로 검사하는 평가. 단추 양식에서는 검경까지 포함을 기본으로 봅니다."],
];

/* ── 5. 입력 점검 (막지 않고 알려만 준다) ─────────────────────── */

const REPEAT_WEEKS: Record<string, number> = { "반복투여 1주": 1, "반복투여 2주": 2, "반복투여 4주": 4, "반복투여 13주": 13, "반복투여 26주": 26, "반복투여 39주": 39, "반복투여 52주": 52 };
const NEED_WEEKS: Record<string, number> = { "단회": 2, "2주 이내": 2, "1개월 이내": 4, "3개월 이내": 13, "6개월 이내": 26, "6개월 초과·만성": 26 };

export function requestChecks(v: Values): string[] {
  const out: string[] = [];
  const arr = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const cats = arr("categories");
  const forApproval = str("purpose") === "허가자료 제출용";

  if (forApproval) {
    const nonGlp = cats.filter((c) => str(`${c}.glpLevel`) === "Non-GLP");
    if (nonGlp.length) out.push(`허가자료 제출용인데 ${nonGlp.join(", ")}을(를) Non-GLP로 선택했습니다. 용량결정시험이 아니라면 GLP가 필요합니다.`);
  }

  const overseas = arr("authority").filter((a) => /FDA|EMA|PMDA|NMPA|EPA|OECD/.test(a));
  if (overseas.length && !arr("reportLang").includes("영문") && !arr("reportTrans").includes("영문")) {
    out.push(`제출처에 ${overseas.join(", ")}이(가) 있는데 영문 보고서가 선택되지 않았습니다. 상세 조건의 보고서 언어를 확인하세요.`);
  }

  const items = arr("일반독성.items");
  const clin = str("clinDuration");
  const repeat = items.filter((i) => i in REPEAT_WEEKS);
  if (clin in NEED_WEEKS && repeat.length) {
    const longest = Math.max(...repeat.map((i) => REPEAT_WEEKS[i]));
    if (longest < NEED_WEEKS[clin]) out.push(`임상 예정 투여기간이 "${clin}"이면 임상시험 진입에 ${NEED_WEEKS[clin]}주 이상의 반복투여독성이 필요합니다(ICH M3). 지금 선택한 가장 긴 시험은 ${longest}주입니다.`);
  }
  if (forApproval && repeat.some((i) => REPEAT_WEEKS[i] >= 2) && str("일반독성.tk") === "미포함") {
    out.push("반복투여독성에서 TK를 미포함으로 두었습니다. 허가 제출용이면 노출 확인을 위해 TK를 병행하는 것이 일반적입니다(ICH S3A).");
  }
  if (repeat.length && cats.includes("일반독성") && /의약품/.test(str("devField")) && !cats.includes("유전독성") && !cats.includes("안전성약리")) {
    out.push("의약품의 임상 진입용이라면 유전독성과 안전성약리도 함께 필요합니다. 이미 확보했다면 무시하세요.");
  }
  return out;
}
