/**
 * 서비스 소개 도해 — 브랜드 토큰으로 그린 벡터 이미지.
 * 넓은 화면은 두 판을 나란히, 좁은 화면(폰)은 위아래로 쌓아 한 판씩 순서대로 보여준다.
 * 화면에 들어오면(.fig.in) 요소가 순서대로 나타난다: .fa = 페이드·살짝 올라옴, .fl = 선이 그어짐. --d 는 지연(초).
 */

const F = { ink: "var(--ink)", body: "var(--body)", muted: "var(--muted)", ph: "var(--placeholder)", brand: "var(--brand)", tint: "var(--brand-tint)", line: "var(--card-line)", track: "var(--track)", white: "var(--white)", surface: "var(--surface)" };

type S = React.CSSProperties;
/** 나타남 */
const A = (d: number) => ({ className: "fa", style: { "--d": `${d}s` } as S });
/** 선 긋기 (실선만) */
const L = (d: number) => ({ className: "fl", style: { "--d": `${d}s` } as S });

function Panel({ label, brand, w, h, children, delay = 0, labelId }: { label: string; brand?: boolean; w: number; h: number; children: React.ReactNode; delay?: number; labelId: string }) {
  return (
    <div className="fig__panel">
      <div {...A(delay)} className={`fa fig__lab${brand ? " fig__lab--brand" : ""}`}>{label}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="fig__svg" style={{ aspectRatio: `${w} / ${h}` }} aria-labelledby={labelId} role="img">
        {children}
      </svg>
    </div>
  );
}

/** 판 사이 연결 표시 — 넓은 화면은 →, 좁은 화면은 ↓ */
function Link({ text, delay, children }: { text?: string; delay: number; children?: React.ReactNode }) {
  return (
    <div {...A(delay)} className="fa fig__link">
      {children}
      {text && <span>{text}</span>}
      <i aria-hidden="true" />
    </div>
  );
}

/** 단추 마크 (연결부) */
function Mark({ delay }: { delay: number }) {
  return (
    <svg {...A(delay)} className="fa fig__mark" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="20" fill={F.white} stroke={F.brand} strokeWidth="1.4" />
      <circle cx="16" cy="16" r="2.6" fill={F.brand} />
      <circle cx="28" cy="16" r="2.6" fill={F.brand} />
      <circle cx="16" cy="28" r="2.6" fill={F.brand} />
      <circle cx="28" cy="28" r="2.6" fill={F.brand} />
    </svg>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return <figcaption className="fig__cap">{children}</figcaption>;
}

/** 1. 지금 방식 vs 단추 — 흩어진 왕복 vs 한 줄 흐름 */
export function FigBeforeAfter() {
  const croY = [12, 64, 116, 168];
  return (
    <figure className="fig rv" data-rv>
      <span id="fig1t" className="sr-only">지금은 기관마다 따로 연락하고 제각각 양식의 견적을 받지만, 단추는 한 번 요청해 같은 형식의 비교표를 받습니다</span>
      <div className="fig__panels">
        <Panel label="지금" w={352} h={256} labelId="fig1t">
          <rect {...A(0)} x="0.5" y="0.5" width="351" height="255" rx="16" fill={F.white} stroke={F.line} />
          <g {...A(0.15)}>
            <rect x="24" y="92" width="92" height="60" rx="10" fill={F.surface} stroke={F.line} />
            <text x="70" y="119" fontSize="12" fontWeight="700" fill={F.ink} textAnchor="middle">의뢰자</text>
            <text x="70" y="136" fontSize="11" fill={F.muted} textAnchor="middle">담당자 1명</text>
          </g>
          {croY.map((y, i) => (
            <g key={y} {...A(0.4 + i * 0.18)}>
              <path d={`M116 122 C 170 122, 180 ${y + 20}, 226 ${y + 20}`} fill="none" stroke={F.ph} strokeWidth="1.2" strokeDasharray="4 4" />
              <path d={`M226 ${y + 26} C 180 ${y + 26}, 170 128, 116 128`} fill="none" stroke={F.ph} strokeWidth="1.2" strokeDasharray="4 4" />
              <rect x="226" y={y} width="102" height="40" rx="9" fill={F.white} stroke={F.line} />
              <text x="240" y={y + 24} fontSize="12" fontWeight="600" fill={F.ink}>CRO {"ABCD"[i]}</text>
              <rect x="292" y={y + 12} width={[22, 14, 26, 18][i]} height="6" rx="3" fill={F.ph} />
              <rect x="292" y={y + 22} width={[14, 22, 12, 24][i]} height="6" rx="3" fill={F.track} />
            </g>
          ))}
          <text {...A(1.2)} x="176" y="242" fontSize="11.5" fill={F.muted} textAnchor="middle">같은 설명 4번 · 양식이 달라 비교 불가</text>
        </Panel>

        <Link delay={1.4} />

        <Panel label="단추" brand w={352} h={256} labelId="fig1t" delay={1.5}>
          <rect {...A(1.5)} x="0.5" y="0.5" width="351" height="255" rx="16" fill={F.tint} stroke="var(--brand-line)" />
          <g {...A(1.65)}>
            <rect x="20" y="92" width="80" height="60" rx="10" fill={F.white} stroke="var(--brand-line)" />
            <text x="60" y="119" fontSize="12" fontWeight="700" fill={F.ink} textAnchor="middle">의뢰자</text>
            <text x="60" y="136" fontSize="11" fill={F.muted} textAnchor="middle">요청 1건</text>
          </g>
          <path {...L(1.85)} d="M100 122 L 128 122" stroke={F.brand} strokeWidth="1.6" />
          <g {...A(2.0)}>
            <circle cx="148" cy="122" r="20" fill={F.white} stroke={F.brand} strokeWidth="1.4" />
            <circle cx="142" cy="116" r="2.6" fill={F.brand} />
            <circle cx="154" cy="116" r="2.6" fill={F.brand} />
            <circle cx="142" cy="128" r="2.6" fill={F.brand} />
            <circle cx="154" cy="128" r="2.6" fill={F.brand} />
          </g>
          {croY.map((y, i) => (
            <g key={`b${y}`}>
              <path {...L(2.15 + i * 0.1)} d={`M170 122 C 192 122, 198 ${y + 20}, 218 ${y + 20}`} fill="none" stroke={F.brand} strokeWidth="1.2" opacity="0.55" />
              <rect {...A(2.35 + i * 0.1)} x="218" y={y + 6} width="28" height="28" rx="14" fill={F.white} stroke="var(--brand-line)" />
            </g>
          ))}
          <g {...A(2.8)}>
            <rect x="262" y="18" width="72" height="188" rx="10" fill={F.white} stroke="var(--brand-line)" />
            <text x="298" y="38" fontSize="10" fontWeight="700" fill={F.brand} textAnchor="middle">비교표</text>
          </g>
          {[52, 80, 108, 136].map((y, i) => (
            <g key={y} {...A(2.95 + i * 0.1)}>
              <rect x="274" y={y} width="48" height="6" rx="3" fill={i === 2 ? F.brand : F.track} />
              <rect x="274" y={y + 10} width="34" height="5" rx="2.5" fill={F.track} />
            </g>
          ))}
          <text {...A(3.4)} x="176" y="242" fontSize="11.5" fill={F.brand} textAnchor="middle">한 번 입력 · 같은 형식으로 비교</text>
        </Panel>
      </div>
      <Cap>같은 내용을 기관마다 다시 설명하고 서로 다른 양식으로 돌려받던 과정이, 요청 한 번과 비교표 한 장으로 바뀝니다.</Cap>
    </figure>
  );
}

/** 2. 같은 양식 — 요청서의 항목이 그대로 모든 기관 회신 표의 행이 된다 */
export function FigMapping() {
  const items = [
    ["반복투여독성 4주", "랫드 · 회복 2주 · GLP"],
    ["복귀돌연변이 Ames", "TG 471 · GLP"],
    ["염색체이상 in vitro", "TG 473 · GLP"],
  ];
  return (
    <figure className="fig rv" data-rv>
      <span id="fig2t" className="sr-only">요청서에서 고른 시험 항목이 그대로 모든 기관 회신 표의 행이 되고, 기관은 같은 칸을 채웁니다</span>
      <div className="fig__panels fig__panels--wide">
        <Panel label="의뢰자 요청서" w={300} h={240} labelId="fig2t">
          <g {...A(0)}>
            <rect x="0.5" y="0.5" width="299" height="239" rx="16" fill={F.white} stroke={F.line} />
            <text x="20" y="28" fontSize="11" fontWeight="700" fill={F.brand} letterSpacing="0.04em">RFQ · DC-2026-0001</text>
          </g>
          {items.map(([t, c], i) => (
            <g key={t} {...A(0.25 + i * 0.18)}>
              <rect x="20" y={44 + i * 58} width="260" height="46" rx="10" fill={F.surface} />
              <text x="34" y={64 + i * 58} fontSize="12.5" fontWeight="600" fill={F.ink}>{t}</text>
              <text x="34" y={80 + i * 58} fontSize="11" fill={F.muted}>{c}</text>
            </g>
          ))}
          <text {...A(0.8)} x="20" y="230" fontSize="11" fill={F.muted}>대분류만 골라도 접수됩니다</text>
        </Panel>

        <Link delay={1.0} text="같은 행이 자동으로" />

        <Panel label="모든 기관의 회신 표" w={390} h={240} labelId="fig2t" delay={1.1}>
          <g {...A(1.1)}>
            <rect x="0.5" y="0.5" width="389" height="239" rx="16" fill={F.white} stroke={F.line} />
            <rect x="0.5" y="0.5" width="389" height="34" rx="16" fill={F.surface} />
            <rect x="0.5" y="18" width="389" height="16" fill={F.surface} />
            {["시험 항목", "가능 여부", "금액", "기간"].map((h, i) => (
              <text key={h} x={[20, 196, 270, 342][i]} y="22" fontSize="10.5" fontWeight="600" fill={F.ph}>{h}</text>
            ))}
          </g>
          {items.map(([t], i) => (
            <g key={`r${t}`} {...A(1.35 + i * 0.22)}>
              <text x="20" y={72 + i * 52} fontSize="12" fontWeight="600" fill={F.ink}>{t}</text>
              <rect x="190" y={58 + i * 52} width="60" height="22" rx="11" fill={F.tint} />
              <text x="220" y={73 + i * 52} fontSize="11" fontWeight="600" fill={F.brand} textAnchor="middle">가능</text>
              <rect x="262" y={58 + i * 52} width="60" height="22" rx="6" fill={F.surface} stroke={F.line} />
              <rect x="334" y={58 + i * 52} width="40" height="22" rx="6" fill={F.surface} stroke={F.line} />
              <line x1="20" y1={88 + i * 52} x2="374" y2={88 + i * 52} stroke={F.track} />
            </g>
          ))}
          <text {...A(2.1)} x="20" y="226" fontSize="11" fill={F.muted}>어느 기관이든 같은 칸을 채우고 정식 견적서 PDF를 첨부합니다</text>
        </Panel>
      </div>
      <Cap>기관마다 다른 견적서 양식을 받는 대신, 모든 기관이 요청서와 같은 행에 같은 칸을 채웁니다. 그래서 회신이 그대로 비교표가 됩니다.</Cap>
    </figure>
  );
}

/** 3. 기밀 등급에 따른 전달 범위 */
export function FigConfidential() {
  return (
    <figure className="fig rv" data-rv>
      <span id="fig3t" className="sr-only">기밀 등급을 지정하면 비밀유지계약을 체결한 기관에만 전달되고, 체결 전까지 회사명은 가려집니다</span>
      <div className="fig__panels fig__panels--wide">
        <Panel label="요청서" w={220} h={120} labelId="fig3t">
          <g {...A(0)}>
            <rect x="0.5" y="0.5" width="219" height="119" rx="14" fill={F.white} stroke={F.line} />
            <text x="24" y="34" fontSize="12.5" fontWeight="600" fill={F.ink}>물질 DC-101</text>
            <text x="24" y="54" fontSize="11.5" fill={F.muted}>(주)바이오벤처</text>
            <rect x="24" y="72" width="132" height="24" rx="12" fill={F.tint} />
            <text x="90" y="88" fontSize="11" fontWeight="600" fill={F.brand} textAnchor="middle">기밀 등급 · CDA 필요</text>
          </g>
        </Panel>

        <Link delay={0.4}>
          <Mark delay={0.45} />
        </Link>

        <Panel label="전달 범위" w={330} h={164} labelId="fig3t" delay={0.7}>
          <g {...A(0.85)}>
            <rect x="0.5" y="0.5" width="329" height="44" rx="10" fill={F.white} stroke="var(--brand-line)" />
            <text x="20" y="19" fontSize="12" fontWeight="700" fill={F.ink}>CDA 체결 기관</text>
            <text x="20" y="35" fontSize="11" fill={F.muted}>요청서 전문 · 첨부 자료 · 회사명 열람</text>
          </g>
          <g {...A(1.15)}>
            <rect x="0.5" y="60.5" width="329" height="44" rx="10" fill={F.white} stroke="var(--brand-line)" />
            <text x="20" y="79" fontSize="12" fontWeight="700" fill={F.ink}>체결 전 기관</text>
            <text x="20" y="95" fontSize="11" fill={F.muted}>시험 항목만 · 회사명은 “바이오벤처 (마스킹)”</text>
          </g>
          <g {...A(1.45)}>
            <rect x="0.5" y="120.5" width="329" height="43" rx="10" fill={F.surface} stroke={F.line} strokeDasharray="5 5" />
            <text x="20" y="139" fontSize="12" fontWeight="700" fill={F.muted}>수행 분야가 다른 기관</text>
            <text x="20" y="155" fontSize="11" fill={F.ph}>전달하지 않음</text>
          </g>
        </Panel>
      </div>
      <Cap>물질 정보를 여러 곳에 뿌리지 않습니다. 수행 가능한 기관에만, 기밀 등급에 맞는 범위까지만 전달합니다. 선택한 기관에만 연락처가 공개되고, 어느 기관도 다른 기관의 견적을 볼 수 없습니다.</Cap>
    </figure>
  );
}
