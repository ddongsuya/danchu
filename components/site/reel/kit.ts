import gsap from "gsap";

/**
 * 메뉴 페이지 영상(릴)을 만드는 도구 모음.
 * 무대는 고정 크기 캔버스(가로형 L, 세로형 P) 위에 절대 위치로 그리고, Reel 이 화면에 맞게 축소한다.
 * 타임라인에는 tl.call 을 쓰지 않는다. 모든 변화가 트윈이라 단계 버튼으로 앞뒤 어디로 옮겨도 장면이 맞게 보인다.
 */

export type Tl = gsap.core.Timeline;
export type Build = (cv: HTMLDivElement, P: boolean) => Tl;
export type Dims = { L: [number, number]; P: [number, number] };

export const px = (n: number) => `${n}px`;

export function el<T extends HTMLElement = HTMLDivElement>(parent: HTMLElement, cls = "", html?: string | null, css?: Partial<CSSStyleDeclaration>, tag = "div"): T {
  const d = document.createElement(tag) as T;
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  if (css) Object.assign(d.style, css);
  parent.appendChild(d);
  return d;
}

export function box<T extends HTMLElement>(d: T, x: number, y: number, w?: number, h?: number): T {
  d.style.left = px(x);
  d.style.top = px(y);
  if (w != null) d.style.width = px(w);
  if (h != null) d.style.height = px(h);
  return d;
}

/** 만 원 단위 정수를 "3억 1,200만" 처럼 */
export function won(m: number): string {
  m = Math.round(m);
  const e = Math.floor(m / 10000), r = m % 10000;
  const rs = r ? `${r.toLocaleString("ko-KR")}만` : "";
  return e ? `${e}억${rs ? ` ${rs}` : ""}` : rs;
}

/** 숫자가 올라가며 자리 잡는다 (되감기 가능) */
export function count(tl: Tl, node: HTMLElement, to: number, at: number, d = 0.8, from = 0, fmt: (n: number) => string = won) {
  const o = { v: from };
  tl.fromTo(o, { v: from }, {
    v: to, duration: d, ease: "expo.out", immediateRender: false,
    onUpdate() { node.textContent = this.progress() >= 1 ? fmt(to) : fmt(Math.round(o.v / 100) * 100); },
  }, at);
}

/** 문장을 글자 단위 span 으로 쪼갠다. 단어는 줄바꿈 단위로 묶는다 */
export function chars(parent: HTMLElement, text: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  text.split(" ").forEach((word, wi, arr) => {
    const w = el(parent, "rl-w", null, undefined, "span");
    for (const ch of word) out.push(el(w, "rl-ch", ch, undefined, "span"));
    if (wi < arr.length - 1) parent.appendChild(document.createTextNode(" "));
  });
  return out;
}

/**
 * 자막: 기존 영상과 같은 두 줄(굵은 첫 줄 + 옅은 둘째 줄). 글자가 차례로 아래에서 올라오며 흐림이 걷힌다.
 * 다음 자막이 오기 직전에 위로 살짝 빠진다.
 */
export function captions(cv: HTMLElement, W: number, H: number, P: boolean, lines: [number, string, string][], end: number, opts: { size?: number; bottom?: number } = {}) {
  const fs = opts.size ?? (P ? 34 : 27);
  const wrap = el(cv, "rl-caps", null, { left: "0", width: px(W), top: px(H - (opts.bottom ?? (P ? 128 : 96))), height: px(fs * 2.7) });
  return (tl: Tl) => {
    lines.forEach(([t, a, b], i) => {
      const c = el(wrap, "rl-cap", null, { fontSize: px(fs) });
      const l1 = el(c, "rl-l1", null, undefined, "span");
      const l2 = el(c, "rl-l2", null, undefined, "span");
      const cs = chars(l1, a).concat(chars(l2, b));
      const next = lines[i + 1]?.[0] ?? end + 1;
      tl.set(c, { autoAlpha: 0 }, 0);
      tl.set(c, { autoAlpha: 1, y: 0 }, t);
      tl.fromTo(cs, { opacity: 0, yPercent: 55, filter: "blur(5px)" }, { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 0.42, ease: "expo.out", stagger: 0.016 }, t);
      if (next <= end) tl.to(c, { autoAlpha: 0, y: -14, duration: 0.22, ease: "power2.out" }, next - 0.18);
    });
  };
}

/** 카메라: 월드 좌표의 한 점을 화면의 한 점(기본 중앙)에 맞추고 배율을 바꾼다 */
export function camera(world: HTMLElement, W: number, H: number, focusY = H / 2) {
  const cam = { x: W / 2, y: focusY, s: 1 };
  const apply = () => { world.style.transform = `translate(${W / 2 - cam.x * cam.s}px,${focusY - cam.y * cam.s}px) scale(${cam.s})`; };
  apply();
  return {
    set(tl: Tl, x: number, y: number, s: number, at = 0) { tl.fromTo(cam, { x, y, s }, { x, y, s, duration: 0.01, ease: "none", onUpdate: apply }, at); },
    to(tl: Tl, at: number, x: number, y: number, s: number, d = 1, ease = "expo.inOut") { tl.to(cam, { x, y, s, duration: d, ease, onUpdate: apply }, at); },
    apply,
  };
}

/** 카메라가 움직이는 세계. 자막 자리(viewH 아래)는 잘라 내어 겹치지 않게 한다 */
export function worldIn(cv: HTMLElement, W: number, viewH: number) {
  const view = el(cv, "", null, { left: "0", top: "0", width: px(W), height: px(viewH), overflow: "hidden" });
  return el(view, "", null, { left: "0", top: "0", width: px(W), height: px(viewH), transformOrigin: "0 0" });
}

/** 문서 한 장(종이 + 그림자) */
export function sheet(parent: HTMLElement, x: number, y: number, w: number, h: number, cls = "") {
  return box(el(parent, `rl-doc ${cls}`.trim()), x, y, w, h);
}

/** 글줄 자리 표시(회색 막대) */
export function bars(parent: HTMLElement, x: number, ys: number[], ws: number[], h = 8) {
  return ys.map((y, i) => box(el(parent, "rl-bar"), x, y, ws[i % ws.length], h));
}

/** 형광펜 한 획 (scaleX 0 → 1) */
export function marker(parent: HTMLElement, x: number, y: number, w: number, h: number) {
  const m = box(el(parent, "rl-mk"), x, y, w, h);
  return m;
}

export { gsap };
