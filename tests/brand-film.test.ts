import { describe, expect, it } from "vitest";
import { BRAND_FILMS, END_SETTLED, MIN_CUE_HOLD, MIN_END_HOLD, cueHold, CUE_FADE_IN, type BrandFilmSpec } from "@/lib/brand-film";
import { EASE, filmCss, filmTracks } from "@/components/site/brand-film-motion";

const films: BrandFilmSpec[] = [BRAND_FILMS.mark, BRAND_FILMS.lab];

describe.each(films)("브랜드 필름 $id 타이밍", (spec) => {
  it("문장은 다 보인 뒤 1.5초 이상 머문다 (end - start >= 2.55)", () => {
    for (const c of spec.cues) expect(cueHold(c), c.text).toBeGreaterThanOrEqual(MIN_CUE_HOLD - 1e-9);
  });
  it("문장은 차례대로 나오고 겹치지 않으며 엔드카드 전에 끝난다", () => {
    spec.cues.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start);
      if (i > 0) expect(c.start).toBeGreaterThanOrEqual(spec.cues[i - 1].end);
    });
    expect(spec.cues[spec.cues.length - 1].end).toBeLessThanOrEqual(spec.endcardAt);
  });
  it("엔드카드가 다 선 뒤 3초 이상 정지한다", () => {
    expect(spec.durationSec - (spec.endcardAt + END_SETTLED)).toBeGreaterThanOrEqual(MIN_END_HOLD - 1e-9);
  });
  it("그림 키프레임은 필름 안에서 끝나고, 처음·마지막 정지점에 모든 속성이 있다", () => {
    const tracks = filmTracks(spec);
    for (const tr of tracks) {
      for (const [t] of tr.stops) {
        expect(t, tr.name).toBeGreaterThanOrEqual(0);
        expect(t, tr.name).toBeLessThanOrEqual(spec.durationSec);
      }
    }
    expect(() => filmCss(spec)).not.toThrow();
  });
  it("커브는 ease-out·in-out·sine·linear 뿐이다(ease-in 없음)", () => {
    const css = filmCss(spec);
    const used = new Set(css.match(/animation-timing-function:[^;}]+/g)?.map((s) => s.split(":")[1]) ?? []);
    for (const e of used) expect(Object.values(EASE) as string[]).toContain(e);
    expect(css).not.toMatch(/ease-in(?!-out)/);
  });
  it("화면 문자열에 긴 대시가 없다", () => {
    const all = [...spec.cues.map((c) => c.text), ...Object.values(spec.endcard)].join("");
    expect(all).not.toMatch(/[—–]/);
  });
});

describe("장면 전환 중에는 글자를 바꾸지 않는다", () => {
  it("B안: 구멍이 열리기 전에 컷2 문장이 사라지고, 구멍이 문장 자리를 덮은 뒤 컷3 문장이 나온다", () => {
    const { cues, beats } = BRAND_FILMS.mark;
    expect(cues[1].end).toBeLessThanOrEqual(beats.portal);
    expect(cues[2].start).toBeGreaterThanOrEqual(beats.portal + 0.6);
    expect(cues[2].end).toBeLessThanOrEqual(beats.level);
  });
  it("B안: 완성된 네 구멍 마크가 컷2 문장과 함께 1초 이상 정지한다", () => {
    const { cues, beats } = BRAND_FILMS.mark;
    // 판은 plate + 0.5초에 다 선다. 문장은 end - 0.45초부터 사라진다.
    expect(cues[1].end - 0.45 - (beats.plate + 0.5)).toBeGreaterThanOrEqual(1);
    expect(cues[1].start + CUE_FADE_IN).toBeLessThanOrEqual(beats.plate + 0.5);
  });
  it("C안: 사진이 겹쳐 바뀌는 0.8초 동안 문장이 없다", () => {
    const { cues, beats } = BRAND_FILMS.lab;
    expect(cues[0].end).toBeLessThanOrEqual(beats.shot2 - 0.4);
    expect(cues[1].start).toBeGreaterThanOrEqual(beats.shot2 + 0.4);
    expect(cues[1].end).toBeLessThanOrEqual(beats.shot3 - 0.4);
    expect(cues[2].start).toBeGreaterThanOrEqual(beats.shot3 + 0.4);
    expect(cues[2].end).toBeLessThanOrEqual(beats.focus);
  });
  it("C안: 첫 문장이 1초 안에 비임상과 견적을 말한다", () => {
    const c = BRAND_FILMS.lab.cues[0];
    expect(c.start + CUE_FADE_IN).toBeLessThanOrEqual(1);
    expect(c.text).toContain("비임상");
    expect(c.text).toContain("견적");
  });
  it("두 필름의 엔드카드는 약속 문장 전체를 한 화면에 둔다", () => {
    for (const s of films) expect(`${s.endcard.lead} ${s.endcard.promise}`).toBe("비임상 시험의 시작, 단추를 채우다.");
  });
});
