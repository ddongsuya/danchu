import { gsap, el, box, px, won, count, captions, sheet, bars, type Tl } from "../kit";

/**
 * 이용 안내: 세 줄 나란히. 기관 A·B·C 칸이 동시에 움직이고, 마지막에 한 표로 맞춰진다.
 * 예시: A·B 참여, C 불참. 숫자는 예시(만 원), 합계 = 항목 합.
 */
const ITEMS = ["반복투여 4주", "Ames", "체내 소핵"];
const V: Record<string, number[]> = { A: [28500, 1100, 1600], B: [27300, 1050, 1450] };
const T = (k: string) => V[k].reduce((s, x) => s + x, 0);
const KS = ["A", "B", "C"] as const;

export function how(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1200, H = P ? 900 : 720;
  const tl = gsap.timeline({ paused: true });
  const fs = P ? 20 : 18;
  const G = P ? 104 : 220, M = P ? 12 : 50, gap = P ? 8 : 18;
  const LW = (W - G - M - gap * 2) / 3;
  const lx = (i: number) => G + i * (LW + gap);
  const top = P ? 18 : 16, headH = P ? 50 : 48;
  const laneH = P ? 742 - top : 592 - top;

  // 칸
  const lanes = KS.map((_, i) => box(el(cv, "rl-lane"), lx(i), top, LW, laneH));
  const heads = KS.map((k, i) => box(el(cv, "rl-hd", `기관 ${k}`, { fontSize: px(P ? 20 : 20), textAlign: "center", lineHeight: px(headH) }), lx(i), top, LW, headH));

  // 0. 요청서 작성
  const fw = P ? 500 : 520, fh = P ? 560 : 440;
  const fx = (W - fw) / 2, fy = P ? 60 : 50;
  const form = sheet(cv, fx, fy, fw, fh);
  box(el(form, "rl-hd", "새 요청서", { fontSize: px(P ? 28 : 26) }), 30, 26);
  const fields: [string, string | null][] = [["시험 분야", "반복투여 · 유전독성"], ["희망 일정", "내년 1분기 착수"], ["시험물질", null], ["상세 조건", null], ["첨부", null]];
  const rowStepF = P ? 70 : 54;
  const typed: HTMLElement[][] = [];
  const fbars: HTMLElement[] = [];
  fields.forEach(([k, v], r) => {
    const y = (P ? 100 : 86) + r * rowStepF;
    box(el(form, "rl-sm", k, { fontSize: px(P ? 18 : 16) }), 30, y);
    box(el(form, "rl-rule"), 30, y + (P ? 40 : 34), fw - 60);
    if (v) {
      const span = box(el(form, "", null, { fontSize: px(P ? 20 : 18), fontWeight: "550", whiteSpace: "nowrap" }), P ? 150 : 150, y - 2);
      typed.push([...v].map((ch) => el(span, "", ch === " " ? "&nbsp;" : ch, { position: "relative", display: "inline-block" }, "span")));
    } else fbars.push(box(el(form, "rl-bar"), P ? 150 : 150, y + 6, [180, 220, 120][r - 2], 9));
  });
  const send = box(el(form, "rl-pill", "요청서 접수", { fontSize: px(P ? 20 : 18) }), fw - (P ? 190 : 180) - 30, fh - (P ? 76 : 66), P ? 190 : 180, P ? 50 : 46);
  const sendMk = box(el(form, "rl-mk", null, { zIndex: "-1" }), fw - (P ? 190 : 180) - 36, fh - (P ? 82 : 72), (P ? 190 : 180) + 12, (P ? 50 : 46) + 12);

  // 1. 참여 안내(요약) 카드
  const sumY = top + headH + 10, sumH = P ? 150 : 112;
  const sums = KS.map((_, i) => {
    const c = sheet(cv, lx(i) + 8, sumY, LW - 16, sumH);
    box(el(c, "rl-hd", "참여 안내", { fontSize: px(fs) }), 12, 10);
    box(el(c, "rl-sm", P ? "반복투여 ·<br>유전독성" : "반복투여 · 유전독성", { fontSize: px(P ? 17 : 14), whiteSpace: "normal", lineHeight: "1.3" }), 12, P ? 40 : 40);
    box(el(c, "rl-sm", "내년 1분기", { fontSize: px(P ? 17 : 14) }), 12, P ? 90 : 64);
    bars(c, 12, [P ? 118 : 90], [LW - 70], 7).forEach((b) => (b.style.filter = "blur(2px)"));
    return c;
  });

  // 2. 참여 / 불참
  const chY = sumY + sumH + 12, chH = P ? 44 : 40;
  const choice = KS.map((k, i) => {
    const wrap = box(el(cv), lx(i) + 8, chY, LW - 16, chH);
    const half = (LW - 16 - 6) / 2;
    const yes = box(el(wrap, "rl-chip", "참여", { fontSize: px(P ? 16 : 16), borderColor: "#ADADA6" }), 0, 0, half, chH);
    const no = box(el(wrap, "rl-chip", "불참", { fontSize: px(P ? 16 : 16), borderColor: "#ADADA6" }), half + 6, 0, half, chH);
    return { wrap, yes, no, pick: k === "C" ? no : yes };
  });

  // 3. 세부 내용
  const detY = chY + chH + 12, detH = P ? 150 : 120;
  const dets = (["A", "B"] as const).map((_, i) => {
    const c = sheet(cv, lx(i) + 8, detY, LW - 16, detH);
    box(el(c, "rl-hd", "세부 내용", { fontSize: px(fs) }), 12, 10);
    ["시험물질", "상세 조건", "첨부"].forEach((n, r) => {
      const y = (P ? 46 : 42) + r * (P ? 32 : 24);
      box(el(c, "rl-sm", n, { fontSize: px(P ? 16 : 13) }), 12, y);
      if (!P) box(el(c, "rl-bar"), 90, y + 5, LW - 130, 7);
    });
    return c;
  });
  const cOff = box(el(cv, "rl-hd", "불참", { fontSize: px(P ? 20 : 20), color: "#61615C", textAlign: "center" }), lx(2), detY + 30, LW);

  // 4. 견적서 회신 (A·B)
  const qY = P ? detY + detH + 14 : detY + detH + 12, qRow = P ? 46 : 30, qH = P ? 48 + qRow * 4 : 40 + qRow * 4;
  const quotes = (["A", "B"] as const).map((k, i) => {
    const c = sheet(cv, lx(i) + 8, qY, LW - 16, qH);
    const names: HTMLElement[] = [box(el(c, "rl-hd", "견적서", { fontSize: px(fs) }), 12, 10)], vals: HTMLElement[] = [];
    ITEMS.forEach((n, r) => {
      const y = (P ? 42 : 40) + r * qRow;
      names.push(box(el(c, "rl-sm", n, { fontSize: px(P ? 15 : 13) }), 12, y));
      const v = box(el(c, "rl-num", won(V[k][r]), { fontSize: px(P ? 18 : 15), textAlign: "right", fontWeight: "550" }), 0, P ? y + 16 : y - 1, LW - 16 - 12);
      vals.push(v);
    });
    const yT = (P ? 42 : 40) + 3 * qRow;
    names.push(box(el(c, "rl-sm", "합계", { fontSize: px(P ? 15 : 13), color: "#1B1B19", fontWeight: "650" }), 12, yT));
    const tot = box(el(c, "rl-num", won(T(k)), { fontSize: px(P ? 19 : 16), textAlign: "right", fontWeight: "700" }), 0, P ? yT + 16 : yT - 2, LW - 16 - 12);
    return { c, names, vals, tot };
  });

  // 5. 한 표로: 줄 머리
  const tY = top + headH + 18, tRow = P ? 64 : 52;
  const gls = ITEMS.concat(["합계"]).map((n, r) => box(el(cv, "", n, { fontSize: px(P ? 17 : 18), fontWeight: r === 3 ? "700" : "550", whiteSpace: P ? "normal" : "nowrap", width: px(G - 14), lineHeight: "1.2" }), P ? 10 : M, tY + 44 + r * tRow));
  const tTitle = box(el(cv, "rl-hd", "비교 견적", { fontSize: px(P ? 22 : 22) }), P ? 10 : M, tY - 2);
  const tMk = box(el(cv, "rl-mk", null, { zIndex: "0" }), (P ? 10 : M) - 4, tY + 14, P ? 92 : 98, 12);
  const cCol = box(el(cv, "rl-num", "불참", { fontSize: px(P ? 17 : 18), color: "#61615C", textAlign: "center" }), lx(2), tY + 44 + 1.5 * tRow - 10, LW);

  // 6. 의뢰자에게 전달
  const rw = P ? 380 : 400, rh = P ? 330 : 290;
  const rx = (W - rw) / 2, ry = P ? 170 : 110;
  const recv = sheet(cv, rx, ry, rw, rh);
  const rTag = box(el(recv, "rl-pill", "의뢰자", { fontSize: "14px" }), 24, 22, 80, 30);
  box(el(recv, "rl-hd", "받은 비교 견적서", { fontSize: px(24) }), 24, 70);
  const rRows = KS.map((k, i) => {
    const y = 128 + i * (P ? 56 : 46);
    box(el(recv, "rl-rule"), 24, y - 10, rw - 48);
    const a = box(el(recv, "", `기관 ${k}`, { fontSize: "18px", whiteSpace: "nowrap" }), 24, y);
    const b = box(el(recv, "rl-num", k === "C" ? "불참" : won(T(k)), { fontSize: "19px", fontWeight: k === "C" ? "500" : "700", color: k === "C" ? "#61615C" : "", textAlign: "right" }), 0, y, rw - 24);
    return [a, b];
  });
  void rTag;

  // ---------- 자막 (기존 일곱 문장 그대로) ----------
  const C = [0, 3.2, 6.2, 9.0, 12.0, 15.2, 18.6];
  const END = 23.5;
  captions(cv, W, H, P, [
    [C[0] + 0.2, "요청서를", "접수해주세요."],
    [C[1], "분야가 맞는 기관에게", "요청서가 전달됩니다."],
    [C[2], "기관이 이 요청서의", "참여, 불참 여부를 결정합니다."],
    [C[3], "참여를 희망하는 기관에게", "세부 내용이 전달 됩니다."],
    [C[4], "기관은 세부 내용을 확인하여", "견적서를 회신 합니다."],
    [C[5], "회신된 견적서가 모두 취합되어", "비교 견적이 완성됩니다."],
    [C[6], "완성된 비교견적서는", "의뢰자에게 전달 됩니다."],
  ], END)(tl);

  // ---------- 초기 ----------
  const allQ = quotes.map((q) => q.c);
  tl.set([...lanes, ...heads, ...sums, ...choice.map((c) => c.wrap), ...dets, cOff, ...allQ, ...gls, tTitle, cCol, recv], { autoAlpha: 0 }, 0)
    .set(form, { autoAlpha: 1, scale: 1, x: 0, y: 0 }, 0)
    .set([sendMk, tMk], { scaleX: 0 }, 0)
    .set(typed.flat(), { autoAlpha: 0 }, 0)
    .set(fbars, { scaleX: 0, transformOrigin: "0 50%" }, 0);

  // 0. 작성 → 접수
  tl.fromTo(form, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out" }, 0.05);
  typed.forEach((cs, i) => tl.to(cs, { autoAlpha: 1, duration: 0.01, stagger: 0.045 }, 0.5 + i * 0.6));
  tl.to(fbars, { scaleX: 1, duration: 0.35, ease: "power3.out", stagger: 0.1 }, 1.65);
  tl.to(send, { scale: 0.96, duration: 0.1, ease: "power2.out" }, 2.25).to(send, { scale: 1, duration: 0.2, ease: "expo.out" }, 2.35);
  tl.to(sendMk, { scaleX: 1, duration: 0.3, ease: "power3.out" }, 2.3);

  // 1. 칸이 생기고 요약이 동시에 간다
  const c1 = C[1];
  tl.to(form, { scale: 0.32, autoAlpha: 0, y: P ? -160 : -120, duration: 0.6, ease: "expo.inOut" }, c1);
  tl.fromTo(lanes, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.06 }, c1 + 0.3);
  tl.fromTo(heads, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "expo.out", stagger: 0.06 }, c1 + 0.4);
  sums.forEach((s, i) => tl.fromTo(s, { autoAlpha: 0, x: W / 2 - lx(i) - LW / 2, y: -80, scale: 0.7, rotation: [-4, 2, 5][i] }, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 0.75, ease: "expo.out" }, c1 + 0.55));

  // 2. 참여 / 불참
  const c2 = C[2];
  tl.to(choice.map((c) => c.wrap), { autoAlpha: 1, duration: 0.35, stagger: 0.08 }, c2 + 0.1);
  choice.forEach((c, i) => {
    const t = c2 + 0.8 + [0, 0.45, 0.9][i];
    const isNo = c.pick === c.no;
    tl.to(c.pick, { backgroundColor: isNo ? "#1B1B19" : "#EDEF5C", color: isNo ? "#F4F4F0" : "#1B1B19", borderColor: isNo ? "#1B1B19" : "#1B1B19", scale: 0.95, duration: 0.12 }, t)
      .to(c.pick, { scale: 1, duration: 0.25, ease: "back.out(3)" }, t + 0.12);
  });
  tl.to([lanes[2], heads[2], sums[2], choice[2].wrap], { autoAlpha: 0.38, duration: 0.4 }, c2 + 2.1);

  // 3. 세부 내용은 참여 기관에만
  const c3 = C[3];
  dets.forEach((d, i) => tl.fromTo(d, { autoAlpha: 0, clipPath: "inset(0 0 100% 0)", y: -10 }, { autoAlpha: 1, clipPath: "inset(0 0 0% 0)", y: 0, duration: 0.7, ease: "expo.out" }, c3 + 0.3 + i * 0.12));
  tl.fromTo(cOff, { autoAlpha: 0 }, { autoAlpha: 0.7, duration: 0.3 }, c3 + 0.5);
  tl.to(sums.slice(0, 2), { backgroundColor: "#F5F6B4", duration: 0.25 }, c3 + 0.2).to(sums.slice(0, 2), { backgroundColor: "#FBFBF8", duration: 0.5 }, c3 + 1.2);

  // 4. 견적서 회신
  const c4 = C[4];
  quotes.forEach((q, i) => {
    tl.fromTo(q.c, { autoAlpha: 0, y: 40, rotationX: -40, transformPerspective: 800, transformOrigin: "50% 0%" }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.7, ease: "expo.out" }, c4 + 0.3 + i * 0.25);
    q.vals.forEach((v, r) => tl.fromTo(v, { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: "expo.out" }, c4 + 0.8 + i * 0.25 + r * 0.12));
    tl.fromTo(q.tot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, c4 + 1.3 + i * 0.25);
    count(tl, q.tot, T(["A", "B"][i]), c4 + 1.3 + i * 0.25, 0.8);
  });

  // 5. 모두 모여 한 표가 된다
  const c5 = C[5];
  tl.to([...sums, ...choice.map((c) => c.wrap), ...dets, cOff], { autoAlpha: 0, y: -12, duration: 0.35, ease: "power2.out", stagger: 0.02 }, c5);
  tl.to([lanes[2], heads[2]], { autoAlpha: 1, duration: 0.3 }, c5 + 0.2);
  quotes.forEach((q, i) => {
    tl.to(q.c, { top: tY, duration: 0.8, ease: "expo.inOut" }, c5 + 0.25 + i * 0.06);
    // 카드 안 줄 간격을 표 줄에 맞춘다
    q.names.forEach((n) => tl.to(n, { autoAlpha: 0, duration: 0.25 }, c5 + 0.3));
    q.vals.concat([q.tot]).forEach((v, r) => tl.to(v, { top: 44 + r * tRow + (P ? 2 : 0), duration: 0.8, ease: "expo.inOut" }, c5 + 0.25 + i * 0.06));
    tl.to(q.c, { height: 44 + 4 * tRow, boxShadow: "0 0 0 rgba(0,0,0,0)", backgroundColor: "rgba(251,251,248,0)", duration: 0.8, ease: "expo.inOut" }, c5 + 0.25 + i * 0.06);
  });
  tl.fromTo(gls, { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: "expo.out", stagger: 0.06 }, c5 + 0.8);
  tl.fromTo(cCol, { autoAlpha: 0 }, { autoAlpha: 0.8, duration: 0.3 }, c5 + 1.0);
  tl.fromTo(tTitle, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, c5 + 0.9);
  tl.to(tMk, { scaleX: 1, duration: 0.4, ease: "power3.out" }, c5 + 1.4);

  // 6. 접혀서 의뢰자에게
  const c6 = C[6];
  const table = [...lanes, ...heads, ...allQ, ...gls, tTitle, tMk, cCol];
  tl.to(table, { scaleY: 0.08, y: P ? 120 : 80, autoAlpha: 0, transformOrigin: "50% 50%", duration: 0.55, ease: "power3.in", stagger: 0.008 }, c6);
  tl.fromTo(recv, { autoAlpha: 0, y: 60, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" }, c6 + 0.55);
  rRows.forEach((r, i) => tl.fromTo(r, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: "expo.out" }, c6 + 0.9 + i * 0.12));
  tl.to({}, { duration: 0.1 }, END);
  return tl;
}

export const howDims = { L: [1200, 720] as [number, number], P: [600, 900] as [number, number] };
