import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";

/** 요청 진행 뼈대: 단계 줄 · 제목 · 상태 띠 · 두 열 카드 (최종 화면과 같은 자리) */
export default function Loading() {
  return (
    <DelayedSkeleton label="진행 상황 불러오는 중">
      <div className="skel">
        <div className="skel__bar" style={{ height: 44 }} />
        <div className="skel__bar skel__bar--title" />
        <div className="skel__bar" style={{ height: 56 }} />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px)", gap: 16 }}>
          <div className="skel__bar" style={{ height: 320 }} />
          <div className="skel__bar" style={{ height: 220 }} />
        </div>
      </div>
    </DelayedSkeleton>
  );
}
