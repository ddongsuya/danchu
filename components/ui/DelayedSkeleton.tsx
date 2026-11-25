/**
 * 불러오기 뼈대 (시안 v7 2절). 처음 0.3초는 아무것도 보이지 않고, 그 뒤에 최종 화면 모양의 뼈대가 나타난다.
 * 빨리 끝나는 이동에서 깜빡임을 없앤다. 지연은 CSS 로 해서 자바스크립트가 늦게 떠도 같은 시각에 보인다(portal.css .ix-delay).
 * 화면 읽기 프로그램에는 label 을 한 번 알리고, 영역은 aria-busy 로 표시한다. 페이지 로딩에 원형 진행 표시는 쓰지 않는다.
 */
export function DelayedSkeleton({ label = "화면을 불러오는 중", children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="ix-delay" aria-busy="true">
      <span className="sr-only" role="status">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
