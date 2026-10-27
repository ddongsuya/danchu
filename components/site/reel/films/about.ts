import { gsap, el, box, px, won, count, captions, camera, sheet, bars, worldIn, type Tl } from "../kit";

/**
 * 서비스 소개: 카메라 원테이크. 장면을 끊지 않고 카메라가 다가가고 물러난다.
 * 기관마다 따로 연락 → 제각각 회신이 쌓임 → 치워지고 요청서 한 장 → 사본 세 장이 같은 양식 회신으로 뒤집힘 → 표로 모임 → 차이(TK) 한 박자.
 * 숫자는 예시(만 원). 합계 = 항목 합.
 */
const ITEMS = ["반복투여 4주", "Ames", "체내 소핵", "TK 분석"];
const V: Record<string, (number | null)[]> = { A: [24000, 1100, 1600, 4500], B: [27300, 1050, 1450, null], C: [26500, 1250, 1750, 5000] };
const T = (k: string) => V[k].reduce<number>((s, x) => s + (x ?? 0), 0);
const KS = ["A", "B", "C"] as const;

export function about(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1200, H = P ? 900 : 720;
  const tl = gsap.timeline({ paused: true });
  const viewH = P ? 760 : 610;
  const world = worldIn(cv, W, viewH);
  const cam = camera(world, W, H, viewH / 2);

  // 자리
  const cli = P ? { x: 200, y: 40, w: 200, h: 64 } : { x: 500, y: 30, w: 200, h: 62 };
  const orgY = P ? 640 : 488, orgW = P ? 176 : 210, orgH = P ? 62 : 62;
  const orgX = P ? [16, 212, 408] : [130, 495, 860];
  const fs = P ? 22 : 21;

  // 선 (SVG)
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(W)); svg.setAttribute("height", String(H));
  svg.style.left = "0"; svg.style.top = "0"; svg.style.overflow = "visible";
  world.appendChild(svg);
  const lines = orgX.map((x) => {
    const p = document.createElementNS(svgNS, "path");
    const a = { x: cli.x + cli.w / 2, y: cli.y + cli.h }, b = { x: x + orgW / 2, y: orgY };
    p.setAttribute("d", `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y}`);
    p.setAttribute("fill", "none"); p.setAttribute("stroke", "#ADADA6"); p.setAttribute("stroke-width", "1.5");
    p.setAttribute("pathLength", "1"); p.setAttribute("stroke-dasharray", "1"); p.setAttribute("stroke-dashoffset", "1");
    svg.appendChild(p);
    return p;
  });

  const client = box(el(world, "rl-pill", "의뢰자", { fontSize: px(fs) }), cli.x, cli.y, cli.w, cli.h);
  const orgs = KS.map((k, i) => box(el(world, "rl-node", `기관 ${k}`, { fontSize: px(fs) }), orgX[i], orgY, orgW, orgH));

  // 0. 따로 연락: 연락 수단 칩이 선을 타고 내려간다
  const ways = ["전화", "메일", "메신저"];
  const chipW = P ? 92 : 100, chipH = P ? 40 : 38;
  const chipsEl = ways.map((w) => el(world, "rl-chip", w, { fontSize: px(P ? 18 : 17), width: px(chipW), height: px(chipH) }));

  // 1. 제각각 회신: PDF·엑셀·메일 모양이 다른 문서
  const dw = P ? 176 : 220, dh = P ? 150 : 148;
  const replies = KS.map((k, i) => {
    const d = sheet(world, orgX[i] + (orgW - dw) / 2, orgY - dh - 20, dw, dh);
    if (k === "A") {
      el(d, "", null, { left: "0", right: "0", top: "0", height: "30px", background: "#2B2B28" });
      box(el(d, "rl-mono", "견적서.pdf", { color: "#F4F4F0", fontSize: "12px" }), 12, 8);
      bars(d, 14, [46, 64, 82], [dw - 60, dw - 90, dw - 70], 7);
      box(el(d, "rl-num", "합계 312,000,000원", { fontSize: px(P ? 13 : 14), fontWeight: "650" }), 14, dh - 34);
    } else if (k === "B") {
      box(el(d, "rl-mono", "회신.xlsx", { fontSize: "12px", color: "#61615C" }), 12, 10);
      const g = box(el(d, "", null, { borderTop: "1px solid #D9D9D3", borderLeft: "1px solid #D9D9D3" }), 10, 32, dw - 20, dh - 44);
      const cw = (dw - 20) / 3, ch = (dh - 44) / 4;
      for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) box(el(g, "", null, { borderRight: "1px solid #D9D9D3", borderBottom: "1px solid #D9D9D3" }), q * cw, r * ch, cw, ch);
      box(el(g, "rl-mono", "2.98억", { fontSize: "13px", fontWeight: "600", textAlign: "right" }), cw * 2, ch * 3 + ch / 2 - 9, cw - 6);
    } else {
      box(el(d, "rl-hd", "RE: 견적 회신드립니다", { fontSize: px(P ? 13 : 14) }), 12, 12);
      box(el(d, "rl-rule"), 12, 38, dw - 24);
      bars(d, 12, [52, 70], [dw - 50, dw - 80], 7);
      box(el(d, "rl-num", "총 3.45억 원입니다", { fontSize: px(P ? 13 : 14) }), 12, 90);
      bars(d, 12, [118], [dw - 100], 7);
    }
    return d;
  });
  // 쌓일 자리(의뢰자 아래로 겹겹이)
  const pile = P
    ? [[150, 150, -7], [235, 190, 5], [180, 255, -2]]
    : [[400, 120, -7], [560, 150, 5], [470, 215, -3]];
  const pileTotals = KS.map((_, i) => replies[i].querySelectorAll<HTMLElement>(".rl-num, .rl-mono")[replies[i].querySelectorAll(".rl-num, .rl-mono").length - 1]);

  // 2. 요청서 한 장
  const sw = P ? 270 : 260, sh = P ? 340 : 320;
  const sx = W / 2 - sw / 2, sy = P ? 150 : 120;
  const req = sheet(world, sx, sy, sw, sh);
  box(el(req, "rl-hd", "견적 요청서", { fontSize: px(P ? 24 : 22) }), 22, 20);
  const reqMk = box(el(req, "rl-mk", null, { zIndex: "-1" }), 18, P ? 40 : 36, P ? 128 : 118, P ? 14 : 13);
  box(el(req, "rl-sm", "반복투여독성 4주 · 설치류"), 22, P ? 60 : 56);
  bars(req, 24, [100, 124, 148, 184, 208, 232], [180, 140, 170, 120, 190, 150]);
  box(el(req, "rl-mono", "A-101", { fontSize: "12px", border: "1px solid #1B1B19", padding: "1px 6px" }), sw - 74, sh - 34);

  // 3. 사본 → 같은 양식 회신 (앞: 요청서, 뒤: 견적서)
  const cw2 = P ? 176 : 210, ch2 = P ? 200 : 178;
  const copies = KS.map((k, i) => {
    const c = box(el(world, "rl-flip"), sx + sw / 2 - cw2 / 2, sy + sh / 2 - ch2 / 2, cw2, ch2);
    const f = el(c, "rl-face rl-doc");
    box(el(f, "rl-hd", "견적 요청서", { fontSize: "15px" }), 16, 14);
    bars(f, 16, [48, 68, 88, 108], [cw2 - 50, cw2 - 80, cw2 - 60, cw2 - 100], 7);
    const b = el(c, "rl-face rl-back rl-doc");
    box(el(b, "rl-hd", `견적서 · 기관 ${k}`, { fontSize: px(P ? 14 : 15) }), 14, 12);
    box(el(b, "rl-rule"), 14, 38, cw2 - 28);
    ITEMS.forEach((n, r) => {
      const y = 46 + r * (P ? 26 : 23);
      box(el(b, "rl-sm", n, { fontSize: px(P ? 13 : 12) }), 12, y);
      const v = V[k][r];
      box(el(b, "rl-num", r === 3 ? (v == null ? "없음" : "포함") : won(v ?? 0), { fontSize: px(P ? 14 : 12), right: "12px", left: "auto", color: v == null ? "#B4322A" : "" }), 0, y).style.left = "auto";
    });
    box(el(b, "rl-rule"), 14, ch2 - 36, cw2 - 28);
    const tt = box(el(b, "rl-num", `합계 ${won(T(k))}`, { fontSize: px(P ? 14 : 15), fontWeight: "650" }), 14, ch2 - 28);
    return { c, tt };
  });
  const landY = P ? orgY - ch2 - 22 : orgY - ch2 - 22;

  // 4~5. 비교표
  const tw = P ? 560 : 760, tx = (W - tw) / 2, ty = P ? 120 : 92;
  const lw = P ? 150 : 220, colW = (tw - lw) / 3, rh = P ? 70 : 64, tfs = P ? 23 : 22;
  const tbl = box(el(world), tx, ty, tw, rh * 6);
  const heads = KS.map((k, i) => box(el(tbl, "rl-hd", `기관 ${k}`, { fontSize: px(tfs), textAlign: "right" }), lw + i * colW, 8, colW - 8));
  const topRule = box(el(tbl, "", null, { background: "#1B1B19", height: "2px", transformOrigin: "0 50%" }), 0, rh - 12, tw, 2);
  const rowLabels: HTMLElement[] = [], rules: HTMLElement[] = [];
  const cells: Record<string, HTMLElement[]> = { A: [], B: [], C: [] };
  const rowMk = box(el(tbl, "rl-mk", null, { opacity: "0.5" }), -12, rh * 4 - 4, tw + 24, rh - 14);
  const bMk = box(el(tbl, "rl-mk"), lw + colW * 2 - 8 - (P ? 66 : 70), rh * 4 + (P ? 4 : 2), P ? 66 : 70, rh - 30);
  ITEMS.concat(["합계"]).forEach((n, r) => {
    const y = rh * (r + 1);
    rowLabels.push(box(el(tbl, "", n, { fontSize: px(tfs), fontWeight: r === 4 ? "700" : "500", color: r === 4 ? "#1B1B19" : "#33332F", whiteSpace: "nowrap" }), 0, y + 4));
    if (r < 4) rules.push(box(el(tbl, "rl-rule", null, { transformOrigin: "0 50%" }), 0, y + rh - 14, tw));
    KS.forEach((k, i) => {
      const v = r < 4 ? V[k][r] : T(k);
      const txt = r === 3 ? (v == null ? "없음" : "포함") : won(v ?? 0);
      cells[k].push(box(el(tbl, "rl-num", txt, { fontSize: px(tfs), fontWeight: r === 4 ? "700" : "500", textAlign: "right", color: r === 3 && v == null ? "#B4322A" : "" }), lw + i * colW, y + 4, colW - 8));
    });
  });

  // ---------- 자막 (기존 문장 그대로) ----------
  const C = [0, 3.4, 6.6, 9.4, 13.0, 16.0];
  const END = 20.5;
  captions(cv, W, H, P, [
    [C[0] + 0.2, "기관마다", "따로 연락하고,"],
    [C[1], "양식, 평가항목 제각각", "비교는 더 번거롭죠"],
    [C[2], "번거로운 비교견적,", "단추에서 편하게 하세요."],
    [C[3], "한번의 요청으로", "여러 기관에."],
    [C[4], "각 기관에서 전달 받은 내용을", "보기 편하게"],
    [C[5], "비교표로", "간단하게"],
  ], END)(tl);

  // ---------- 초기 상태 ----------
  tl.set([req, tbl, ...copies.map((c) => c.c), ...chipsEl, ...replies], { autoAlpha: 0 }, 0)
    .set(orgs, { autoAlpha: 0, y: 16 }, 0).set(client, { autoAlpha: 1 }, 0)
    .set(lines, { attr: { "stroke-dashoffset": 1 } }, 0)
    .set([reqMk, rowMk, bMk], { scaleX: 0 }, 0)
    .set(copies.map((c) => c.c), { rotationY: 0, rotation: 0, x: 0, y: 0 }, 0)
    .set([...heads, ...rowLabels, ...KS.flatMap((k) => cells[k])], { autoAlpha: 0 }, 0)
    .set([topRule, ...rules], { scaleX: 0 }, 0);
  cam.set(tl, cli.x + cli.w / 2, cli.y + cli.h / 2 + 10, P ? 2.4 : 2.6, 0);

  // ---------- 0. 기관마다 따로 연락 ----------
  cam.to(tl, 0.25, W / 2, viewH / 2, 1, 1.3);
  tl.to(orgs, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.12 }, 0.7);
  lines.forEach((l, i) => {
    const t0 = 0.9 + i * 0.55;
    tl.to(l, { attr: { "stroke-dashoffset": 0 }, duration: 0.55, ease: "power2.inOut" }, t0);
    // 칩이 의뢰자에서 기관으로 (따로따로, 시간차)
    const a = { x: cli.x + cli.w / 2 - chipW / 2, y: cli.y + cli.h + 6 };
    const b = { x: orgX[i] + orgW / 2 - chipW / 2, y: orgY - chipH - 8 };
    tl.fromTo(chipsEl[i], { left: a.x, top: a.y, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, t0)
      .to(chipsEl[i], { left: b.x, top: b.y, duration: 0.6, ease: "power3.inOut" }, t0)
      .to(chipsEl[i], { autoAlpha: 0, duration: 0.2 }, t0 + 0.9);
  });

  // ---------- 1. 제각각 회신이 겹겹이 쌓인다 ----------
  const c1 = C[1];
  replies.forEach((d, i) => {
    tl.fromTo(d, { autoAlpha: 0, y: 30, rotation: 0 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "expo.out" }, c1 + 0.05 + i * 0.12);
    tl.to(d, { left: pile[i][0], top: pile[i][1], rotation: pile[i][2], duration: 0.85, ease: "expo.inOut" }, c1 + 0.55 + i * 0.16);
  });
  tl.to(lines, { attr: { "stroke-dashoffset": 1 }, duration: 0.5, ease: "power2.inOut" }, c1 + 0.4);
  cam.to(tl, c1 + 0.6, P ? 300 : 600, P ? 300 : 250, P ? 1.25 : 1.35, 1.1);
  // 합계 위치가 제각각인 곳을 짚는다
  tl.fromTo(pileTotals, { backgroundColor: "rgba(237,239,92,0)" }, { backgroundColor: "rgba(237,239,92,1)", duration: 0.25, stagger: 0.18 }, c1 + 1.7);

  // ---------- 2. 치우고 요청서 한 장 ----------
  const c2 = C[2];
  replies.forEach((d, i) => tl.to(d, { x: [-1, 1, -0.3][i] * W * 0.9, y: [-60, -40, H][i], rotation: [-30, 28, -12][i], autoAlpha: 0, duration: 0.6, ease: "power3.in" }, c2 + i * 0.05));
  cam.to(tl, c2 + 0.2, W / 2, viewH / 2, 1, 0.9);
  tl.to([client, ...orgs], { autoAlpha: 0.35, duration: 0.3 }, c2);
  tl.fromTo(req, { autoAlpha: 0, y: -40, rotation: -3, scale: 1.06 }, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 0.7, ease: "expo.out" }, c2 + 0.55);
  tl.to(reqMk, { scaleX: 1, duration: 0.35, ease: "power3.out" }, c2 + 1.3);

  // ---------- 3. 한 번에 세 곳, 같은 양식 회신 ----------
  const c3 = C[3];
  tl.to([client, ...orgs], { autoAlpha: 1, duration: 0.3 }, c3);
  tl.to(lines, { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.inOut", stagger: 0 }, c3);
  tl.to(req, { scale: 0.55, y: P ? -150 : -110, autoAlpha: 0, duration: 0.6, ease: "expo.inOut" }, c3 + 0.1);
  copies.forEach(({ c }, i) => {
    tl.set(c, { autoAlpha: 1 }, c3 + 0.2);
    tl.fromTo(c, { left: sx + sw / 2 - cw2 / 2, top: sy + 40, rotation: 0 }, { left: orgX[i] + (orgW - cw2) / 2, top: landY, rotation: [-2, 1.5, -1.5][i], duration: 0.75, ease: "expo.out" }, c3 + 0.22 + i * 0.06);
    tl.to(c, { rotationY: 180, duration: 0.7, ease: "back.out(1.3)" }, c3 + 1.3 + i * 0.12);
  });
  tl.to(copies.map((c) => c.tt), { backgroundColor: "rgba(245,246,180,1)", duration: 0.25, stagger: 0.08 }, c3 + 2.3);

  // ---------- 4. 전달 받은 내용이 표로 ----------
  const c4 = C[4];
  tl.to([client, ...orgs], { autoAlpha: 0, duration: 0.35 }, c4);
  tl.to(lines, { attr: { "stroke-dashoffset": 1 }, duration: 0.4 }, c4);
  tl.set(tbl, { autoAlpha: 1 }, c4);
  copies.forEach(({ c }, i) => {
    // 회신이 표의 기관 열로 접혀 들어간다
    tl.to(c, { left: tx + lw + i * colW + (colW - cw2 * 0.5) / 2 - 8, top: ty - 10, rotation: 0, scale: 0.5, duration: 0.8, ease: "expo.inOut" }, c4 + 0.1 + i * 0.07);
    tl.to(c, { autoAlpha: 0, duration: 0.25 }, c4 + 0.75 + i * 0.07);
  });
  tl.to(heads, { autoAlpha: 1, duration: 0.3, stagger: 0.07 }, c4 + 0.75);
  tl.to(topRule, { scaleX: 1, duration: 0.6, ease: "expo.out" }, c4 + 0.7);
  tl.to(rowLabels, { autoAlpha: 1, duration: 0.3, stagger: 0.06 }, c4 + 0.9);
  tl.to(rules, { scaleX: 1, duration: 0.6, ease: "expo.out", stagger: 0.06 }, c4 + 0.9);
  for (let r = 0; r < 4; r++) KS.forEach((k, i) => tl.fromTo(cells[k][r], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "expo.out" }, c4 + 1.1 + r * 0.12 + i * 0.05));
  KS.forEach((k, i) => { tl.to(cells[k][4], { autoAlpha: 1, duration: 0.2 }, c4 + 1.7); count(tl, cells[k][4], T(k), c4 + 1.7 + i * 0.06, 0.9); });
  cam.to(tl, c4 + 0.2, W / 2, ty + rh * 3, P ? 1 : 1.05, 1.0);

  // ---------- 5. 비교표로 간단하게: 차이에 다가간다 ----------
  const c5 = C[5];
  cam.to(tl, c5, tx + tw / 2, ty + rh * 4.4, P ? 1.04 : 1.3, 0.9);
  tl.to(bMk, { scaleX: 1, duration: 0.35, ease: "power3.out" }, c5 + 0.75);
  tl.to(rowMk, { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, c5 + 1.0);
  cam.to(tl, c5 + 2.4, W / 2, ty + rh * 3, P ? 1 : 1.05, 1.0);
  tl.to({}, { duration: 0.1 }, END);
  return tl;
}

export const aboutDims = { L: [1200, 720] as [number, number], P: [600, 900] as [number, number] };
