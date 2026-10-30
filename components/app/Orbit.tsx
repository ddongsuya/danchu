import type { Dot } from "@/lib/request-story";

/**
 * 궤도 그림 (랜딩 히어로의 궤도와 같은 결). 고리 하나 = 요청 하나, 점 하나 = 기관 하나.
 * 채운 점 견적 제출, 반 채운 점 참여, 빈 점 그 밖. 색은 portal.css 의 .rs-orb 클래스가 토큰으로 정한다.
 * 장식이 아니라 숫자를 그린 그림이라 aria-label 에 같은 숫자를 문장으로 적는다.
 */
export function Orbit({ rings, label, center }: { rings: { key: string; dots: Dot[]; late?: boolean; tag?: string }[]; label: string; center?: number }) {
  const c = 260;
  const many = rings.length > 1;
  const step = 190 / Math.max(rings.length, 1);
  return (
    <svg className="rs-orb" viewBox="0 0 520 520" role="img" aria-label={label}>
      {rings.map((ring, k) => {
        const rad = many ? 60 + step * (k + 1) - step / 2 : 170;
        const n = Math.max(ring.dots.length, 1);
        const r0 = many ? 9 : 11;
        return (
          <g key={ring.key}>
            <circle cx={c} cy={c} r={rad} className={ring.late ? "rs-orb__ring rs-orb__ring--late" : "rs-orb__ring"} />
            {ring.tag && <text x={c} y={c - rad + 18} textAnchor="middle" className="rs-orb__tag">{ring.tag}</text>}
            {ring.dots.map((d, i) => {
              // 여러 고리면 점을 위쪽 반원에 모아 고리끼리 겹치지 않게 한다
              const a = -Math.PI / 2 + (i + 0.5) * ((2 * Math.PI) / n) * (many ? 0.55 : 1) + k * 0.35;
              const x = c + rad * Math.cos(a);
              const y = c + rad * Math.sin(a);
              if (d === "f") return <circle key={i} cx={x} cy={y} r={r0} className="rs-orb__f" />;
              if (d === "h")
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={r0 - 1} className="rs-orb__h" />
                    <path d={`M${x} ${y - r0 + 1} a${r0 - 1} ${r0 - 1} 0 0 1 0 ${2 * (r0 - 1)}z`} className="rs-orb__fill" />
                  </g>
                );
              return <circle key={i} cx={x} cy={y} r={r0 - 2} className="rs-orb__w" />;
            })}
          </g>
        );
      })}
      {center != null && (
        <text x={c} y={c + 16} textAnchor="middle" className="rs-orb__n">
          {center}
        </text>
      )}
    </svg>
  );
}
