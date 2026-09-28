"use client";

import { InView } from "@/components/landing/InView";

/**
 * 마지막 CTA의 수렴 연출 — 옛 오프닝 인트로에서 가져왔다.
 * 회신 네 조각이 가운데로 모여 단추 마크의 구멍 네 개가 된다. 화면에 들어오면 한 번만 재생.
 */
export function Finale() {
  return (
    <InView className="fin" threshold={0.5}>
      <span className="fin__piece fin__piece--a" />
      <span className="fin__piece fin__piece--b" />
      <span className="fin__piece fin__piece--c" />
      <span className="fin__piece fin__piece--d" />
      <svg className="fin__mark" viewBox="0 0 28 28" aria-hidden="true">
        <circle className="fin__ring" cx="14" cy="14" r="13" />
        <circle className="fin__hole" cx="10" cy="10" r="1.9" />
        <circle className="fin__hole" cx="18" cy="10" r="1.9" />
        <circle className="fin__hole" cx="10" cy="18" r="1.9" />
        <circle className="fin__hole" cx="18" cy="18" r="1.9" />
      </svg>
      <span className="fin__word">여러 조각을 하나로</span>
    </InView>
  );
}
