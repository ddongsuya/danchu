import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";
import "./board.css";

/**
 * 기관 화면 불러오는 중 (시안 검토판 c-req~load · c-r~load · c-reply~load). 최종 화면과 같은 자리에 회색 뼈대.
 * board: 제목 줄 + 탭 + 거르기 + 표 + 오른쪽 상세. page: 제목 줄 + 본문 + 오른쪽 칸 (요청 상세 · 회신 쓰기).
 */
export function CroSkeleton({ kind, label }: { kind: "board" | "page"; label: string }) {
  const rows = Array.from({ length: kind === "board" ? 6 : 4 }, (_, i) => <div key={i} className="skel__bar cs-row" />);
  return (
    <DelayedSkeleton label={label}>
      <div className="cs">
        <div className="cs-head">
          <div className="skel__bar cs-title" />
          {kind === "board" && <div className="skel__bar cs-seg" />}
        </div>
        {kind === "board" && <div className="skel__bar cs-flt" />}
        <div className="cs-split">
          <div className="cs-main">{rows}</div>
          <div className="cs-side">
            <div className="skel__bar cs-card" />
            <div className="skel__bar cs-btn" />
          </div>
        </div>
      </div>
    </DelayedSkeleton>
  );
}
