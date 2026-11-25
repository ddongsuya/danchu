import Link from "next/link";

type Kind = "first" | "filtered" | "denied";

const TITLE: Record<Kind, string> = {
  first: "아직 없습니다",
  filtered: "조건에 맞는 결과가 없습니다",
  denied: "볼 권한이 없습니다",
};

/**
 * 비어 있는 화면 (시안 v7 6절). 이유별로 나눈다. 제목 한 줄, 이유 한 줄, 다음 행동 하나.
 * - first: 처음이라 비어 있음. action 에 만들기 버튼 하나
 * - filtered: 검색·필터 결과 없음. clearHref 를 주면 "필터 지우기"
 * - denied: 권한 없음. action 에 요청 방법
 * 서버 화면에서도 쓸 수 있다 (클라이언트 코드 없음).
 */
export function EmptyState({ kind = "first", title, children, action, clearHref }: { kind?: Kind; title?: string; children?: React.ReactNode; action?: React.ReactNode; clearHref?: string }) {
  const act = action ?? (kind === "filtered" && clearHref ? <Link href={clearHref} className="b2 bsm">필터 지우기</Link> : null);
  return (
    <div className="empty ix-state" data-kind={kind}>
      <b>{title ?? TITLE[kind]}</b>
      {children && <p>{children}</p>}
      {act && <div className="ix-state__act">{act}</div>}
    </div>
  );
}
