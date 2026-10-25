"use client";

import type { Track } from "./brand-film-motion";
import { Card, Film, sceneTracks, type Scene } from "./Film";

/**
 * 흩어진 견적 필름: 단추 없이 기관마다 따로 문의할 때 생기는 네 가지 어려움.
 * 의뢰자(왼쪽) 한 곳에서 기관 넷(오른쪽)으로 같은 요청서가 네 번 나가고, 제각각인 회신이 더미로 쌓인다.
 * 마지막 장면(기본 스타일)은 어지러운 더미와 흩어진 첨부.
 */
const DUR = 12;
const SCENES: Scene[] = [
  ["따로 설명", 0, "같은 시험을 기관 수만큼 설명합니다"],
  ["다른 양식", 3, "포함 항목과 단위가 달라 총액만 비교하게 됩니다"],
  ["기다림", 6, "담당자를 찾고 답을 기다리는 시간이 먼저 듭니다"],
  ["흩어진 자료", 9, "물질 정보와 첨부가 기관마다 흩어집니다"],
];
const hide = "opacity:0";
const show = "opacity:1";
const ORG_Y = [165, 355, 545, 735];
/** 회신 더미: 도착 자리와 기울기 */
const PILE = [[430, 380, -6], [520, 470, 8], [440, 540, -3], [560, 380, 5]] as const;
const tr = (x: number, y: number, r = 0) => `transform:translate(${x}px,${y}px) rotate(${r}deg)`;

const TRACKS: Track[] = [
  // 같은 요청서 4장이 의뢰자(330,450)에서 기관 넷으로
  ...ORG_Y.map((y, i): Track => ({ name: `out-${i}`, sel: `.sf-out--${i}`, stops: [
    [0, `${hide};${tr(0, 0)}`], [0.3 + i * 0.35, `${hide};${tr(0, 0)}`], [0.4 + i * 0.35, `${show};${tr(0, 0)}`, "inout"],
    [1.6 + i * 0.35, `${show};${tr(570, y - 450)}`], [3, `${show};${tr(570, y - 450)}`], [3.5, `${hide};${tr(570, y - 450)}`],
  ] })),
  // 회신: 기관 A·B·C 는 바로, D 는 한참 뒤에. 모양이 제각각인 채 더미로
  ...PILE.map(([px, py, r], i): Track => {
    const late = i === 3;
    const go = late ? 7.2 : 3.4 + i * 0.4;
    return { name: `back-${i}`, sel: `.sf-back--${i}`, stops: [
      [0, `${hide};${tr(0, 0)}`], [go - 0.1, `${hide};${tr(0, 0)}`], [go, `${show};${tr(0, 0)}`, "inout"],
      [go + 1.3, `${show};${tr(px - 900, py - ORG_Y[i], r)}`], [DUR, `${show};${tr(px - 900, py - ORG_Y[i], r)}`],
    ] };
  }),
  // 기관 D 의 "…" (답이 늦다)
  { name: "wait", sel: ".sf-wait", stops: [[0, hide], [3.4, hide], [3.9, show], [6.9, show], [7.2, hide], [DUR, hide]] },
  // 흩어진 첨부(클립) 넷
  ...[0, 1, 2, 3].map((i): Track => ({ name: `clip-${i}`, sel: `.sf-clip--${i}`, stops: [[0, hide], [9.2 + i * 0.3, hide], [9.7 + i * 0.3, "opacity:0.9"], [DUR, "opacity:0.9"]] })),
  ...sceneTracks(SCENES, DUR, false),
];
const SHAPES = [[80, 100], [120, 70], [64, 118], [96, 96]] as const;

export function ScatterFilm() {
  return (
    <Film scope="sf" dur={DUR} scenes={SCENES} tracks={TRACKS} title="단추 없이 기관마다 따로 문의할 때 생기는 어려움">
      <svg viewBox="0 0 1200 900" aria-hidden="true">
        <text className="ff-lane" x="60" y="100">의뢰자</text>
        <text className="ff-lane" x="1020" y="100" textAnchor="middle">기관</text>
        <rect className="ff-box" x="80" y="400" width="200" height="100" rx="12" />
        <text className="ff-label" x="180" y="458" textAnchor="middle">의뢰자</text>
        {ORG_Y.map((y, i) => (
          <g key={y}>
            <rect className="ff-box ff-box--org" x="920" y={y - 45} width="200" height="90" rx="12" />
            <text className="ff-label" x="1020" y={y + 9} textAnchor="middle">기관 {"ABCD"[i]}</text>
          </g>
        ))}
        <g className="sf-wait"><text x="1020" y="800" textAnchor="middle">답을 기다리는 중 …</text></g>
        {ORG_Y.map((y, i) => <g key={i} className={`sf-out sf-out--${i}`}><Card x={330} y={450} w={80} h={100} /></g>)}
        {SHAPES.map(([w, h], i) => <g key={i} className={`sf-back sf-back--${i}`}><Card x={900} y={ORG_Y[i]} w={w} h={h} className={`ff-card sf-shape--${i}`} /></g>)}
        {[[640, 270, -30], [700, 400, 20], [640, 520, -10], [700, 660, 35]].map(([x, y, r], i) => (
          <g key={i} className={`sf-clip sf-clip--${i}`} style={{ transform: `translate(${x}px,${y}px) rotate(${r}deg)` }}>
            <rect x="-12" y="-26" width="24" height="52" rx="12" />
            <rect x="-5" y="-16" width="10" height="34" rx="5" />
          </g>
        ))}
      </svg>
    </Film>
  );
}
