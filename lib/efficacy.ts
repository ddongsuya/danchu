/**
 * 효력시험 — 질환 영역 분류와 비용 구분 (기술문서 D0).
 *
 * 단추가 정하는 것은 영역 분류와 비용을 나누는 틀까지다.
 * 모델과 설계는 기관이 등록하고 제안한다. 모델 예시는 국내 기관의 공개 자료에서 확인된 것이며 단추가 권하는 모델이 아니다.
 */

export const EFFICACY_CAT = "효력시험(약효)";

/** [질환 영역, 공개 자료에서 확인된 모델 예] */
export const AREAS: [string, string[]][] = [
  ["항암", ["이종이식(Xenograft)", "동종이식(Syngeneic)", "동소이식(Orthotopic)", "전이 모델", "인간화 마우스"]],
  ["대사·내분비", ["고지방식이 비만(DIO)", "ob/ob", "db/db", "STZ 유도 당뇨", "고지혈증", "통풍", "갱년기(OVX)"]],
  ["간", ["알코올성 지방간", "비알코올성 지방간", "지방간염(MCD·CDAHFD)", "간섬유화(CCl4·DMN·BDL)", "급성 간손상"]],
  ["신장·비뇨생식", ["신부전(신절제)", "당뇨병성 신증", "과민성 방광", "방광염", "전립선비대"]],
  ["심혈관·혈전", ["심부전(TAC)", "고혈압(SHR)", "혈전", "죽상동맥경화"]],
  ["호흡기", ["천식(OVA)", "만성폐쇄성폐질환·폐기종", "폐섬유화(bleomycin)", "기침·거담", "비염"]],
  ["소화기", ["대장염(DSS)", "위염·위궤양", "변비", "위장관 운동", "숙취"]],
  ["중추신경", ["치매(scopolamine)", "치매(Aβ·5xFAD)", "파킨슨(6-OHDA·MPTP)", "뇌졸중(MCAO)", "우울·스트레스", "간질"]],
  ["통증·염증", ["열판(Hot plate)", "포르말린", "신경병증성 통증(CCI)", "당뇨병성 신경병증", "수술 후 통증"]],
  ["관절·뼈·면역", ["류마티스(CIA·AIA)", "골관절염(MIA·ACLT)", "골다공증(OVX)", "면역증강"]],
  ["피부·모발", ["아토피(DNCB)", "건선", "창상·화상", "광노화", "탈모·발모", "주름·미백"]],
  ["안과", ["황반변성", "안구건조", "녹내장"]],
  ["감염", ["항균(MIC)", "항진균", "패혈증(LPS·CLP)", "감염 챌린지"]],
  ["기타·체외", ["치주염", "혈관신생", "근기능", "수면", "행동시험", "세포 기반 효능", "오가노이드"]],
];

export const AREA_NAMES = AREAS.map(([n]) => n);
export const modelsOf = (area: string): string[] => AREAS.find(([n]) => n === area)?.[1] ?? [];

/** 비용 구분 [저장 키, 이름, 들어가는 것] */
export const COST_PARTS: [string, string, string][] = [
  ["cost_animal", "동물·모델 유도", "동물, 순화, 질환 유도"],
  ["cost_dosing", "투여·관찰", "조제, 투여, 관찰, 사육"],
  ["cost_eval", "평가·분석", "기능 평가, 생화학, 영상"],
  ["cost_path", "병리", "부검, 조직 처리, 판독"],
  ["cost_report", "보고서·통계", "통계, 보고서, 원자료"],
];

export function costTotal(extra: Record<string, unknown>): number {
  return COST_PARTS.reduce((s, [k]) => s + (typeof extra[k] === "string" && /^\d+$/.test(extra[k] as string) ? Number(extra[k]) : 0), 0);
}

/** 비교표 표시용: 채워진 비용 구분만 [이름, 금액] */
export function costLines(extra: unknown): [string, string][] {
  if (!extra || typeof extra !== "object") return [];
  const e = extra as Record<string, unknown>;
  return COST_PARTS.flatMap(([k, label]) => (typeof e[k] === "string" && /^\d+$/.test(e[k] as string) && Number(e[k]) > 0 ? [[label, `${Number(e[k]).toLocaleString("ko-KR")}원`] as [string, string]] : []));
}
