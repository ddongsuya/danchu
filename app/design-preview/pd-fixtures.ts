/** 효력 모델 표준 검토 화면 예시 (시안 v15 와 같은 값). 실제 기관 단가가 아니다 */
import type { CatalogRow } from "@/lib/catalog";
import type { PdDesign } from "@/lib/kind-design";
import type { PriceItem } from "@/lib/price-book";

const item = (id: string, category: PriceItem["category"], name: string, unit: PriceItem["unit"], price: number, attrs: Record<string, string> = {}): PriceItem => ({ id, category, name, attrs, unit, price, memo: "", sort: 0, archived: false });

export const PD_ITEMS: PriceItem[] = [
  item("c57", "animal", "마우스 C57BL/6 수컷 8주", "head", 38_000, { species: "마우스", strain: "C57BL/6", sex: "수컷", weeks: "8" }),
  item("house", "housing", "마우스 SPF", "head_day", 2_500, { species: "마우스", condition: "SPF" }),
  item("dss", "model", "DSS 대장염 화학 유발 포함", "head", 20_000, { model: "DSS 대장염", method: "화학 유발", reagent: "포함" }),
  item("po", "dosing", "경구 소동물", "head_time", 3_000, { route: "경구", size: "소동물" }),
  item("pc", "dosing", "양성대조물질 구입", "lot", 400_000, { route: "양성대조물질 구입" }),
  item("bw", "observe", "체중", "head_time", 500, { item: "체중" }),
  item("dai", "observe", "임상 점수 DAI", "head_time", 1_500, { item: "임상 점수", method: "DAI" }),
  item("colon", "observe", "대장 길이", "head", 5_000, { item: "대장 길이" }),
  item("necro", "observe", "부검", "head", 20_000, { item: "부검" }),
  item("elisa", "molecular", "ELISA 혈청", "sample_item", 30_000, { method: "ELISA", matrix: "혈청" }),
  item("he", "pathology", "H&E 1 포함", "head", 60_000, { stain: "H&E", organs: "1", reading: "포함" }),
  item("read", "pathology", "판독·병리 보고", "lot", 2_000_000),
  item("rep", "report", "최종 보고서 국문", "lot", 3_000_000, { item: "최종 보고서", lang: "국문" }),
];

const g = (id: string, label: string, role: PdDesign["groups"][number]["role"], induce: string, treat: string, dose: string) => ({ id, label, role, induce, treat, dose, n: 8 });

export const PD_MODEL: PdDesign = {
  model: "DSS 유도 대장염",
  induction: "DSS 3%, 음수 7일",
  brief: { animal: "C57BL/6 마우스, 수컷 8주령", dosing: "경구, 1일 1회, 10일", period: "순화 7일 + 시험 11일" },
  groups: [
    g("g1", "정상군", "normal", "없음", "없음", ""),
    g("g2", "부형제군", "vehicle", "DSS", "부형제", ""),
    g("g3", "양성대조군", "positive", "DSS", "양성대조물질", "모델 기준"),
    g("g4", "시험물질 저용량군", "test", "DSS", "시험물질", "의뢰자 지정"),
    g("g5", "시험물질 고용량군", "test", "DSS", "시험물질", "의뢰자 지정"),
  ],
  lanes: [],
  days: [
    { id: "d1", name: "순화", from: -7, to: -1, mark: "bar" },
    { id: "d2", name: "DSS 3% 음수", from: 0, to: 6, mark: "bar" },
    { id: "d3", name: "시험물질 투여", from: 0, to: 9, mark: "bar" },
    { id: "d4", name: "체중, DAI", from: 0, to: 10, mark: "dots" },
    { id: "d5", name: "부검, 채혈", from: 10, to: 10, mark: "point" },
  ],
  evals: [
    { id: "e1", item: "체중", when: "D0~D10", freq: "하루 1회", method: "전자저울", target: "전 군" },
    { id: "e2", item: "질환 활성 점수(DAI)", when: "D0~D10", freq: "하루 1회", method: "체중 감소·변 굳기·혈변 0~4점 합산", target: "전 군" },
    { id: "e3", item: "대장 길이", when: "D10", freq: "1회", method: "맹장에서 항문까지 측정", target: "전 군" },
    { id: "e4", item: "조직병리", when: "D10", freq: "1회", method: "원위 대장 H&E, 염증·궤양 점수", target: "전 군" },
    { id: "e5", item: "사이토카인 ELISA", when: "D10", freq: "1회", method: "혈청 IL-6, TNF-α, IL-1β", target: "전 군", optional: true },
  ],
  uses: [
    { itemId: "c57", who: "all", times: 1, per: 1, label: "동물" },
    { itemId: "house", who: "all", times: 17, per: 1, label: "사육" },
    { itemId: "dss", who: "induced", times: 1, per: 1, label: "DSS 유발" },
    { itemId: "po", who: "dosed", times: 10, per: 1, label: "경구 투여" },
    { itemId: "pc", who: "none", times: 1, per: 1, label: "양성대조물질" },
    { itemId: "bw", who: "all", times: 11, per: 1, label: "체중" },
    { itemId: "dai", who: "all", times: 11, per: 1, label: "DAI" },
    { itemId: "colon", who: "all", times: 1, per: 1, bucket: "cost_eval", label: "대장 길이" },
    { itemId: "necro", who: "all", times: 1, per: 1, bucket: "cost_path", label: "부검" },
    { itemId: "he", who: "all", times: 1, per: 1, label: "H&E 염색" },
    { itemId: "read", who: "none", times: 1, per: 1, label: "판독·병리 보고" },
    { itemId: "rep", who: "none", times: 1, per: 1, label: "최종 보고서" },
  ],
  endpoints: [],
  costs: { cost_animal: null, cost_dosing: null, cost_eval: null, cost_path: null, cost_report: null },
  perGroup: { cost_animal: null, cost_dosing: null, cost_eval: null, cost_path: null, cost_report: null },
  perAnimal: null,
};

export const PD_ROW: CatalogRow = {
  id: "preview-dss", item_key: "preview", category: "효력시험", item: "소화기", available: true, glp: "Non-GLP", species: ["마우스"], route: "경구", routes: ["경구"],
  method: "DSS 유도 대장염", groups_ctrl: null, groups_test: null, per_sex: null, recovery_weeks: null, recovery_per_sex: null, dosing: null, weeks: 8,
  includes: [], options: [], unit: "total", price_min: null, price_max: null, extra: {}, kd: { pd: PD_MODEL },
  note: null, last_amount: null, last_weeks: null, last_quoted_at: null, source: "manual", sort: 0, std_price: null,
};
