import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";

/** 비교 보고서 뼈대: 제목 · 탭 · 도구 줄 · 표 (최종 화면과 같은 자리) */
export default function Loading() {
  return (
    <DelayedSkeleton label="비교 보고서 불러오는 중">
      <div className="skel">
        <div className="skel__bar skel__bar--title" />
        <div className="skel__bar skel__bar--line" />
        <div className="skel__bar" style={{ height: 36, width: "min(360px, 80%)" }} />
        <div className="skel__bar" style={{ height: "clamp(320px, 52vh, 560px)" }} />
      </div>
    </DelayedSkeleton>
  );
}
