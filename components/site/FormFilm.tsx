"use client";

import type { Track } from "./brand-film-motion";
import { Film, sceneTracks, type Scene } from "./Film";

/**
 * 같은 양식 필름: 기관의 회신 한 장이 여섯 칸으로 채워지는 과정. 마지막에 정본 PDF 도장.
 * 칸 이름과 순서는 소개 페이지의 "같은 양식에 담기는 것" 목록과 같다. 값은 예시.
 */
const DUR = 14;
const SCENES: Scene[] = [
  ["항목별 금액", 0, "요청서의 시험 항목이 그대로 행이 됩니다"],
  ["예상 소요기간", 2, "동물 입고일부터 최종보고서(안)까지, 주 단위"],
  ["기본 포함 항목", 4, "임상병리, 조직병리, TK 분석, 조제물분석, 통계분석 등"],
  ["설계 요약", 6, "동물종·계통, 군 구성, 회복기간, 투여경로와 빈도"],
  ["기관마다 다른 부분", 8, "가이드라인이 정하지 않은 것은 기관의 설명 그대로"],
  ["GLP · 유효기간 · 착수일 · 결제", 10, "제출처와 보유 인증을 짝지어 표시합니다"],
  ["정본 PDF", 12, "비교표와 다르면 기관의 PDF 견적서가 우선합니다"],
];
const ROW_Y = [150, 250, 350, 450, 550, 650];
const hide = "opacity:0";
const show = "opacity:1";

const TRACKS: Track[] = [
  ...ROW_Y.map((_, i): Track => ({ name: `row-${i}`, sel: `.fm-row--${i}`, stops: [[0, "opacity:0.18"], [Math.max(i * 2 + 0.3 - 0.01, 0.01), "opacity:0.18"], [i * 2 + 0.8, show], [DUR, show]] })),
  // 지금 채우는 칸을 따라 내려가는 띠. 마지막(정본)에서 사라진다
  { name: "focus", sel: ".fm-focus", stops: [
    [0, `${show};transform:translateY(0px)`],
    ...ROW_Y.flatMap((y, i): Track["stops"] => (i === 0 ? [] : [[i * 2 - 0.4, `${show};transform:translateY(${ROW_Y[i - 1] - 150}px)`, "inout"], [i * 2 + 0.2, `${show};transform:translateY(${y - 150}px)`]])),
    [11.8, `${show};transform:translateY(500px)`], [12.3, `${hide};transform:translateY(500px)`], [DUR, `${hide};transform:translateY(500px)`],
  ] },
  { name: "stamp", sel: ".fm-stamp", stops: [[0, `${hide};transform:rotate(-12deg) scale(1.3)`], [12.2, `${hide};transform:rotate(-12deg) scale(1.3)`, "out"], [12.7, `${show};transform:rotate(-12deg) scale(1)`], [DUR, `${show};transform:rotate(-12deg) scale(1)`]] },
  ...sceneTracks(SCENES, DUR, false),
];

const ROWS: [string, string[]][] = [
  ["항목별 금액", ["반복투여 4주 · 설치류   9,800만", "복귀돌연변이(Ames)   1,100만"]],
  ["예상 소요기간", ["14주 · 동물 입고일 → 최종보고서(안)"]],
  ["기본 포함", ["임상병리  조직병리  TK 분석  조제물분석  통계분석  QA 점검"]],
  ["설계 요약", ["SD 랫드 · 대조 1 + 시험 3군 · 암수 각 10 · 회복 4주 · 경구 1일 1회"]],
  ["기관마다 다른 부분", ["회복 동물: 고용량군·대조군에 성별 5마리 추가"]],
  ["GLP · 조건", ["식약처 대응 · 유효 30일 · 착수 3주 후 · 선급 30 중도 40 잔금 30"]],
];

export function FormFilm() {
  return (
    <Film scope="fm" dur={DUR} scenes={SCENES} tracks={TRACKS} title="기관의 회신이 같은 양식의 여섯 칸으로 채워지는 과정">
      <svg viewBox="0 0 1200 900" aria-hidden="true">
        <rect className="fm-sheet" x="200" y="90" width="800" height="740" rx="14" />
        <text className="fm-title" x="236" y="128">기관 A 회신 · DC-2026-0012</text>
        <line className="fm-rule" x1="200" y1="140" x2="1000" y2="140" />
        <rect className="fm-focus" x="206" y="146" width="788" height="94" rx="8" />
        {ROWS.map(([k, lines], i) => (
          <g key={k} className={`fm-row fm-row--${i}`}>
            <text className="fm-k" x="236" y={ROW_Y[i] + 36}>{k}</text>
            {lines.map((l, j) => <text key={j} className="fm-v" x="470" y={ROW_Y[i] + 36 + j * 30}>{l}</text>)}
            <line className="fm-rule" x1="200" y1={ROW_Y[i] + 90} x2="1000" y2={ROW_Y[i] + 90} />
          </g>
        ))}
        <g className="fm-stamp">
          <rect x="730" y="705" width="200" height="64" rx="8" />
          <text x="830" y="748" textAnchor="middle">정본 PDF 첨부</text>
        </g>
      </svg>
    </Film>
  );
}
