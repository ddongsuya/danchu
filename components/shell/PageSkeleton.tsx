import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";

/**
 * 로그인 후 화면을 여는 동안 보이는 자리 표시 (app/app·cro·admin 의 loading.tsx).
 * 0.3초 안에 화면이 오면 아무것도 보이지 않고, 넘으면 뼈대가 나타난다 (DelayedSkeleton).
 * 모양은 세 역할 홈의 첫 장면(제목 → 요약 → 목록)과 같게 둔다.
 */
export function PageSkeleton() {
  return (
    <DelayedSkeleton>
      <div className="skel">
        <div className="skel__bar skel__bar--title" />
        <div className="skel__bar skel__bar--line" />
        <div className="skel__bar skel__bar--hero" />
        <div className="skel__rows">
          <div className="skel__bar skel__bar--row" />
          <div className="skel__bar skel__bar--row" />
          <div className="skel__bar skel__bar--row" />
        </div>
      </div>
    </DelayedSkeleton>
  );
}
