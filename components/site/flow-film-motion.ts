import { keyframes, type Track } from "./brand-film-motion";

/**
 * 흐름 필름의 타임라인(초). 요청서 한 건이 의뢰자 → 단추 → 기관 → 단추 → 의뢰자로 흐르는 7장면.
 * 그림은 components/site/FlowFilm.tsx 의 SVG, 모양은 flow-film.css. 여기는 시각만 둔다.
 * 움직이는 속성은 transform·opacity 뿐이다. 기본 스타일(키프레임이 없을 때)은 마지막 장면이다.
 */
export const FLOW_DUR = 21;

/** [단계 이름, 시작 초, 아래 문장] */
export const SCENES: [string, number, string][] = [
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
/** 보였다가 translate 로 이동 */
const T = (x: number, y: number) => `transform:translate(${x}px,${y}px)`;

const tracks: Track[] = [
  // 요청서: 의뢰자 줄(760,230) → 단추 줄(760,470). 장면 4에서 비교표로 바뀌므로 사라진다
  { name: "req", sel: ".ff-req", stops: [
    [0, `${show};${T(0, 0)}`], [0.5, `${show};${T(0, 0)}`, "inout"], [1.8, `${show};${T(0, 240)}`], [10, `${show};${T(0, 240)}`], [10.6, `${hide};${T(0, 240)}`],
  ] },
  // 참여 안내 쪽지 3장: 단추 → 기관 A·B·C (x 300·600·900, y 720). 견적 도착 때 사라진다
  ...["a", "b", "c"].map((k, i): Track => ({ name: `note-${k}`, sel: `.ff-note--${k}`, stops: [
    [0, `${hide};${T(0, 0)}`], [3 + i * 0.25, `${hide};${T(0, 0)}`], [3.1 + i * 0.25, `${show};${T(0, 0)}`, "inout"],
    [4.2 + i * 0.25, `${show};${T((i - 1) * 300, 250)}`], [6.5, `${show};${T((i - 1) * 300, 250)}`], [7, `${hide};${T((i - 1) * 300, 250)}`],
  ] })),
  // 참여·불참 표시
  ...["a", "b", "c"].map((k, i): Track => ({ name: `badge-${k}`, sel: `.ff-badge--${k}`, stops: [
    [0, hide], [4.6 + i * 0.25, hide], [4.9 + i * 0.25, show], [FLOW_DUR, show],
  ] })),
  // 기관 사이 칸막이
  { name: "wall", sel: ".ff-wall", stops: [[0, hide], [6.5, hide], [7.2, show], [FLOW_DUR, show]] },
  // 회신 카드: 참여한 A·B 에서 단추로. 비교표가 되며 사라진다
  ...["a", "c"].map((k, i): Track => ({ name: `reply-${k}`, sel: `.ff-reply--${k}`, stops: [
    [0, `${hide};${T(0, 0)}`], [7.2 + i * 0.3, `${hide};${T(0, 0)}`], [7.3 + i * 0.3, `${show};${T(0, 0)}`, "inout"],
    [8.6 + i * 0.3, `${show};${T(i === 0 ? 420 : -100, -250)}`], [10, `${show};${T(i === 0 ? 420 : -100, -250)}`], [10.6, `${hide};${T(i === 0 ? 420 : -100, -250)}`],
  ] })),
  // 비교표: 단추에서 나타나 의뢰자로 올라간다
  { name: "table", sel: ".ff-table", stops: [
    [0, `${hide};${T(0, 240)}`], [10.4, `${hide};${T(0, 240)}`], [10.9, `${show};${T(0, 240)}`], [11.6, `${show};${T(0, 240)}`, "inout"], [12.8, `${show};${T(0, 0)}`], [FLOW_DUR, `${show};${T(0, 0)}`],
  ] },
  // 선택한 열 강조, 연락 선(의뢰자 ↔ 기관 A), 체크
  { name: "pick", sel: ".ff-pick", stops: [[0, hide], [13.6, hide], [14.1, show], [FLOW_DUR, show]] },
  { name: "link", sel: ".ff-link", stops: [[0, `${hide};transform:scaleY(0)`], [14.4, `${hide};transform:scaleY(0)`], [14.5, `${show};transform:scaleY(0)`, "out"], [15.4, `${show};transform:scaleY(1)`], [FLOW_DUR, `${show};transform:scaleY(1)`]] },
  { name: "direct", sel: ".ff-direct", stops: [[0, hide], [16.6, hide], [17.2, show], [FLOW_DUR, show]] },
  // 계약 진행부터 단추는 한발 물러난다
  { name: "hub", sel: ".ff-hub", stops: [[0, show], [16.6, show], [17.4, "opacity:0.35"], [FLOW_DUR, "opacity:0.35"]] },
  { name: "done", sel: ".ff-done", stops: [[0, `${hide};transform:scale(0.9)`], [19.1, `${hide};transform:scale(0.9)`, "out"], [19.6, `${show};transform:scale(1)`], [FLOW_DUR, `${show};transform:scale(1)`]] },
  // 단계 레일: 지나간 단계가 켜진다
  ...SCENES.map(([, t], i): Track => ({ name: `step-${i}`, sel: `.ff-step--${i}`, stops: t > 0 ? [[0, "opacity:0.35"], [t - 0.01, "opacity:0.35"], [t + 0.3, show], [FLOW_DUR, show]] : [[0, "opacity:0.35"], [0.3, show], [FLOW_DUR, show]] })),
  // 아래 문장
  ...SCENES.map(([, t], i): Track => {
    const end = SCENES[i + 1]?.[1] ?? FLOW_DUR;
    const stops: Track["stops"] = [[0, hide]];
    if (t > 0) stops.push([t - 0.01, hide]);
    stops.push([t + 0.35, show]);
    if (end < FLOW_DUR) stops.push([end - 0.35, show], [end, hide], [FLOW_DUR, hide]);
    else stops.push([FLOW_DUR, show]);
    return { name: `cue-${i}`, sel: `.flowf__cue--${i}`, stops };
  }),
];

export function flowCss(): string {
  return tracks
    .map((tr) => `${keyframes(`ff-${tr.name}`, FLOW_DUR, tr.stops)}.flowf ${tr.sel}{animation-name:ff-${tr.name}}`)
    .join("");
}
