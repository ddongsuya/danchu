import { gsap, el, box, px, sheet, type Tl } from "../kit";

const dims = (L: [number, number], P: [number, number]) => ({ L, P });

/* ================================================================
 * 반복투여독성 기간: 큰 글씨 리듬. 임상 기간이 바뀌면 막대가 늘고 줄며 필요한 기간이 바뀐다.
 * 기간은 주 단위 실제 비율(최소 폭만 둠). 근거 ICH M3.
 * ================================================================ */
export const WEEK_TABS = ["2주 이내", "2주 초과 ~ 6개월", "6개월 초과"];
type Scene = { title: string; clin: [number, string, boolean?]; rod: [number, string]; non: [number, string]; note?: string; req: string; diff?: "non" };
const SCENES: Scene[] = [
  { title: "임상 2주 이내", clin: [2, "2주"], rod: [2, "2주"], non: [2, "2주"], req: "요청서 항목 · 반복투여 2주" },
  { title: "임상 2주 초과 ~ 6개월", clin: [13, "예: 3개월"], rod: [13, "3개월"], non: [13, "3개월"], note: "임상과 같게", req: "요청서 항목 · 반복투여 13주" },
  { title: "임상 6개월 초과", clin: [30, "6개월 넘게", true], rod: [26, "6개월"], non: [39, "9개월"], req: "요청서 항목 · 반복투여 26주 · 39주", diff: "non" },
];

export function guideWeeks(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1200, H = P ? 700 : 540;
  const tl = gsap.timeline({ paused: true });
  const M = P ? 24 : 60;
  const big = P ? 46 : 60;
  const mask = box(el(cv, "rl-mask"), M, P ? 26 : 30, W - M * 2, big * 1.3);
  const titles = SCENES.map((s) => box(el(mask, "rl-big", s.title, { fontSize: px(big) }), 0, 0));

  const labW = P ? 0 : 170;
  const x0 = M + labW, maxW = W - x0 - M - (P ? 120 : 190);
  const unit = maxW / 39;
  const rowY = P ? [150, 300, 450] : [140, 245, 350];
  const lblFs = P ? 22 : 22, valFs = P ? 30 : 34, barH = P ? 34 : 40;
  const names = ["임상 투여", "설치류", "비설치류"];
  const rows = names.map((n, r) => {
    const y = rowY[r];
    const lab = box(el(cv, "", n, { fontSize: px(lblFs), fontWeight: "550", color: r ? "#33332F" : "#1B1B19", whiteSpace: "nowrap" }), M, P ? y - 36 : y + barH / 2 - lblFs * 0.65);
    const bar = box(el(cv, "", null, { background: r ? "#EDEF5C" : "#1B1B19", transformOrigin: "0 50%", borderRadius: "1px" }), x0, y, maxW, barH);
    const arrow = r === 0 ? box(el(cv, "", "→", { fontSize: px(barH * 0.8), color: "#F4F4F0", fontWeight: "600" }), 0, y + barH * 0.02) : null;
    // 값 글자: 장면마다 하나, 슬롯처럼 바뀐다
    const vm = box(el(cv, "rl-mask"), 0, y + barH / 2 - valFs * 0.7, P ? 150 : 220, valFs * 1.4);
    const vals = SCENES.map((s) => box(el(vm, "rl-num", (r === 0 ? s.clin : r === 1 ? s.rod : s.non)[1], { fontSize: px(valFs), fontWeight: "650", letterSpacing: "-.03em" }), 0, 0));
    return { lab, bar, arrow, vm, vals };
  });
  const sep = box(el(cv, "rl-rule"), M, (rowY[0] + rowY[1]) / 2 + barH / 2 - (P ? 14 : 0), W - M * 2);
  const notes = box(el(cv, "rl-chip", "임상과 같게", { fontSize: px(P ? 19 : 20), background: "#F5F6B4", borderColor: "#1B1B19", fontWeight: "600" }), 0, (rowY[1] + rowY[2]) / 2 + barH / 2 - 22, P ? 140 : 150, 44);
  const diffMk = box(el(cv, "rl-mk", null, { zIndex: "0" }), 0, rowY[2] + barH - 2, P ? 76 : 92, 10);
  const reqY = P ? 590 : 450;
  const reqMask = box(el(cv, "rl-mask"), M, reqY, W - M * 2, 52);
  const reqs = SCENES.map((s) => box(el(reqMask, "rl-chip", s.req, { fontSize: px(P ? 19 : 20), padding: "0 18px", height: "48px" }), 0, 0));

  const wOf = (wk: number) => Math.max(barH * 0.7, wk * unit);
  tl.set(titles, { y: big * 1.4 }, 0).set(reqs, { y: 60 }, 0).set(notes, { autoAlpha: 0 }, 0).set(diffMk, { scaleX: 0, transformOrigin: "0 50%" }, 0);
  rows.forEach((r) => { tl.set(r.vals, { y: valFs * 1.5 }, 0).set(r.bar, { scaleX: 0 }, 0).set(r.vm, { left: x0 + 12 }, 0); if (r.arrow) tl.set(r.arrow, { autoAlpha: 0 }, 0); });
  tl.fromTo([...rows.map((r) => r.lab), sep], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, 0.05);

  const S = 3.6;
  SCENES.forEach((s, i) => {
    const t = i * S + 0.1;
    tl.addLabel(`ch${i}`, Math.max(0, t - 0.1));
    if (i > 0) {
      tl.to(titles[i - 1], { y: -big * 1.4, duration: 0.3, ease: "power3.in" }, t - 0.1);
      tl.to(reqs[i - 1], { y: -60, duration: 0.25, ease: "power3.in" }, t);
      rows.forEach((r) => tl.to(r.vals[i - 1], { y: -valFs * 1.5, duration: 0.25, ease: "power3.in" }, t));
      tl.to(notes, { autoAlpha: 0, duration: 0.2 }, t);
      tl.to(diffMk, { scaleX: 0, duration: 0.2 }, t);
    }
    tl.to(titles[i], { y: 0, duration: 0.5, ease: "expo.out" }, t + 0.15);
    const ws = [s.clin[0], s.rod[0], s.non[0]];
    rows.forEach((r, k) => {
      const w = wOf(ws[k]);
      const at = t + 0.3 + k * 0.12;
      tl.to(r.bar, { scaleX: w / maxW, duration: 0.7, ease: "expo.out" }, at);
      tl.to(r.vm, { left: x0 + w + 14, duration: 0.7, ease: "expo.out" }, at);
      tl.to(r.vals[i], { y: 0, duration: 0.45, ease: "expo.out" }, at + 0.15);
      if (r.arrow) tl.to(r.arrow, { autoAlpha: s.clin[2] ? 1 : 0, left: x0 + w - barH * 0.8, duration: 0.3 }, at + 0.3);
    });
    tl.to(reqs[i], { y: 0, duration: 0.45, ease: "expo.out" }, t + 0.9);
    if (s.note) tl.fromTo(notes, { autoAlpha: 0, left: x0 + wOf(s.non[0]) + (P ? 110 : 150), scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, t + 1.3);
    if (s.diff) {
      tl.set(diffMk, { left: x0 + wOf(s.non[0]) + 10 }, t + 1.2);
      tl.to(diffMk, { scaleX: 1, duration: 0.35, ease: "power3.out" }, t + 1.3);
    }
  });
  tl.to({}, { duration: 1.5 }, SCENES.length * S);
  return tl;
}
export const guideWeeksDims = dims([1200, 540], [600, 700]);

/* ================================================================
 * IND 전 시험 구성: 합성의약품과 바이오의약품을 나란히. 같은 줄에서 비어 있는 칸과 "통상 불필요"가 차이.
 * ================================================================ */
type Cell = [string, string] | null;
const IND: [Cell, Cell][] = [
  [["반복투여독성", "설치류 + 비설치류 · ICH M3"], ["반복투여독성", "회복군 + TK + ADA · ICH S6"]],
  [["용량결정시험(DRF)", "보통 Non-GLP"], null],
  [["단회투여독성", "DRF로 갈음 가능 (규제기관과 확인하세요)"], null],
  [null, ["관련 동물종 선정", "ICH S6"]],
  [["유전독성", "Ames + 염색체이상 · ICH S2"], ["유전독성", "통상 불필요"]],
  [["안전성약리 · hERG", "ICH S7A·S7B"], ["안전성약리", "독성시험에 통합 가능"]],
  [["TK · 조제물분석", "GLP 시험에 병행"], null],
  [null, ["국소내성 · 조직교차반응성", "주사제 · 항체 의약품"]],
];
const LATER = [["생식발생독성", "발암성", "국소내성", "면역독성·광안전성"], ["생식발생독성 (ePPND)", "발암성 평가"]];

export function guideInd(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1000, H = P ? 1060 : 660;
  const tl = gsap.timeline({ paused: true });
  const M = P ? 10 : 24, gap = P ? 10 : 20;
  const LW = (W - M * 2 - gap) / 2;
  const lx = (i: number) => M + i * (LW + gap);
  const headY = 14, rowY0 = P ? 100 : 86, step = P ? 98 : 56, cellH = step - 8;
  const tFs = P ? 21 : 16, sFs = P ? 17 : 13;
  const heads = ["합성의약품 (저분자·경구)", "바이오의약품"].map((t, i) => {
    const h = box(el(cv), lx(i), headY, LW, 64);
    box(el(h, "rl-hd", P ? t.replace(" (저분자·경구)", "") : t, { fontSize: px(P ? 24 : 20) }), 6, 4);
    box(el(h, "rl-sm", P && i === 0 ? "저분자·경구 · 임상 1상 전" : "임상 1상 전", { fontSize: px(P ? 17 : 14) }), 6, P ? 36 : 34);
    box(el(h, "", null, { background: "#1B1B19", height: "2px" }), 0, P ? 70 : 60, LW);
    return h;
  });
  const cells: (HTMLElement | null)[][] = [[], []];
  const holes: HTMLElement[] = [];
  IND.forEach((row, r) => row.forEach((c, i) => {
    const y = rowY0 + r * step;
    if (!c) { const h = box(el(cv, "", null, { border: "1.5px dashed #ADADA6", borderRadius: "2px" }), lx(i), y, LW, cellH); holes.push(h); cells[i].push(null); return; }
    const d = sheet(cv, lx(i), y, LW, cellH);
    box(el(d, "rl-hd", c[0], { fontSize: px(c[0].length > 12 && P ? tFs - 3 : tFs) }), 12, P ? 10 : 7);
    box(el(d, "", c[1], { fontSize: px(sFs), color: "#61615C", whiteSpace: P ? "normal" : "nowrap", width: px(LW - 24), lineHeight: "1.25" }), 12, P ? 40 : 30);
    cells[i].push(d);
  }));
  const genMk = box(el(cv, "rl-mk", null, { zIndex: "0" }), lx(1) - 6, rowY0 + 4 * step - 6, LW + 12, cellH + 12);
  cv.insertBefore(genMk, cv.firstChild);
  const laterY = rowY0 + IND.length * step + (P ? 10 : 8);
  const later = LATER.map((list, i) => {
    const w = box(el(cv), lx(i), laterY, LW, P ? 160 : 80);
    box(el(w, "rl-sm", "나중 단계에서 검토", { fontSize: px(P ? 17 : 13) }), 0, 0);
    const chips: HTMLElement[] = [];
    let x = 0, y = 26;
    list.forEach((t) => {
      const cw = t.length * (P ? 16.5 : 13) + 22;
      if (x + cw > LW) { x = 0; y += P ? 44 : 38; }
      chips.push(box(el(w, "rl-chip", t, { fontSize: px(P ? 16 : 13), borderColor: "#ADADA6", color: "#33332F", height: px(P ? 36 : 30) }), x, y + (P ? 4 : 0), Math.min(cw, LW), P ? 36 : 30));
      x += cw + 8;
    });
    return { w, chips };
  });

  tl.set(genMk, { scaleX: 0, transformOrigin: "0 50%" }, 0);
  tl.fromTo(heads, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.08 }, 0.05);
  // 줄마다 양쪽이 동시에 채워진다. 한쪽만 있는 줄은 반대편이 빈칸으로 남는다
  IND.forEach((_, r) => [0, 1].forEach((i) => {
    const c = cells[i][r];
    const at = 0.45 + r * 0.26 + i * 0.07;
    if (c) tl.fromTo(c, { autoAlpha: 0, x: i ? 30 : -30 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "expo.out" }, at);
  }));
  tl.fromTo(holes, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, stagger: 0.05 }, 0.45 + IND.length * 0.26);
  const dT = 0.6 + IND.length * 0.26;
  tl.to(genMk, { scaleX: 1, duration: 0.45, ease: "power3.inOut" }, dT + 0.2);
  tl.fromTo(cells[1][4], { scale: 1 }, { scale: 1.03, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, dT + 0.5);
  later.forEach((l, i) => tl.fromTo(l.w.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "expo.out", stagger: 0.05 }, dT + 1.0 + i * 0.1));
  tl.to({}, { duration: 2 }, dT + 1.6);
  return tl;
}
export const guideIndDims = dims([1000, 660], [600, 1060]);

/* ================================================================
 * 시험 정보: 시험 이름이 바뀔 때마다 카드 내용이 슬롯처럼 넘어가고, 핵심 값에 형광펜.
 * ================================================================ */
type Info = { t: string; s: string; rows: [string, string][]; key: number; b: string };
const TESTS: Info[] = [
  { t: "단회투여독성", s: "한 번 투여했을 때의 독성 양상", rows: [["동물종", "설치류 + 비설치류"], ["관찰", "투여 후 14일"], ["동물 수", "설치류 군당 암수 각 5마리 이상"], ["GLP", "허가 제출용이면 GLP"]], key: 1, b: "근거 식약처 독성시험기준" },
  { t: "반복투여독성", s: "3개월까지의 임상을 위한 13주 시험", rows: [["동물종", "설치류 + 비설치류"], ["기간", "투여 13주 + 회복 4주"], ["동물 수", "설치류 군당 암수 각 10마리 이상"], ["TK", "병행"]], key: 1, b: "근거 ICH M3 · 식약처 독성시험기준" },
  { t: "유전독성", s: "복귀돌연변이시험 (Ames)", rows: [["시험계", "살모넬라 4균주 + 대장균 1균주"], ["대사활성화", "S9 있을 때와 없을 때 모두"], ["판정", "복귀돌연변이 집락 수 증가"], ["GLP", "GLP"]], key: 0, b: "근거 OECD TG 471 · ICH S2" },
  { t: "안전성약리", s: "주요 장기 기능에 미치는 영향", rows: [["평가", "중추신경계 · 심혈관계 · 호흡계"], ["심장", "hERG 시험 (in vitro)"], ["심혈관", "비설치류 원격측정"], ["GLP", "GLP"]], key: 0, b: "근거 ICH S7A · ICH S7B" },
];
export const TEST_TABS = TESTS.map((x) => x.t);
const OFF = ["생식독성", "국소독성"];

export function guideTests(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1000, H = P ? 760 : 560;
  const tl = gsap.timeline({ paused: true });
  // 왼쪽(세로형은 위) 목록
  const names = [...TESTS.map((x) => x.t), ...OFF];
  const list = names.map((n, i) => {
    const pos = P ? [16 + (i % 3) * 192, 16 + Math.floor(i / 3) * 46] : [36, 60 + i * 64];
    return box(el(cv, "", n, { fontSize: px(P ? 19 : 24), fontWeight: "600", letterSpacing: "-.02em", whiteSpace: "nowrap", color: i < TESTS.length ? "#ADADA6" : "#D9D9D3" }), pos[0], pos[1]);
  });
  const listMk = box(el(cv, "rl-mk", null, { zIndex: "0" }), 0, 0, 10, P ? 10 : 12);
  cv.insertBefore(listMk, cv.firstChild);

  // 카드
  const cx = P ? 16 : 300, cy = P ? 130 : 40, cw = W - cx - (P ? 16 : 40), chh = P ? 600 : 480;
  const card = sheet(cv, cx, cy, cw, chh);
  const pad = P ? 26 : 36;
  const big = P ? 46 : 54;
  const tMask = box(el(card, "rl-mask"), pad, pad - 6, cw - pad * 2, big * 1.3);
  const sMask = box(el(card, "rl-mask"), pad, pad + big * 1.3, cw - pad * 2, 34);
  const scenes = TESTS.map((x) => {
    const t = box(el(tMask, "rl-big", x.t, { fontSize: px(big) }), 0, 0);
    const s = box(el(sMask, "", x.s, { fontSize: px(P ? 19 : 20), color: "#61615C", whiteSpace: "nowrap" }), 0, 2);
    const rows = x.rows.map(([k, v], r) => {
      const y = (P ? 170 : 160) + r * (P ? 92 : 62);
      const m = box(el(card, "rl-mask"), pad, y, cw - pad * 2, P ? 80 : 50);
      const dk = box(el(m, "", k, { fontSize: px(P ? 19 : 17), color: "#61615C", whiteSpace: "nowrap" }), 0, 8);
      const dv = box(el(m, "", `<span style="position:relative">${v}</span>`, { fontSize: px(P ? 21 : 21), fontWeight: "600", whiteSpace: P ? "normal" : "nowrap", width: px(P ? cw - pad * 2 : cw - pad * 2 - 150), lineHeight: "1.3", letterSpacing: "-.02em" }), P ? 0 : 150, P ? 32 : 5);
      return { m, dk, dv, y };
    });
    const b = box(el(card, "rl-sm", x.b, { fontSize: px(P ? 18 : 15) }), pad, chh - pad - 14);
    return { t, s, rows, b };
  });
  const rules = [0, 1, 2].map((r) => box(el(card, "rl-rule"), pad, (P ? 170 : 160) + (r + 1) * (P ? 92 : 62) - (P ? 8 : 6), cw - pad * 2));
  const keyMk = box(el(card, "rl-mk", null, { zIndex: "0" }), 0, 0, 10, P ? 14 : 14);
  card.insertBefore(keyMk, card.firstChild);
  void rules;

  // 초기
  scenes.forEach((s) => {
    tl.set(s.t, { y: big * 1.4 }, 0).set(s.s, { y: 40 }, 0).set(s.b, { autoAlpha: 0 }, 0);
    s.rows.forEach((r) => tl.set([r.dk, r.dv], { y: P ? 90 : 60 }, 0));
  });
  tl.set(listMk, { scaleX: 0, transformOrigin: "0 50%" }, 0).set(keyMk, { scaleX: 0, transformOrigin: "0 50%" }, 0);
  tl.fromTo(card, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 0.05);
  tl.fromTo(list, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.04, ease: "expo.out" }, 0.05);

  const S = 3.4;
  const measure = (node: HTMLElement) => ((node.firstElementChild as HTMLElement | null) ?? node).offsetWidth;
  scenes.forEach((s, i) => {
    const t = i * S + 0.2;
    tl.addLabel(`ch${i}`, Math.max(0, t - 0.2));
    if (i > 0) {
      const p = scenes[i - 1];
      tl.to(p.t, { y: -big * 1.4, duration: 0.28, ease: "power3.in" }, t - 0.1);
      tl.to(p.s, { y: -40, duration: 0.25, ease: "power3.in" }, t - 0.08);
      p.rows.forEach((r, k) => tl.to([r.dk, r.dv], { y: -(P ? 90 : 60), duration: 0.25, ease: "power3.in" }, t - 0.06 + k * 0.03));
      tl.to(p.b, { autoAlpha: 0, duration: 0.15 }, t - 0.1);
      tl.to(list[i - 1], { color: "#ADADA6", duration: 0.2 }, t);
      tl.to(keyMk, { scaleX: 0, duration: 0.15 }, t - 0.1);
      tl.to(listMk, { scaleX: 0, duration: 0.15 }, t - 0.1);
    }
    tl.to(list[i], { color: "#1B1B19", duration: 0.2 }, t);
    tl.to(s.t, { y: 0, duration: 0.5, ease: "expo.out" }, t + 0.15);
    tl.to(s.s, { y: 0, duration: 0.45, ease: "expo.out" }, t + 0.25);
    s.rows.forEach((r, k) => tl.to([r.dk, r.dv], { y: 0, duration: 0.45, ease: "expo.out" }, t + 0.35 + k * 0.08));
    tl.to(s.b, { autoAlpha: 1, duration: 0.3 }, t + 0.8);
    // 목록 형광펜과 핵심 값 형광펜 (크기는 그 순간의 글자 폭)
    const li = list[i], kr = s.rows[TESTS[i].key];
    tl.fromTo(listMk, { left: parseFloat(li.style.left) - 4, top: parseFloat(li.style.top) + (P ? 16 : 20), width: 10 }, { width: () => measure(li) + 8, duration: 0.01 }, t + 0.3);
    tl.to(listMk, { scaleX: 1, duration: 0.35, ease: "power3.out" }, t + 0.32);
    tl.fromTo(keyMk, { left: pad + (P ? 0 : 150) - 4, top: kr.y + (P ? 32 : 5) + (P ? 16 : 16), width: 10 }, { width: () => Math.min(measure(kr.dv), P ? cw - pad * 2 : 9999) + 8, duration: 0.01 }, t + 1.0);
    tl.to(keyMk, { scaleX: 1, duration: 0.4, ease: "power3.out" }, t + 1.02);
  });
  tl.to({}, { duration: 1.4 }, TESTS.length * S);
  return tl;
}
export const guideTestsDims = dims([1000, 560], [600, 760]);
