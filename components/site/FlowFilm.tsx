"use client";

import type { Track } from "./brand-film-motion";
import { Card, Film, sceneTracks, type Scene } from "./Film";

/**
 * 흐름 필름: 요청서 한 건이 접수부터 계약 완료까지 흐르는 7장면.
 * 의뢰자(위) · 단추(가운데) · 기관 셋(아래) 세 줄 사이를 요청서가 오간다. 움직이는 속성은 transform·opacity 뿐.
 */
const DUR = 21;
const SCENES: Scene[] = [
  ["접수", 0, "요청서는 한 번만 씁니다"],
  ["참여 안내", 3, "분야가 맞는 기관에 참여를 묻습니다"],
  ["견적 도착", 6.5, "기관은 서로의 회신을 볼 수 없습니다"],
  ["비교표 공개", 10, "같은 항목끼리 나란히 봅니다"],
  ["기관 선택", 13.5, "연락처를 서로 주고받습니다"],
  ["계약 진행", 16.5, "계약은 기관과 직접 합니다"],
  ["계약 완료", 19, "확인하면 요청을 마칩니다"],
];
const hide = "opacity:0";
const show = "opacity:1";
const T = (x: number, y: number) => `transform:translate(${x}px,${y}px)`;

const TRACKS: Track[] = [
  // 요청서: 의뢰자 줄(760,230) → 단추 줄(760,470). 비교표로 바뀌며 사라진다
  { name: "req", sel: ".ff-req", stops: [[0, `${show};${T(0, 0)}`], [0.5, `${show};${T(0, 0)}`, "inout"], [1.8, `${show};${T(0, 240)}`], [10, `${show};${T(0, 240)}`], [10.6, `${hide};${T(0, 240)}`]] },
  // 참여 안내 쪽지 3장: 단추 → 기관 A·B·C
  ...["a", "b", "c"].map((k, i): Track => ({ name: `note-${k}`, sel: `.ff-note--${k}`, stops: [
    [0, `${hide};${T(0, 0)}`], [3 + i * 0.25, `${hide};${T(0, 0)}`], [3.1 + i * 0.25, `${show};${T(0, 0)}`, "inout"],
    [4.2 + i * 0.25, `${show};${T((i - 1) * 300, 250)}`], [6.5, `${show};${T((i - 1) * 300, 250)}`], [7, `${hide};${T((i - 1) * 300, 250)}`],
  ] })),
  ...["a", "b", "c"].map((k, i): Track => ({ name: `badge-${k}`, sel: `.ff-badge--${k}`, stops: [[0, hide], [4.6 + i * 0.25, hide], [4.9 + i * 0.25, show], [DUR, show]] })),
  { name: "wall", sel: ".ff-wall", stops: [[0, hide], [6.5, hide], [7.2, show], [DUR, show]] },
  // 회신 카드: 참여한 A·C 에서 단추로
  ...["a", "c"].map((k, i): Track => ({ name: `reply-${k}`, sel: `.ff-reply--${k}`, stops: [
    [0, `${hide};${T(0, 0)}`], [7.2 + i * 0.3, `${hide};${T(0, 0)}`], [7.3 + i * 0.3, `${show};${T(0, 0)}`, "inout"],
    [8.6 + i * 0.3, `${show};${T(i === 0 ? 420 : -100, -250)}`], [10, `${show};${T(i === 0 ? 420 : -100, -250)}`], [10.6, `${hide};${T(i === 0 ? 420 : -100, -250)}`],
  ] })),
  { name: "table", sel: ".ff-table", stops: [[0, `${hide};${T(0, 240)}`], [10.4, `${hide};${T(0, 240)}`], [10.9, `${show};${T(0, 240)}`], [11.6, `${show};${T(0, 240)}`, "inout"], [12.8, `${show};${T(0, 0)}`], [DUR, `${show};${T(0, 0)}`]] },
  { name: "pick", sel: ".ff-pick", stops: [[0, hide], [13.6, hide], [14.1, show], [DUR, show]] },
  { name: "link", sel: ".ff-link", stops: [[0, `${hide};transform:scaleY(0)`], [14.4, `${hide};transform:scaleY(0)`], [14.5, `${show};transform:scaleY(0)`, "out"], [15.4, `${show};transform:scaleY(1)`], [DUR, `${show};transform:scaleY(1)`]] },
  { name: "direct", sel: ".ff-direct", stops: [[0, hide], [16.6, hide], [17.2, show], [DUR, show]] },
  { name: "hub", sel: ".ff-hub", stops: [[0, show], [16.6, show], [17.4, "opacity:0.35"], [DUR, "opacity:0.35"]] },
  { name: "done", sel: ".ff-done", stops: [[0, `${hide};transform:scale(0.9)`], [19.1, `${hide};transform:scale(0.9)`, "out"], [19.6, `${show};transform:scale(1)`], [DUR, `${show};transform:scale(1)`]] },
  ...sceneTracks(SCENES, DUR),
];

const ORGS = [["a", 300, "기관 A", "참여"], ["b", 600, "기관 B", "불참"], ["c", 900, "기관 C", "참여"]] as const;

export function FlowFilm() {
  return (
    <Film scope="ff" dur={DUR} scenes={SCENES} tracks={TRACKS} title="요청 한 건이 접수부터 계약 완료까지 흐르는 과정">
      <svg viewBox="0 0 1200 900" aria-hidden="true">
        <line className="ff-rail" x1="60" y1="104" x2="1140" y2="104" />
        {SCENES.map(([label], i) => (
          <text key={label} className={`ff-step ff-step--${i}`} x={70 + i * 160} y="80"><tspan>{String(i + 1).padStart(2, "0")}</tspan> {label}</text>
        ))}
        <text className="ff-lane" x="60" y="238">의뢰자</text>
        <text className="ff-lane" x="60" y="478">단추</text>
        <text className="ff-lane" x="60" y="728">기관</text>
        <rect className="ff-box" x="340" y="180" width="240" height="100" rx="12" />
        <text className="ff-label" x="460" y="238" textAnchor="middle">의뢰자</text>
        <g className="ff-hub">
          <rect className="ff-box ff-box--hub" x="340" y="420" width="240" height="100" rx="12" />
          <text className="ff-label" x="460" y="470" textAnchor="middle">단추</text>
          <text className="ff-sub" x="460" y="498" textAnchor="middle">같은 양식으로 모읍니다</text>
        </g>
        {ORGS.map(([k, x, name, st]) => (
          <g key={k}>
            <rect className="ff-box ff-box--org" x={x - 120} y="670" width="240" height="100" rx="12" />
            <text className="ff-label" x={x} y="716" textAnchor="middle">{name}</text>
            <g className={`ff-badge ff-badge--${k}`}><text x={x} y="748" textAnchor="middle">{st}</text></g>
          </g>
        ))}
        <line className="ff-wall" x1="450" y1="650" x2="450" y2="790" />
        <line className="ff-wall" x1="750" y1="650" x2="750" y2="790" />
        <g className="ff-req"><Card x={760} y={230} /></g>
        {(["a", "b", "c"] as const).map((k) => (
          <g key={k} className={`ff-note ff-note--${k}`}><rect x="725" y="445" width="70" height="50" rx="6" /></g>
        ))}
        {(["a", "c"] as const).map((k, i) => (
          <g key={k} className={`ff-reply ff-reply--${k}`}><Card x={i === 0 ? 300 : 900} y={720} w={80} h={96} /></g>
        ))}
        <g className="ff-table">
          <rect className="bg" x="600" y="160" width="320" height="140" rx="10" />
          <rect className="ff-pick" x="736" y="166" width="92" height="128" rx="6" />
          <line x1="600" y1="202" x2="920" y2="202" />
          <line x1="600" y1="250" x2="920" y2="250" />
          <text className="hd" x="616" y="190">항목</text>
          <text className="hd" x="782" y="190" textAnchor="middle">기관 A</text>
          <text className="hd" x="872" y="190" textAnchor="middle">기관 C</text>
          <text x="616" y="234">반복투여 4주</text>
          <text x="782" y="234" textAnchor="middle">9,800만</text>
          <text x="872" y="234" textAnchor="middle">1억 600만</text>
          <text x="616" y="282">복귀돌연변이</text>
          <text x="782" y="282" textAnchor="middle">1,100만</text>
          <text x="872" y="282" textAnchor="middle">1,250만</text>
        </g>
        <g className="ff-link">
          <line x1="360" y1="280" x2="320" y2="668" />
          <circle cx="360" cy="280" r="7" />
          <circle cx="320" cy="668" r="7" />
        </g>
        <g className="ff-direct"><text x="320" y="470" textAnchor="end">직접 계약</text></g>
        <g className="ff-done">
          <circle cx="568" cy="178" r="22" />
          <path d="M557 178 l8 8 l14 -16" />
        </g>
      </svg>
    </Film>
  );
}
