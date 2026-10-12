/**
 * 브랜드 필름의 단일 원본. 화면 문구, 문구 타이밍, 그림의 장면 시각(beats)은 여기에만 둔다.
 * components/site/BrandFilm.tsx(재생·스틸), components/site/brand-film-motion.ts(그림 키프레임),
 * 출력 스크립트(scripts/brand-film-export.mjs)가 같이 읽는다. tests/brand-film.test.ts 가 아래 제약을 검사한다.
 *
 * - cues: 화면 문구. start에 나타나기 시작하고 end에 완전히 사라진다(초 단위).
 *   나타나는 데 CUE_FADE_IN, 사라지는 데 CUE_FADE_OUT 이 걸리므로 다 보인 채 머무는 시간은 end - start - 1.05초다.
 *   제약: 1.5초 이상 머문다 → end - start >= 2.55. 장면 전환 중에는 글자를 바꾸지 않는다.
 * - beats: 그림 장면의 기준 시각. 그림 키프레임은 이 시각에서 초 단위로 만들어지므로, 여기만 고치면 그림도 따라간다.
 * - endcardAt: 엔드카드가 시작되는 시각. END_STEPS 가 다 선 뒤 필름 끝까지 3초 이상 정지 화면으로 남는다.
 */

export type FilmId = "mark" | "lab";
export type FilmRatio = "16x9" | "9x16" | "1x1" | "4x5";

export type FilmCue = { start: number; end: number; text: string };

/** lead + promise = 약속 문장 "비임상 시험의 시작, 단추를 채우다."(홈 h1, OG와 같다) */
export type FilmEndcard = { lead: string; promise: string; line: string; domain: string };

/**
 * B안 장면 시각
 * gather 점이 실에 끌려 가운데로 모이기 시작(실은 0.1초 먼저 그려진다) · plate 판이 떠오르고 점이 구멍이 됨
 * portal 왼쪽 위 구멍이 천 장면으로 열림 · level 여밈선이 올라와 수평으로 맞물림 · fasten 단추가 단춧구멍으로(채우기)
 */
export type MarkBeats = { gather: number; plate: number; portal: number; level: number; fasten: number };
/**
 * C안 장면 시각
 * shot2·shot3 사진이 겹쳐 바뀌는 가운데 시각(앞뒤 0.4초) · focus 흐린 플레이트가 선명해짐
 * wells 웰 위에 원이 나타남 · wipe 마크 모양으로 천 장면이 열림 · fasten 단추가 단춧구멍으로(B안과 같은 동작)
 */
export type LabBeats = { shot2: number; shot3: number; focus: number; wells: number; wipe: number; fasten: number };

type SpecBase = {
  title: string;
  durationSec: number;
  endcardAt: number;
  cues: FilmCue[];
  endcard: FilmEndcard;
};
export type MarkFilmSpec = SpecBase & { id: "mark"; beats: MarkBeats };
export type LabFilmSpec = SpecBase & { id: "lab"; beats: LabBeats };
export type BrandFilmSpec = MarkFilmSpec | LabFilmSpec;

export const CUE_FADE_IN = 0.6;
export const CUE_FADE_OUT = 0.45;
export const MIN_CUE_HOLD = 1.5;
/** 문구가 다 보인 채 머무는 시간(초) */
export const cueHold = (c: FilmCue) => c.end - c.start - CUE_FADE_IN - CUE_FADE_OUT;

/** 엔드카드 요소별 등장(엔드카드 시작 기준 초). mark 는 그림 층의 단추가 그 자리로 와서 겹친 뒤 바뀐다. */
export const END_STEPS = [
  { cls: "mark", at: 0.75, dur: 0.15, rise: false },
  { cls: "lead", at: 0.6, dur: 0.6, rise: true },
  { cls: "promise", at: 0.85, dur: 0.7, rise: true },
  { cls: "line", at: 1.2, dur: 0.6, rise: true },
  { cls: "domain", at: 1.3, dur: 0.6, rise: true },
] as const;
/** 엔드카드가 다 선 시각(엔드카드 시작 기준 초) */
export const END_SETTLED = Math.max(...END_STEPS.map((s) => s.at + s.dur));
export const MIN_END_HOLD = 3;

export const FILM_ENDCARD: FilmEndcard = {
  lead: "비임상 시험의 시작,",
  promise: "단추를 채우다.",
  line: "견적과 계약을 한곳에서.",
  domain: "danchu.kr",
};

/** 문장 안 줄바꿈은 "\n". 화면에서는 줄을 나누고, 읽기 목록에서는 한 문장으로 잇는다. */
export const BRAND_FILMS: { mark: MarkFilmSpec; lab: LabFilmSpec } = {
  // B안. 컷: 0-3.5 흩어진 점 · 3.5-7.7 실과 마크 · 7.7-12.4 구멍 속 천 · 12.4-14.3 여밈선 · 14.3-17 채우기(문구 없음) · 17-22 엔드카드
  mark: {
    id: "mark",
    title: "단추를 채우다",
    durationSec: 22,
    endcardAt: 17,
    beats: { gather: 3.6, plate: 5.6, portal: 7.7, level: 12.4, fasten: 14.3 },
    cues: [
      { start: 0.3, end: 3.3, text: "흩어져 있던\n비임상 시험 견적을," },
      { start: 5.0, end: 7.7, text: "하나의 흐름으로." },
      { start: 8.3, end: 12.4, text: "나란히 보여 드립니다.\n고르는 건 의뢰자입니다." },
    ],
    endcard: FILM_ENDCARD,
  },
  // C안. 배경은 AI 생성 이미지(public/brand-film/lab/L1~L3.webp, 출처 docs/brand-film/PROMPTS.txt).
  // 컷: 0-5 L1 · 5-10 L2 · 10-14.15 흐린 L3 · 14.15-17 웰 위의 마크 · 17-19.5 채우기 · 19.5-24.5 엔드카드
  lab: {
    id: "lab",
    title: "첫 단추",
    durationSec: 24.5,
    endcardAt: 19.55,
    beats: { shot2: 5.0, shot3: 10.0, focus: 14.15, wells: 14.8, wipe: 15.95, fasten: 17.05 },
    cues: [
      { start: 0.4, end: 4.6, text: "비임상 시험의 첫 단추,\n견적부터." },
      { start: 5.4, end: 9.6, text: "흩어져 있던 견적을,\n하나의 흐름으로." },
      { start: 10.5, end: 14.1, text: "나란히 보여 드립니다.\n고르는 건 의뢰자입니다." },
    ],
    endcard: FILM_ENDCARD,
  },
};

export const FILM_IDS: FilmId[] = ["mark", "lab"];
export const FILM_RATIOS: FilmRatio[] = ["16x9", "9x16", "1x1", "4x5"];

/** 출력 파일 크기(픽셀). 1080 기준. */
export const FILM_SIZES: Record<FilmRatio, { width: number; height: number }> = {
  "16x9": { width: 1920, height: 1080 },
  "9x16": { width: 1080, height: 1920 },
  "1x1": { width: 1080, height: 1080 },
  "4x5": { width: 1080, height: 1350 },
};

/** 읽기 목록과 자막용: 줄바꿈을 공백으로 */
export const cueLine = (text: string) => text.replace(/\n/g, " ");

export function isFilmId(v: unknown): v is FilmId {
  return v === "mark" || v === "lab";
}
export function isFilmRatio(v: unknown): v is FilmRatio {
  return v === "16x9" || v === "9x16" || v === "1x1" || v === "4x5";
}
