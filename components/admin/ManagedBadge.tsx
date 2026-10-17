/** 운영자가 등록·관리하는 기관 표시 (담당자 계정 없음, 회신은 운영자가 기관 PDF 를 보고 대리 입력) */
export function ManagedBadge() {
  return <span className="pill pill--sf" style={{ marginLeft: 6 }} title="운영자가 등록한 기관입니다. 메일은 로그인 없는 회신 링크로 갑니다.">운영자 관리</span>;
}
