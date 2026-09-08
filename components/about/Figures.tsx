/**
 * 서비스 소개 도해 — 브랜드 토큰으로 그린 벡터 이미지.
 * 텍스트는 페이지 폰트를 그대로 쓰고, 폭에 맞춰 늘어난다.
 */

const F = { ink: "var(--ink)", body: "var(--body)", muted: "var(--muted)", ph: "var(--placeholder)", brand: "var(--brand)", tint: "var(--brand-tint)", line: "var(--card-line)", track: "var(--track)", white: "var(--white)", surface: "var(--surface)" };

function Cap({ children }: { children: React.ReactNode }) {
  return <figcaption className="fig__cap">{children}</figcaption>;
}

/** 1. 지금 방식 vs 단추 — 흩어진 왕복 vs 한 줄 흐름 */
export function FigBeforeAfter() {
  const croY = [40, 92, 144, 196];
  return (
    <figure className="fig">
      <svg viewBox="0 0 760 300" role="img" aria-labelledby="fig1t" className="fig__svg">
        <title id="fig1t">지금은 기관마다 따로 연락하고 제각각 양식의 견적을 받지만, 단추는 한 번 요청해 같은 형식의 비교표를 받습니다</title>

        {/* 왼쪽: 지금 */}
        <text x="0" y="14" fontSize="13" fontWeight="700" fill={F.muted}>지금</text>
        <rect x="0" y="28" width="352" height="256" rx="16" fill={F.white} stroke={F.line} />
        <rect x="24" y="120" width="92" height="60" rx="10" fill={F.surface} stroke={F.line} />
        <text x="70" y="147" fontSize="12" fontWeight="700" fill={F.ink} textAnchor="middle">의뢰자</text>
        <text x="70" y="164" fontSize="11" fill={F.muted} textAnchor="middle">담당자 1명</text>
        {croY.map((y, i) => (
          <g key={y}>
            <path d={`M116 150 C 170 150, 180 ${y + 20}, 226 ${y + 20}`} fill="none" stroke={F.ph} strokeWidth="1.2" strokeDasharray="4 4" />
            <path d={`M226 ${y + 26} C 180 ${y + 26}, 170 156, 116 156`} fill="none" stroke={F.ph} strokeWidth="1.2" strokeDasharray="4 4" />
            <rect x="226" y={y} width="102" height="40" rx="9" fill={F.white} stroke={F.line} />
            <text x="240" y={y + 24} fontSize="12" fontWeight="600" fill={F.ink}>CRO {"ABCD"[i]}</text>
            {/* 제각각인 견적서 */}
            <rect x="292" y={y + 12} width={[22, 14, 26, 18][i]} height="6" rx="3" fill={F.ph} />
            <rect x="292" y={y + 22} width={[14, 22, 12, 24][i]} height="6" rx="3" fill={F.track} />
          </g>
        ))}
        <text x="176" y="272" fontSize="11.5" fill={F.muted} textAnchor="middle">같은 설명 4번 · 양식이 달라 비교 불가</text>

        {/* 오른쪽: 단추 */}
        <text x="408" y="14" fontSize="13" fontWeight="700" fill={F.brand}>단추</text>
        <rect x="408" y="28" width="352" height="256" rx="16" fill={F.tint} stroke="var(--brand-line)" />
        <rect x="428" y="120" width="80" height="60" rx="10" fill={F.white} stroke="var(--brand-line)" />
        <text x="468" y="147" fontSize="12" fontWeight="700" fill={F.ink} textAnchor="middle">의뢰자</text>
        <text x="468" y="164" fontSize="11" fill={F.muted} textAnchor="middle">요청 1건</text>
        <path d="M508 150 L 536 150" stroke={F.brand} strokeWidth="1.6" />
        <circle cx="556" cy="150" r="20" fill={F.white} stroke={F.brand} strokeWidth="1.4" />
        <circle cx="550" cy="144" r="2.6" fill={F.brand} />
        <circle cx="562" cy="144" r="2.6" fill={F.brand} />
        <circle cx="550" cy="156" r="2.6" fill={F.brand} />
        <circle cx="562" cy="156" r="2.6" fill={F.brand} />
        {croY.map((y) => (
          <g key={`b${y}`}>
            <path d={`M578 150 C 600 150, 606 ${y + 20}, 626 ${y + 20}`} fill="none" stroke={F.brand} strokeWidth="1.2" opacity="0.55" />
            <rect x="626" y={y + 6} width="28" height="28" rx="14" fill={F.white} stroke="var(--brand-line)" />
          </g>
        ))}
        <rect x="670" y="46" width="72" height="188" rx="10" fill={F.white} stroke="var(--brand-line)" />
        <text x="706" y="66" fontSize="10" fontWeight="700" fill={F.brand} textAnchor="middle">비교표</text>
        {[80, 108, 136, 164].map((y, i) => (
          <g key={y}>
            <rect x="682" y={y} width="48" height="6" rx="3" fill={i === 2 ? F.brand : F.track} />
            <rect x="682" y={y + 10} width="34" height="5" rx="2.5" fill={F.track} />
          </g>
        ))}
        <text x="584" y="272" fontSize="11.5" fill={F.brand} textAnchor="middle">한 번 입력 · 같은 형식으로 비교</text>
      </svg>
      <Cap>같은 내용을 기관마다 다시 설명하고 서로 다른 양식으로 돌려받는 과정을, 요청 한 번과 비교표 한 장으로 바꿉니다.</Cap>
    </figure>
  );
}

/** 2. 표준 양식 — 요청서에서 고른 항목이 회신 표의 행이 된다 */
export function FigMapping() {
  const items = [
    ["반복투여독성 4주", "랫드 · 회복 2주 · GLP"],
    ["복귀돌연변이 Ames", "TG 471 · GLP"],
    ["염색체이상 in vitro", "TG 473 · GLP"],
  ];
  return (
    <figure className="fig">
      <svg viewBox="0 0 760 300" role="img" aria-labelledby="fig2t" className="fig__svg">
        <title id="fig2t">요청서에서 고른 시험 항목이 그대로 회신 표의 행이 되고, CRO는 세 칸만 채웁니다</title>

        <text x="0" y="14" fontSize="13" fontWeight="700" fill={F.muted}>의뢰자 요청서</text>
        <rect x="0" y="28" width="300" height="240" rx="16" fill={F.white} stroke={F.line} />
        <text x="20" y="56" fontSize="11" fontWeight="700" fill={F.brand} letterSpacing="0.04em">RFQ · DC-2026-0001</text>
        {items.map(([t, c], i) => (
          <g key={t}>
            <rect x="20" y={72 + i * 58} width="260" height="46" rx="10" fill={F.surface} />
            <text x="34" y={92 + i * 58} fontSize="12.5" fontWeight="600" fill={F.ink}>{t}</text>
            <text x="34" y={108 + i * 58} fontSize="11" fill={F.muted}>{c}</text>
          </g>
        ))}
        <text x="20" y="258" fontSize="11" fill={F.muted}>대분류만 골라도 접수됩니다</text>

        {/* 연결 */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M300 ${95 + i * 58} C 330 ${95 + i * 58}, 340 ${100 + i * 52}, 370 ${100 + i * 52}`} fill="none" stroke={F.brand} strokeWidth="1.3" opacity="0.5" />
        ))}
        <text x="335" y="34" fontSize="11" fontWeight="600" fill={F.brand} textAnchor="middle">자동</text>
        <text x="335" y="48" fontSize="11" fontWeight="600" fill={F.brand} textAnchor="middle">생성</text>

        <text x="370" y="14" fontSize="13" fontWeight="700" fill={F.muted}>CRO 회신 표</text>
        <rect x="370" y="28" width="390" height="240" rx="16" fill={F.white} stroke={F.line} />
        <rect x="370" y="28" width="390" height="34" rx="16" fill={F.surface} />
        <rect x="370" y="46" width="390" height="16" fill={F.surface} />
        {["시험 항목", "가능 여부", "금액", "기간"].map((h, i) => (
          <text key={h} x={[390, 566, 640, 712][i]} y="50" fontSize="10.5" fontWeight="600" fill={F.ph}>{h}</text>
        ))}
        {items.map(([t], i) => (
          <g key={`r${t}`}>
            <text x="390" y={100 + i * 52} fontSize="12" fontWeight="600" fill={F.ink}>{t}</text>
            <rect x="560" y={86 + i * 52} width="60" height="22" rx="11" fill={F.tint} />
            <text x="590" y={101 + i * 52} fontSize="11" fontWeight="600" fill={F.brand} textAnchor="middle">가능</text>
            <rect x="632" y={86 + i * 52} width="60" height="22" rx="6" fill={F.surface} stroke={F.line} />
            <rect x="704" y={86 + i * 52} width="40" height="22" rx="6" fill={F.surface} stroke={F.line} />
            <line x1="390" y1={116 + i * 52} x2="744" y2={116 + i * 52} stroke={F.track} />
          </g>
        ))}
        <text x="390" y="252" fontSize="11" fill={F.muted}>CRO는 세 칸만 채우고 정식 견적서 PDF를 첨부합니다</text>
      </svg>
      <Cap>CRO가 항목을 새로 정의하지 않습니다. 요청서에서 만들어진 같은 행에 답하므로, 회신이 그대로 비교 가능한 표가 됩니다.</Cap>
    </figure>
  );
}

/** 3. 기밀 등급에 따른 전달 범위 */
export function FigConfidential() {
  return (
    <figure className="fig">
      <svg viewBox="0 0 760 250" role="img" aria-labelledby="fig3t" className="fig__svg">
        <title id="fig3t">기밀 등급을 지정하면 비밀유지계약을 체결한 기관에만 전달되고, 체결 전까지 회사명은 가려집니다</title>

        <rect x="0" y="30" width="200" height="120" rx="14" fill={F.white} stroke={F.line} />
        <text x="24" y="58" fontSize="11" fontWeight="700" fill={F.brand} letterSpacing="0.04em">요청서</text>
        <text x="24" y="82" fontSize="12.5" fontWeight="600" fill={F.ink}>물질 DC-101</text>
        <text x="24" y="102" fontSize="11.5" fill={F.muted}>(주)바이오벤처</text>
        <rect x="24" y="114" width="120" height="22" rx="11" fill={F.tint} />
        <text x="84" y="129" fontSize="11" fontWeight="600" fill={F.brand} textAnchor="middle">기밀 등급 · CDA 필요</text>

        <path d="M200 90 L 268 90" stroke={F.brand} strokeWidth="1.6" />
        <circle cx="288" cy="90" r="20" fill={F.white} stroke={F.brand} strokeWidth="1.4" />
        <circle cx="282" cy="84" r="2.6" fill={F.brand} />
        <circle cx="294" cy="84" r="2.6" fill={F.brand} />
        <circle cx="282" cy="96" r="2.6" fill={F.brand} />
        <circle cx="294" cy="96" r="2.6" fill={F.brand} />

        {/* 체결 기관 */}
        <path d="M310 84 C 350 84, 360 56, 400 56" fill="none" stroke={F.brand} strokeWidth="1.4" />
        <path d="M310 92 C 350 92, 360 116, 400 116" fill="none" stroke={F.brand} strokeWidth="1.4" />
        <rect x="400" y="34" width="330" height="44" rx="10" fill={F.white} stroke="var(--brand-line)" />
        <text x="420" y="53" fontSize="12" fontWeight="700" fill={F.ink}>CDA 체결 기관</text>
        <text x="420" y="69" fontSize="11" fill={F.muted}>요청서 전문 · 첨부 자료 · 회사명 열람</text>
        <rect x="400" y="94" width="330" height="44" rx="10" fill={F.white} stroke="var(--brand-line)" />
        <text x="420" y="113" fontSize="12" fontWeight="700" fill={F.ink}>체결 전 기관</text>
        <text x="420" y="129" fontSize="11" fill={F.muted}>시험 항목만 · 회사명은 “바이오벤처 (마스킹)”</text>

        {/* 미전달 */}
        <path d="M310 100 C 350 100, 360 176, 400 176" fill="none" stroke={F.ph} strokeWidth="1.2" strokeDasharray="5 5" />
        <rect x="400" y="154" width="330" height="44" rx="10" fill={F.surface} stroke={F.line} strokeDasharray="5 5" />
        <text x="420" y="173" fontSize="12" fontWeight="700" fill={F.muted}>수행 분야가 다른 기관</text>
        <text x="420" y="189" fontSize="11" fill={F.ph}>전달하지 않음</text>

        <text x="0" y="232" fontSize="11.5" fill={F.muted}>선택한 CRO에만 연락처가 공개되고, 다른 기관은 타사 견적을 볼 수 없습니다.</text>
      </svg>
      <Cap>물질 정보를 여러 곳에 뿌리지 않습니다. 수행 가능한 기관에만, 기밀 등급에 맞는 범위까지만 전달합니다.</Cap>
    </figure>
  );
}
