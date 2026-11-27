import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";

/**
 * 운영자 화면 불러오기 뼈대 (시안 검토판 "최종 화면과 같은 자리에 회색 뼈대"). 0.3초 안에 끝나면 보이지 않는다 (DelayedSkeleton).
 * - list: 제목 줄 + 탭 + 표 행
 * - split: 제목 줄 + 탭 + 표 + 오른쪽 칸 (접수 · 요청 상세)
 */
export function AdminSkeleton({ kind = "list", label = "화면을 불러오는 중" }: { kind?: "list" | "split"; label?: string }) {
  const rows = Array.from({ length: 6 }, (_, i) => <div key={i} className="skel__bar skel__bar--row" />);
  return (
    <DelayedSkeleton label={label}>
      <div className="skel adm-skel" data-kind={kind}>
        <div className="skel__bar skel__bar--title" />
        <div className="skel__bar skel__bar--line" />
        <div className="adm-skel__body">
          <div className="skel__rows">{rows}</div>
          {kind === "split" && <div className="skel__bar adm-skel__side" />}
        </div>
      </div>
    </DelayedSkeleton>
  );
}
