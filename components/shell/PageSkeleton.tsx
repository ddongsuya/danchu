/**
 * 로그인 후 화면을 여는 동안 보이는 자리 표시 (app/app·cro·admin 의 loading.tsx).
 * 메뉴를 누르자마자 이 모양이 먼저 뜨고, 서버 응답이 오면 실제 화면으로 바뀐다.
 * 모양은 세 역할 홈의 첫 장면(제목 → 요약 → 목록)과 같게 둔다.
 */
export function PageSkeleton() {
  return (
    <div className="skel" role="status" aria-live="polite">
      <span className="sr-only">화면을 불러오는 중</span>
      <div className="skel__bar skel__bar--title" />
      <div className="skel__bar skel__bar--line" />
      <div className="skel__bar skel__bar--hero" />
      <div className="skel__rows">
        <div className="skel__bar skel__bar--row" />
        <div className="skel__bar skel__bar--row" />
        <div className="skel__bar skel__bar--row" />
      </div>
    </div>
  );
}
