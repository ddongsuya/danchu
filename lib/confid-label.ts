/** 의뢰자 화면의 공개 범위 짧은 이름 (시안 검토판: CDA 없이 · 단추 표준 CDA · 자체 CDA). 저장 값은 lib/request-policy CONFIDENTIALITY_OPTIONS 그대로 */
export const CONFID_LABEL: Record<string, string> = {
  일반: "CDA 없이",
  "CDA 필요 (단추 표준 CDA)": "단추 표준 CDA",
  "자체 CDA 사용": "자체 CDA",
};
