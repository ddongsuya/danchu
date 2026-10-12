import { CUE_FADE_IN, CUE_FADE_OUT, END_STEPS, type BrandFilmSpec, type LabFilmSpec, type MarkFilmSpec } from "@/lib/brand-film";

/**
 * 브랜드 필름 그림 층의 키프레임. 시각은 초 단위이고 lib/brand-film.ts 의 beats·cues·endcardAt 에서 나온다.
 * 출력은 CSS @keyframes(필름 길이 = duration, 진행 linear, 구간 커브는 키프레임의 animation-timing-function).
 * 움직이는 속성은 transform(translate·rotate·scale 포함)·opacity·clip-path 뿐이다.
 *
 * 커브는 아래 넷만 쓴다. ease-in(끝에서 빨라지는 커브)은 쓰지 않는다.
 * out·inout 은 app/globals.css 의 --ease-out·--ease-in-out 과 같은 값이다.
 * 키프레임 안의 animation-timing-function 은 var()를 풀지 않으므로(Chromium 실측: 기본값 ease 로 떨어짐) 값을 여기 한 곳에 둔다.
 */
export const EASE = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  inout: "cubic-bezier(0.77, 0, 0.175, 1)",
  sine: "cubic-bezier(0.45, 0, 0.55, 1)",
  linear: "linear",
} as const;
export type Ease = keyof typeof EASE;

/** [시각(초), 선언, 다음 정지점까지의 커브] */
export type Stop = readonly [t: number, css: string, ease?: Ease];
/** sel: 무대 안 선택자(필름 범위는 자동으로 붙는다) */
export type Track = { name: string; sel: string; stops: Stop[] };

const pct = (t: number, d: number) => `${((Math.min(Math.max(t, 0), d) / d) * 100).toFixed(3)}%`;

const props = (css: string) => css.split(";").map((d) => d.split(":")[0].trim()).filter(Boolean);

export function keyframes(name: string, d: number, stops: readonly Stop[]): string {
  // 처음·마지막 정지점에 없는 속성은 요소의 기본 스타일과 섞여 튀므로, 쓰인 속성은 둘 다에 있어야 한다
  const used = new Set(stops.flatMap(([, css]) => props(css)));
  for (const edge of [stops[0], stops[stops.length - 1]]) {
    const have = new Set(props(edge[1]));
    for (const p of used) if (!have.has(p)) throw new Error(`${name}: ${edge[0]}초 정지점에 ${p} 가 없다`);
  }
  const body = stops.map(([t, css, ease], i) => {
    if (i > 0 && t <= stops[i - 1][0]) throw new Error(`${name}: 정지점 시각이 거꾸로다 (${stops[i - 1][0]} -> ${t})`);
    let sel = pct(t, d);
    if (i === 0 && t > 0) sel = `0%,${sel}`;
    if (i === stops.length - 1 && t < d) sel = `${sel},100%`;
    return `${sel}{${css}${ease ? `;animation-timing-function:${EASE[ease]}` : ""}}`;
  });
  return `@keyframes ${name}{${body.join("")}}`;
}

/* ── 채우기(두 필름 공통): 단추가 아래 천에서 위 천 가장자리 밑으로 들어가, 단춧구멍을 통과해 올라와 눕는다 ── */
function fastenTracks(F: number, E: number, appear: "fade" | "swap"): Track[] {
  const start = "translate:0 calc(var(--m) * 1.5)";
  return [
    {
      name: "fx-under",
      sel: ".bfilm-fx__under",
      stops: appear === "fade"
        ? [
            [0, `opacity:0;translate:0 calc(var(--m) * 1.62)`],
            [F - 0.45, `opacity:0;translate:0 calc(var(--m) * 1.62)`, "out"],
            [F, `opacity:1;${start}`],
            [F + 0.1, start, "inout"],
            [F + 0.75, "opacity:1;translate:0 0"],
            [F + 0.8, "opacity:0;translate:0 0"],
          ]
        : [
            [0, `opacity:0;${start}`],
            [F - 0.02, "opacity:0"],
            [F, "opacity:1"],
            [F + 0.1, start, "inout"],
            [F + 0.75, "opacity:1;translate:0 0"],
            [F + 0.8, "opacity:0;translate:0 0"],
          ],
    },
    {
      // 틈 선에서 위아래로 열리며(clip-path) 비스듬히 선 단추가 천 위로 눕는다(rotateX). 살짝 눌렸다가 선다.
      name: "fx-button",
      sel: ".bfilm-fx__button",
      stops: [
        [0, "opacity:0;transform:var(--fx-in);clip-path:inset(50% -10% 50% -10%)"],
        [F + 0.68, "opacity:0"],
        [F + 0.7, "opacity:1;transform:var(--fx-in);clip-path:inset(50% -10% 50% -10%)", "out"],
        [F + 1.4, "transform:var(--fx-seat);clip-path:inset(-10% -10% -10% -10%)", "out"],
        [F + 1.7, "transform:var(--fx-rest)"],
        [E, "transform:var(--fx-rest)", "inout"],
        [E + 0.8, "transform:var(--fx-end)"],
        [E + 0.86, "opacity:1"],
        [E + 0.9, "opacity:0;transform:var(--fx-end);clip-path:inset(-10% -10% -10% -10%)"],
      ],
    },
    {
      name: "fx-shadow",
      sel: ".bfilm-fx__shadow",
      stops: [[0, "opacity:0"], [F + 1.35, "opacity:0", "out"], [F + 1.75, "opacity:1"]],
    },
  ];
}

/**
 * 천 장면의 불투명도. 1 대신 .999 를 쓴다: Chromium(헤드리스 캡처)에서 clip-path 가 걸린 이 층이 불투명도 1 이면
 * 클립 바깥의 무대 전체가 투명하게 찍히는 문제가 있었다(포털 중간 프레임이 검게 나옴). .999 는 눈으로 구분되지 않는다.
 */
const FABRIC_ON = "opacity:0.999";
/** 천 장면이 엔드카드 바탕(--surface)으로 사라진다. 두 필름의 엔드카드 바탕은 같다. */
const fabricOut = (E: number, clip: string): Stop[] => [[E, FABRIC_ON, "out"], [E + 0.6, `opacity:0;${clip}`]];

function markTracks(spec: MarkFilmSpec): Track[] {
  const { gather: G, plate: P, portal: O, level: L, fasten: F } = spec.beats;
  const E = spec.endcardAt;
  const hole = (r: string) => `clip-path:circle(${r} at var(--hole-x) var(--hole-y))`;
  return [
    {
      // 컷1: 화면 곳곳에서 서로 다른 방향으로 아주 느리게 떠다닌다. 컷2: 곧장 가운데(구멍 자리)로 끌려온다.
      name: "dot",
      sel: ".bfilm-mk__dot",
      stops: [
        [0, "opacity:0;translate:var(--p0);scale:var(--s)", "sine"],
        [0.35, "opacity:1"],
        [G, "translate:var(--p1);scale:var(--s)", "inout"],
        [G + 2, "translate:0 0;scale:1"],
        [O + 0.355, "opacity:1"],
        [O + 0.36, "opacity:0;translate:0 0;scale:1"],
      ],
    },
    {
      // 점 안쪽이 열려 구멍이 된다(점 → 고리 → 구멍). 판보다 조금 먼저 시작해 판 위에서 진한 점이 보이지 않게 한다.
      name: "hole",
      sel: ".bfilm-mk__dot i",
      stops: [[0, "clip-path:circle(0% at 50% 50%)"], [P - 0.15, "clip-path:circle(0% at 50% 50%)", "out"], [P + 0.35, "clip-path:circle(50% at 50% 50%)"]],
    },
    {
      // 바느질 실: 늘어진 S자로 그려지고(왼쪽부터), 점이 모일 때 팽팽해진다(세로로 납작해짐). 판이 서면 사라진다.
      name: "thread",
      sel: ".bfilm-mk__thread",
      stops: [
        [0, "opacity:0;clip-path:inset(-50% 100% -50% 0)"],
        [G - 0.1, "opacity:1;clip-path:inset(-50% 100% -50% 0)", "sine"],
        [G + 1.4, "clip-path:inset(-50% 0 -50% 0)"],
        [P + 0.15, "opacity:1", "out"],
        [P + 0.6, "opacity:0;clip-path:inset(-50% 0 -50% 0)"],
      ],
    },
    {
      name: "taut",
      sel: ".bfilm-mk__thread g",
      stops: [[0, "transform:scaleY(1)"], [G + 0.8, "transform:scaleY(1)", "inout"], [P + 0.2, "transform:scaleY(0.02)"]],
    },
    {
      name: "plate",
      sel: ".bfilm-mk__plate",
      stops: [
        [0, "opacity:0;scale:0.88"],
        [P, "opacity:0;scale:0.88", "out"],
        [P + 0.5, "opacity:1;scale:1"],
        [O + 0.355, "opacity:1"],
        [O + 0.36, "opacity:0;scale:1"],
      ],
    },
    {
      // 컷3 구멍 속으로: 왼쪽 위 구멍에서 원이 열려 천 장면이 된다. 엔드카드에서 사라진다.
      name: "fabric",
      sel: ".bfilm-fx",
      stops: [
        [0, `opacity:0;${hole("var(--hole-r)")}`],
        [O, `opacity:0;${hole("var(--hole-r)")}`, "sine"],
        [O + 0.08, FABRIC_ON],
        // 판 안에서 구멍이 커지는 0.35초(판 가장자리까지 .34 × 단추)를 보여 준 뒤, 판을 넘는 순간부터는 빠르게 화면 끝까지.
        // 흐린 원판이 바탕 위에 떠 있는 단계를 두 프레임 안쪽으로 줄인다.
        [O + 0.35, hole("calc(var(--m) * 0.32)"), "out"],
        [O + 0.85, hole("var(--far)")],
        ...fabricOut(E, hole("var(--far)")),
      ],
    },
    {
      // 위 천: 컷3 동안 아래쪽에 기운 여밈선으로 있다가, 컷4에서 올라와 -4.5° → +2° → 0° 로 수평이 되어 맞물린다.
      name: "top",
      sel: ".bfilm-fx__top",
      stops: [
        [0, "translate:0 var(--drop);rotate:-6deg", "sine"],
        [L, "translate:0 var(--drop);rotate:-4.5deg", "inout"],
        [L + 0.9, "rotate:2deg", "sine"],
        [L + 1.4, "translate:0 0"],
        [L + 1.75, "translate:0 0;rotate:0deg"],
      ],
    },
    {
      // 단춧구멍: 테두리 없는 홈 하나가 가운데에서 양옆으로 열린다
      name: "slit",
      sel: ".bfilm-fx__slit",
      stops: [[0, "opacity:0;clip-path:inset(0 50% 0 50%)"], [L + 1.3, "opacity:1;clip-path:inset(0 50% 0 50%)", "out"], [L + 1.8, "opacity:1;clip-path:inset(0 0 0 0)"]],
    },
    ...fastenTracks(F, E, "fade"),
  ];
}

function labTracks(spec: LabFilmSpec): Track[] {
  const { shot2: S2, shot3: S3, focus: R, wells: W, wipe: X, fasten: F } = spec.beats;
  const E = spec.endcardAt;
  const lastCue = spec.cues[spec.cues.length - 1];
  const dots = ["a", "b", "c", "d"].map((k, i): Track => ({
    name: `dot-${k}`,
    sel: `.bfilm-lb__dot--${k}`,
    stops: [[0, "opacity:0;clip-path:circle(22% at 50% 50%)"], [W + i * 0.08, "opacity:0;clip-path:circle(22% at 50% 50%)", "out"], [W + i * 0.08 + 0.45, "opacity:1;clip-path:circle(50% at 50% 50%)"]],
  }));
  return [
    { name: "l1", sel: ".bfilm-lb__shot--L1", stops: [[0, "opacity:0", "out"], [0.5, "opacity:1"], [S2 + 0.4, "opacity:1"], [S2 + 0.42, "opacity:0"]] },
    { name: "kb1", sel: ".bfilm-lb__shot--L1 img", stops: [[0, "transform:scale(1) translate(0, 0)"], [S2 + 0.4, "transform:scale(1.06) translate(-0.8%, 0.4%)"]] },
    { name: "l2", sel: ".bfilm-lb__shot--L2", stops: [[0, "opacity:0"], [S2 - 0.4, "opacity:0", "inout"], [S2 + 0.4, "opacity:1"], [S3 + 0.4, "opacity:1"], [S3 + 0.42, "opacity:0"]] },
    { name: "kb2", sel: ".bfilm-lb__shot--L2 img", stops: [[0, "transform:scale(1) translate(0, 0)"], [S2 - 0.4, "transform:scale(1) translate(0, 0)"], [S3 + 0.4, "transform:scale(1.06) translate(0.9%, 0)"]] },
    // 컷3: 크게 흐린 플레이트(시료 비교로 읽히지 않게). 문장이 사라진 뒤 초점이 맞는다.
    { name: "l3b", sel: ".bfilm-lb__shot--L3b", stops: [[0, "opacity:0"], [S3 - 0.4, "opacity:0", "inout"], [S3 + 0.4, "opacity:1"], [X + 0.8, "opacity:1"], [X + 0.82, "opacity:0"]] },
    { name: "kb3b", sel: ".bfilm-lb__shot--L3b img", stops: [[0, "transform:scale(1.06)"], [S3 - 0.4, "transform:scale(1.06)"], [R + 0.6, "transform:scale(1.1)"]] },
    { name: "l3", sel: ".bfilm-lb__shot--L3", stops: [[0, "opacity:0"], [R, "opacity:0", "out"], [R + 0.6, "opacity:1"], [X + 0.8, "opacity:1"], [X + 0.82, "opacity:0"]] },
    // 웰 정렬 기준: 초점이 다 맞을 때 배율 1
    { name: "kb3", sel: ".bfilm-lb__shot--L3 img", stops: [[0, "transform:scale(1.025)"], [R, "transform:scale(1.025)", "out"], [R + 0.6, "transform:scale(1)"]] },
    {
      name: "scrim",
      sel: ".bfilm-lb__scrim",
      stops: [[0, "opacity:0", "out"], [0.5, "opacity:1"], [lastCue.end - CUE_FADE_OUT, "opacity:1", "out"], [lastCue.end + 0.3, "opacity:0"]],
    },
    {
      // AI 생성 표시는 AI 장면이 화면에 남아 있는 동안 계속 보인다. 천이 다 덮는 순간(X + 0.8) 함께 내려간다.
      name: "credit",
      sel: ".bfilm-lb__credit",
      stops: [[0, "opacity:0", "out"], [0.5, "opacity:1"], [X + 0.8, "opacity:1"], [X + 0.82, "opacity:0"]],
    },
    ...dots,
    { name: "plate", sel: ".bfilm-lb__plate", stops: [[0, "opacity:0;transform:translateY(3%) scale(0.94)"], [W + 0.4, "opacity:0;transform:translateY(3%) scale(0.94)", "out"], [W + 0.9, "opacity:1;transform:none"]] },
    { name: "hole", sel: ".bfilm-lb__dot i", stops: [[0, "opacity:0"], [W + 0.5, "opacity:0", "out"], [W + 0.95, "opacity:1"]] },
    {
      // 웰 위의 마크 → 천이 열리는 동안 작아지며 아래 천의 단추 자리로 → 같은 자리의 채우기 단추로 바뀐다
      name: "mark",
      sel: ".bfilm-lb__mark",
      stops: [
        [0, "opacity:0;transform:none"],
        [W - 0.02, "opacity:0"],
        [W, "opacity:1"],
        [X + 0.4, "transform:none", "inout"],
        [F, "opacity:1;transform:var(--lb-go)"],
        [F + 0.02, "opacity:0;transform:var(--lb-go)"],
      ],
    },
    {
      // 바탕 전환: 마크의 외곽(둥근 사각형)에서 천 장면이 화면 전체로 넓어진다. 시작 모양이 판과 같아 비어져 나올 틈이 없다.
      name: "fabric",
      sel: ".bfilm-fx",
      stops: [
        [0, "opacity:0;clip-path:var(--lb-wipe0)"],
        [X - 0.02, "opacity:0;clip-path:var(--lb-wipe0)"],
        [X, `${FABRIC_ON};clip-path:var(--lb-wipe0)`, "inout"],
        [X + 0.8, "clip-path:var(--lb-wipe1)"],
        ...fabricOut(E, "clip-path:var(--lb-wipe1)"),
      ],
    },
    ...fastenTracks(F, E, "swap"),
  ];
}

export function filmTracks(spec: BrandFilmSpec): Track[] {
  return spec.id === "mark" ? markTracks(spec) : labTracks(spec);
}

/** 문구·엔드카드 키프레임. 문구 타이밍의 원본은 lib/brand-film.ts 하나다. */
function textCss(spec: BrandFilmSpec): string[] {
  const d = spec.durationSec;
  const out: string[] = [];
  spec.cues.forEach((c, i) => {
    const name = `bfilm-${spec.id}-cue-${i}`;
    out.push(
      keyframes(name, d, [
        [c.start, "opacity:0;transform:translate3d(0,var(--rise),0)", "out"],
        [c.start + CUE_FADE_IN, "opacity:1;transform:none", "linear"],
        [c.end - CUE_FADE_OUT, "opacity:1;transform:none", "out"],
        [c.end, "opacity:0;transform:none"],
      ]) + `.${name}{animation-name:${name}}`,
    );
  });
  END_STEPS.forEach((s) => {
    const name = `bfilm-${spec.id}-end-${s.cls}`;
    const from = s.rise ? "translate3d(0,var(--rise),0)" : "none";
    out.push(
      keyframes(name, d, [
        [spec.endcardAt + s.at, `opacity:0;transform:${from}`, "out"],
        [spec.endcardAt + s.at + s.dur, "opacity:1;transform:none"],
      ]) + `.${name}{animation-name:${name}}`,
    );
  });
  return out;
}

/** 필름 하나의 무대 키프레임 전부(문구·엔드카드·그림) */
export function filmCss(spec: BrandFilmSpec): string {
  const scope = `.bfilm[data-film="${spec.id}"]`;
  const art = filmTracks(spec).map((tr) => {
    const name = `bfilm-${spec.id}-${tr.name}`;
    const sels = tr.sel.split(",").map((s) => `${scope} ${s.trim()}`).join(",");
    return `${keyframes(name, spec.durationSec, tr.stops)}${sels}{animation-name:${name}}`;
  });
  return [...textCss(spec), ...art].join("\n");
}
