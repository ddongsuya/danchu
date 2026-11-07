import type { CatalogRow } from "@/lib/catalog";

/**
 * 갈래별 견적서·시험 목록 검토 화면이 함께 쓰는 예시 줄 (효력·약동학·개별 분석).
 * 금액은 계산 확인용 가상의 값이다. 어느 기관의 실제 단가도 아니다.
 */
export function kindRows(mk: (cat: string, item: string, id: string, p: Partial<CatalogRow>) => CatalogRow) {
  const pd = mk("효력시험(약효)", "소화기", "00000000-0000-4000-8000-000000000021", {
    species: ["C57BL/6 마우스"], route: "경구(PO)", routes: ["경구(PO)"], method: "대장염(DSS)", weeks: 6,
    kd: { pd: {
      model: "대장염(DSS)", induction: "DSS 3% 음수 7일", endpoints: ["체중", "질병활성지수(DAI)", "대장 길이", "조직병리 점수"],
      groups: [
        { id: "g1", label: "정상군", role: "normal", treat: "유발 없음", n: 8, dose: "" },
        { id: "g2", label: "부형제군", role: "vehicle", treat: "DSS 유발 후 부형제", n: 8, dose: "" },
        { id: "g3", label: "양성대조군", role: "positive", treat: "DSS 유발 후 기준물질", n: 8, dose: "" },
        { id: "g4", label: "시험물질군", role: "test", treat: "DSS 유발 후 시험물질", n: 8, dose: "" },
      ],
      lanes: [{ id: "l1", name: "순화", start: 0, weeks: 1 }, { id: "l2", name: "유발 (DSS)", start: 1, weeks: 1 }, { id: "l3", name: "투여", start: 1, weeks: 2 }, { id: "l4", name: "부검", start: 3, weeks: 1, point: true }],
      costs: { cost_animal: 7_200_000, cost_dosing: 4_000_000, cost_eval: 3_600_000, cost_path: 4_800_000, cost_report: 3_000_000 },
      perGroup: { cost_animal: null, cost_dosing: 1_000_000, cost_eval: null, cost_path: 1_200_000, cost_report: null },
      perAnimal: 60_000,
    } },
    options: [{ name: "사이토카인 5종", amount: 3_000_000 }],
  });
  const pk = mk("PK/TK/ADME·생체시료분석", "PK(약물동태)", "00000000-0000-4000-8000-000000000022", {
    species: ["SD 랫드"], route: "경구(PO)", routes: ["경구(PO)", "정맥(IV)"], weeks: 8, unit: "per_sample",
    kd: { pk: { types: ["단회 PK"], groups: [{ id: "g1", label: "정맥군", route: "정맥(IV)", dose: "1 mg/kg", n: 3 }, { id: "g2", label: "경구군", route: "경구(PO)", dose: "10 mg/kg", n: 3 }], times: ["5분", "15분", "30분", "1시간", "2시간", "4시간", "8시간", "24시간"], matrix: ["혈장"], method: "", params: ["Cmax", "Tmax", "AUC", "T½"], animal: 6_000_000, perSample: 45_000, dev: 6_000_000, report: 2_500_000 } },
  });
  const other = mk("기타(임상병리·조직병리 등)", "조직병리", "00000000-0000-4000-8000-000000000023", { species: ["SD 랫드"], weeks: 4, unit: "per_sample", kd: { other: { sample: "랫드 간·신장", n: 20, perSample: 60_000, setup: 300_000, report: 800_000 } } });
  const otherNew = mk("기타(임상병리·조직병리 등)", "임상병리", "00000000-0000-4000-8000-000000000024", { species: ["SD 랫드"], weeks: 3, unit: "per_sample" });
  return { pd, pk, other, otherNew };
}
