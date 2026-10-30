import { gsap, el, box, px, won, count, camera, worldIn, sheet, bars, type Tl } from "../kit";

const dims = (L: [number, number], P: [number, number]) => ({ L, P });

/* ================================================================
 * 기관 참여 첫 화면: 큰 글씨 리듬. 고객 종류가 바뀔 때마다 요청서가 우리 기관으로 쌓인다. 반복 재생.
 * ================================================================ */
const CLIENTS = ["제약사", "바이오텍", "화장품", "건강기능식품", "의료기기", "화학물질", "연구소"];

export function croHero(cv: HTMLDivElement, P: boolean): Tl {
  const W = 600, H = P ? 600 : 640;
  const tl = gsap.timeline({ paused: true });
  const big = P ? 84 : 84;
  const mask = box(el(cv, "rl-mask"), 0, 40, W, big * 1.25);
  const words = CLIENTS.map((c) => box(el(mask, "rl-big", c, { fontSize: px(c.length > 4 ? big * 0.78 : big), width: "100%", textAlign: "center" }), 0, c.length > 4 ? big * 0.12 : 0));
  const from = box(el(cv, "rl-sm", "에서 온 요청서", { fontSize: "24px", width: "100%", textAlign: "center", color: "#61615C" }), 0, 40 + big * 1.3);

  // 우리 기관 받은 함
  const inX = 150, inY = H - 196, inW = 300, inH = 120; // 아래 "새 요청서 도착" 칩까지 무대 안에 들어오게
  // 받은 함은 요청서보다 앞에 둔다: 요청서가 함 위 가장자리 뒤로 들어가 사라진다 (위에 걸쳐 쌓이면 글자를 가려 끊긴 듯 보였음)
  const tray = box(el(cv, "rl-node", null, { borderWidth: "2px", zIndex: "50" }), inX, inY, inW, inH);
  box(el(tray, "rl-hd", "우리 기관", { fontSize: "26px" }), 24, 22);
  const badge = box(el(tray, "rl-pill", "0", { fontSize: "22px", borderRadius: "999px" }), inW - 76, 18, 52, 40);
  const arrive = box(el(cv, "rl-chip", "새 요청서 도착", { fontSize: "22px", fontWeight: "600", borderColor: "#1B1B19", background: "#EDEF5C" }), W / 2 - 110, inY + inH + 14, 220, 42);

  // 요청서 카드
  const cw = 200, ch = 130;
  const cards = CLIENTS.map((c, i) => {
    const d = sheet(cv, W / 2 - cw / 2, 200, cw, ch);
    box(el(d, "rl-hd", "요청서", { fontSize: "20px" }), 18, 14);
    box(el(d, "rl-sm", c, { fontSize: "14px" }), 18, 44);
    bars(d, 18, [76, 96], [cw - 60, cw - 90], 8);
    d.style.zIndex = String(10 + i);
    return d;
  });

  tl.set(words, { y: big * 1.4 }, 0).set(cards, { autoAlpha: 0 }, 0).set(arrive, { autoAlpha: 0, y: 10 }, 0);
  count(tl, badge, 0, 0, 0.01, 0, String);
  const step = 0.78;
  CLIENTS.forEach((c, i) => {
    const t = 0.15 + i * step;
    tl.to(words[i], { y: 0, duration: 0.42, ease: "expo.out" }, t);
    if (i < CLIENTS.length - 1) tl.to(words[i], { y: -big * 1.4, duration: 0.3, ease: "power3.in" }, t + step - 0.3);
    tl.fromTo(cards[i], { autoAlpha: 0, y: -30, rotation: [-6, 4, -3, 5, -4, 3, -2][i], scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: "expo.out" }, t + 0.05);
    // 받은 함 위로 떨어진 뒤 함 안으로 들어간다
    tl.to(cards[i], { top: inY - ch * 0.35, rotation: [-3, 2, -1.5, 2.5, -2, 1.5, 0][i] * 0.5, scale: 0.86, duration: 0.3, ease: "power3.in" }, t + 0.32)
      .to(cards[i], { top: inY + 12, rotation: 0, scale: 0.8, duration: 0.18, ease: "power2.in" }, t + 0.62)
      .set(cards[i], { autoAlpha: 0 }, t + 0.8);
    count(tl, badge, i + 1, t + 0.74, 0.01, i, String);
    tl.fromTo(tray, { y: 0 }, { y: 4, duration: 0.08, yoyo: true, repeat: 1, ease: "power2.out" }, t + 0.74);
  });
  void from;
  const end = 0.15 + CLIENTS.length * step;
  tl.to(arrive, { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, end);
  tl.to({}, { duration: 1.6 }, end + 0.4);
  return tl;
}
export const croHeroDims = dims([600, 640], [600, 600]);

/* ================================================================
 * 참여부터 계약까지: 카메라가 책상 위 여섯 장면을 옮겨 다닌다. 단계 버튼 = 장면.
 * ================================================================ */
export const CRO_STEPS = ["참여 신청", "표준 가격 등록", "참여 안내 수신", "참여 결정", "견적서 회신", "선정 및 계약"];
const CATALOG = ["반복투여독성 4주", "복귀돌연변이(Ames)", "체내 소핵", "안전성약리 hERG"];
const CAT_W = [0.92, 0.38, 0.5, 0.62];

export function croSteps(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1200, H = P ? 720 : 600;
  const tl = gsap.timeline({ paused: true });
  const world = worldIn(cv, W, H);
  const cam = camera(world, W, H, H / 2);
  const D = P ? 640 : 900; // 장면 간격
  const dw = P ? 500 : 560, dh = P ? 560 : 440;
  const cx = (i: number) => W / 2 + i * D;
  const docAt = (i: number, w = dw, h = dh) => sheet(world, cx(i) - w / 2, H / 2 - h / 2, w, h);
  const fs = P ? 24 : 20, sm = P ? 20 : 16;
  const lab = (p: HTMLElement, t: string, x: number, y: number, size = sm, color = "#61615C") => box(el(p, "", t, { fontSize: px(size), color, whiteSpace: "nowrap" }), x, y);
  const title = (p: HTMLElement, t: string) => box(el(p, "rl-hd", t, { fontSize: px(P ? 28 : 26) }), 30, 26);
  const rule = (p: HTMLElement, y: number, w: number) => box(el(p, "rl-rule"), 30, y, w);

  // 0 참여 신청
  const s0 = docAt(0);
  title(s0, "기관 참여 신청");
  const gy = P ? 96 : 90, gs = P ? 84 : 68;
  lab(s0, "기관명", 30, gy); rule(s0, gy + 34, dw - 60);
  const nameTyped = box(el(s0, "", null, { fontSize: px(fs), fontWeight: "600", whiteSpace: "nowrap" }), P ? 170 : 160, gy - 2);
  const nameChars = [..."우리 기관"].map((c) => el(nameTyped, "", c === " " ? "&nbsp;" : c, { position: "relative", display: "inline-block" }, "span"));
  lab(s0, "GLP 인증", 30, gy + gs); rule(s0, gy + gs + 34, dw - 60);
  const glp = box(el(s0, "rl-chip", "보유", { fontSize: px(sm), borderColor: "#ADADA6" }), P ? 170 : 160, gy + gs - 6, 76, 34);
  lab(s0, "수행 분야", 30, gy + gs * 2); rule(s0, gy + gs * 2 + 34 + (P ? 44 : 0), dw - 60);
  const fields = ["일반독성", "유전독성", "안전성약리"].map((f, i) => box(el(s0, "rl-chip", f, { fontSize: px(sm - 1), borderColor: "#ADADA6" }), P ? 30 + i * 140 : 160 + i * 116, gy + gs * 2 - 6 + (P ? 40 : 0), P ? 128 : 106, 34));
  const y3 = gy + gs * 3 + (P ? 44 : 0);
  lab(s0, "담당자 연락처", 30, y3); rule(s0, y3 + 34, dw - 60);
  const contact = box(el(s0, "rl-bar", null, { transformOrigin: "0 50%" }), P ? 170 : 160, y3 + 6, 180, 9);
  const apply = box(el(s0, "rl-pill", "신청하기", { fontSize: px(sm + 1) }), dw - 30 - 150, dh - 70, 150, 46);

  // 1 표준 가격
  const s1 = docAt(1);
  title(s1, "표준 가격");
  const rowY = (r: number) => (P ? 100 : 92) + r * (P ? 92 : 68);
  const catBars: HTMLElement[] = [];
  CATALOG.forEach((n, r) => {
    lab(s1, n, 30, rowY(r), sm, "#33332F");
    const bw = (P ? dw - 60 : dw - 300) * CAT_W[r];
    catBars.push(box(el(s1, "", null, { background: "#1B1B19", height: "12px", transformOrigin: "0 50%" }), P ? 30 : 270, rowY(r) + (P ? 34 : 6), bw, 12));
    rule(s1, rowY(r) + (P ? 60 : 40), dw - 60);
  });
  const save = box(el(s1, "rl-pill", "카탈로그 저장", { fontSize: px(sm + 1) }), dw - 30 - 180, dh - 70, 180, 46);
  const saved = box(el(s1, "rl-chip", "저장됨", { fontSize: px(sm), background: "#EDEF5C", borderColor: "#1B1B19" }), 30, dh - 64, 96, 36);

  // 2 참여 안내 수신
  const tray = box(el(world, "rl-node", "우리 기관", { fontSize: px(fs + 4), borderWidth: "2px" }), cx(2) - 150, H / 2 + (P ? 170 : 130), 300, 70);
  const nw = P ? 440 : 440, nh = P ? 300 : 250;
  const s2 = sheet(world, cx(2) - nw / 2, H / 2 - nh / 2 - (P ? 70 : 50), nw, nh);
  title(s2, "참여 안내");
  [["시험 분야", "반복투여 · 유전독성"], ["희망 일정", null], ["회신 기한", null]].forEach(([k, v], r) => {
    const y = (P ? 92 : 86) + r * (P ? 62 : 50);
    lab(s2, k as string, 30, y);
    if (v) box(el(s2, "", v, { fontSize: px(sm), fontWeight: "600", whiteSpace: "nowrap" }), P ? 160 : 150, y); else box(el(s2, "rl-bar"), P ? 160 : 150, y + 6, 140 - r * 20, 9);
  });

  // 3 참여 결정
  const qw = P ? 460 : 480, qh = P ? 300 : 250;
  const s3 = sheet(world, cx(3) - qw / 2, H / 2 - qh / 2 - 30, qw, qh);
  box(el(s3, "rl-hd", "이 요청에 참여할까요?", { fontSize: px(P ? 28 : 26) }), 30, 30);
  const yes = box(el(s3, "rl-chip", "참여", { fontSize: px(fs), borderColor: "#1B1B19" }), 30, P ? 120 : 110, (qw - 76) / 2, 60);
  const no = box(el(s3, "rl-chip", "불참", { fontSize: px(fs), borderColor: "#ADADA6", color: "#61615C" }), 30 + (qw - 76) / 2 + 16, P ? 120 : 110, (qw - 76) / 2, 60);
  const unlock = box(el(world, "rl-chip", "세부 내용 열람", { fontSize: px(sm + 1), background: "#EDEF5C", borderColor: "#1B1B19", fontWeight: "600" }), cx(3) - 100, H / 2 + qh / 2 - 10, 200, 44);

  // 4 견적서 회신
  const s4 = docAt(4);
  title(s4, "견적서");
  const fill = box(el(s4, "rl-chip", "카탈로그로 채움", { fontSize: px(sm - 1), borderColor: "#ADADA6", color: "#61615C" }), dw - 30 - 160, 26, 160, 34);
  const qBars: HTMLElement[] = [];
  CATALOG.forEach((n, r) => {
    lab(s4, n, 30, rowY(r), sm, "#33332F");
    const bw = (P ? dw - 60 : dw - 300) * CAT_W[r];
    qBars.push(box(el(s4, "", null, { background: "#1B1B19", height: "12px", transformOrigin: "0 50%" }), P ? 30 : 270, rowY(r) + (P ? 34 : 6), bw, 12));
    rule(s4, rowY(r) + (P ? 60 : 40), dw - 60);
  });
  const done = box(el(s4, "rl-pill", "회신 완료", { fontSize: px(sm + 1) }), dw - 30 - 150, dh - 70, 150, 46);

  // 5 선정 및 계약
  const s5 = docAt(5);
  title(s5, "비교 견적");
  const orgsRows = ["기관 A", "기관 B", "우리 기관"];
  const ry = (r: number) => (P ? 110 : 100) + r * (P ? 84 : 70);
  const hl = box(el(s5, "rl-mk", null, { opacity: "0.6" }), 18, ry(2) - 14, dw - 36, P ? 60 : 50);
  orgsRows.forEach((n, r) => {
    lab(s5, n, 30, ry(r), fs, r === 2 ? "#1B1B19" : "#33332F").style.fontWeight = r === 2 ? "650" : "500";
    box(el(s5, "", null, { background: r === 2 ? "#1B1B19" : "#ADADA6", height: "12px" }), P ? 190 : 200, ry(r) + 8, (P ? 200 : 220) * [0.9, 0.78, 0.84][r], 12);
    if (r < 2) rule(s5, ry(r) + (P ? 52 : 44), dw - 60);
  });
  const stamp = box(el(s5, "rl-chip", "선정", { fontSize: px(fs + 2), fontWeight: "700", borderWidth: "2px", background: "#FBFBF8" }), dw - 30 - 96, ry(2) - 8, 96, 46);
  const contract = box(el(s5, "rl-pill", "계약 진행", { fontSize: px(sm + 1) }), dw / 2 - 80, dh - 76, 160, 48);

  // ---------- 초기 ----------
  tl.set(nameChars, { autoAlpha: 0 }, 0).set(contact, { scaleX: 0 }, 0)
    .set([...catBars, ...qBars, hl], { scaleX: 0 }, 0)
    .set([saved, unlock, stamp, contract, done, s2], { autoAlpha: 0 }, 0);
  cam.set(tl, cx(0), H / 2, 1, 0);

  const S = 3.3;
  const move = (i: number, t: number) => {
    tl.addLabel(`ch${i}`, t);
    if (i > 0) {
      // 잠깐 물러났다가 다음 장면에 붙는다
      cam.to(tl, t, (cx(i - 1) + cx(i)) / 2, H / 2, P ? 0.62 : 0.68, 0.4, "power2.in");
      cam.to(tl, t + 0.4, cx(i), H / 2, 1, 0.5, "expo.out");
    }
  };
  // 0
  move(0, 0);
  tl.fromTo(s0, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "expo.out" }, 0.05);
  tl.to(nameChars, { autoAlpha: 1, duration: 0.01, stagger: 0.07 }, 0.4);
  tl.to(glp, { backgroundColor: "#1B1B19", color: "#F4F4F0", borderColor: "#1B1B19", duration: 0.15 }, 1.0);
  fields.forEach((f, i) => tl.to(f, { backgroundColor: "#EDEF5C", borderColor: "#1B1B19", duration: 0.15 }, 1.3 + i * 0.18));
  tl.to(contact, { scaleX: 1, duration: 0.35, ease: "power3.out" }, 1.9);
  tl.to(apply, { scale: 0.95, duration: 0.1 }, 2.4).to(apply, { scale: 1, duration: 0.25, ease: "back.out(3)" }, 2.5);
  // 1
  const t1 = S; move(1, t1);
  tl.to(catBars, { scaleX: 1, duration: 0.5, ease: "expo.out", stagger: 0.12 }, t1 + 0.8);
  tl.to(save, { scale: 0.95, duration: 0.1 }, t1 + 1.8).to(save, { scale: 1, duration: 0.25, ease: "back.out(3)" }, t1 + 1.9);
  tl.fromTo(saved, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, t1 + 2.0);
  // 2
  const t2 = S * 2; move(2, t2);
  tl.fromTo(s2, { autoAlpha: 0, y: -H * 0.7, rotation: -6 }, { autoAlpha: 1, y: 0, rotation: -1.5, duration: 0.8, ease: "expo.out" }, t2 + 0.6);
  tl.fromTo(tray, { y: 0 }, { y: 6, duration: 0.1, yoyo: true, repeat: 1 }, t2 + 1.2);
  tl.to(tray, { backgroundColor: "#F5F6B4", duration: 0.2 }, t2 + 1.2);
  // 3
  const t3 = S * 3; move(3, t3);
  tl.to(yes, { backgroundColor: "#EDEF5C", scale: 0.95, duration: 0.12 }, t3 + 1.2).to(yes, { scale: 1, duration: 0.25, ease: "back.out(3)" }, t3 + 1.32);
  tl.to(no, { autoAlpha: 0.4, duration: 0.3 }, t3 + 1.3);
  tl.fromTo(unlock, { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, t3 + 1.6);
  // 4
  const t4 = S * 4; move(4, t4);
  tl.to(fill, { backgroundColor: "#EDEF5C", color: "#1B1B19", borderColor: "#1B1B19", duration: 0.2 }, t4 + 0.8);
  tl.to(qBars, { scaleX: 1, duration: 0.45, ease: "expo.out", stagger: 0.1 }, t4 + 0.95);
  tl.fromTo(done, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, t4 + 1.8);
  // 5
  const t5 = S * 5; move(5, t5);
  tl.to(hl, { scaleX: 1, duration: 0.45, ease: "power3.out" }, t5 + 0.9);
  tl.fromTo(stamp, { autoAlpha: 0, scale: 1.6, rotation: -14 }, { autoAlpha: 1, scale: 1, rotation: -6, duration: 0.4, ease: "back.out(2.2)" }, t5 + 1.3);
  tl.fromTo(contract, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "expo.out" }, t5 + 1.8);
  tl.to({}, { duration: 1.2 }, t5 + 2.2);
  return tl;
}
export const croStepsDims = dims([1200, 600], [600, 720]);

/* ================================================================
 * 회신 정리: 엑셀·PDF·메일에서 금액이 떠올라 같은 단위로 바뀌며 표 칸에 꽂힌다. 차이(TK 미포함) 한 박자.
 * ================================================================ */
const RV: Record<string, (number | null)[]> = { A: [9800, 1100, 1400], B: [9200, 1050, null], C: [10600, 1250, 1600] };
const RT = (k: string) => RV[k].reduce<number>((s, x) => s + (x ?? 0), 0);
const RITEMS = ["반복투여 4주", "Ames", "TK 분석"];

export function croReply(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1000, H = P ? 860 : 640;
  const tl = gsap.timeline({ paused: true });
  const sm = P ? 15 : 14;
  // 문서 세 장
  const dw = P ? 280 : 300, dh = P ? 250 : 250;
  const pos = P ? [[16, 20, -3], [304, 60, 2.5], [150, 300, -1.5]] : [[24, 40, -3], [350, 24, 2], [676, 48, -2]];
  const docs: HTMLElement[] = [];
  const raw: Record<string, HTMLElement[]> = { A: [], B: [], C: [] };
  // A 엑셀
  {
    const d = sheet(cv, pos[0][0], pos[0][1], dw, dh); docs.push(d);
    box(el(d, "rl-mono", "기관A_견적.xlsx", { fontSize: "13px", color: "#61615C" }), 14, 12);
    const g = box(el(d, "", null, { borderTop: "1px solid #D9D9D3", borderLeft: "1px solid #D9D9D3" }), 12, 40, dw - 24, 4 * 40);
    const cw = [(dw - 24) * 0.52, (dw - 24) * 0.48];
    [["시험 항목", "금액(원)"], ["반복투여 4주", "98,000,000"], ["Ames", "11,000,000"], ["TK 분석", "14,000,000"]].forEach((r, i) => r.forEach((t, j) => {
      const c = box(el(g, "", null, { borderRight: "1px solid #D9D9D3", borderBottom: "1px solid #D9D9D3", background: i === 0 ? "#EFEFEA" : "" }), j ? cw[0] : 0, i * 40, cw[j], 40);
      const tx = box(el(c, j ? "rl-mono" : "", t, { fontSize: px(i === 0 ? 12 : sm - 1), whiteSpace: "nowrap", textAlign: j ? "right" : "left", color: i === 0 ? "#61615C" : "" }), 8, 11, cw[j] - 16);
      if (i > 0 && j === 1) raw.A.push(tx);
    }));
  }
  // B PDF
  {
    const d = sheet(cv, pos[1][0], pos[1][1], dw, dh); docs.push(d);
    box(el(d, "", "견 적 서", { fontSize: "20px", fontWeight: "700", letterSpacing: ".3em", width: "100%", textAlign: "center" }), 0, 16);
    box(el(d, "rl-sm", "수신 의뢰자 귀하", { fontSize: "12px" }), 16, 52);
    box(el(d, "rl-sm", "기관 B", { fontSize: "12px", color: "#1B1B19" }), dw - 60, 52);
    box(el(d, "", null, { background: "#1B1B19", height: "2px" }), 16, 74, dw - 32);
    [["반복투여 4주", "92,000,000"], ["Ames", "10,500,000"]].forEach(([n, v], i) => {
      box(el(d, "", n, { fontSize: px(sm), whiteSpace: "nowrap" }), 16, 86 + i * 34);
      raw.B.push(box(el(d, "rl-num", v, { fontSize: px(sm), textAlign: "right" }), 0, 86 + i * 34, dw - 16));
      box(el(d, "rl-rule"), 16, 112 + i * 34, dw - 32);
    });
    box(el(d, "", "합계", { fontSize: px(sm), fontWeight: "650" }), 16, 160);
    box(el(d, "rl-num", "₩102,500,000", { fontSize: px(sm), fontWeight: "650", textAlign: "right" }), 0, 160, dw - 16);
    box(el(d, "rl-sm", "※ TK 분석 미포함", { fontSize: "12px" }), 16, 200);
  }
  // C 메일
  {
    const d = sheet(cv, pos[2][0], pos[2][1], dw, dh); docs.push(d);
    box(el(d, "rl-sm", "보낸 사람", { fontSize: "12px" }), 16, 14); box(el(d, "", "기관 C 영업팀", { fontSize: "13px" }), 90, 13);
    box(el(d, "rl-sm", "제목", { fontSize: "12px" }), 16, 38); box(el(d, "", "RE: 견적 요청 회신드립니다", { fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap" }), 90, 37);
    box(el(d, "rl-rule"), 16, 64, dw - 32);
    const body = box(el(d, "", null, { fontSize: px(sm), lineHeight: "1.65", whiteSpace: "normal", width: px(dw - 32) }), 16, 76);
    body.innerHTML = '요청하신 시험은 반복투여 4주 <b class="v">1억 600만 원</b>, Ames <b class="v">1,250만 원</b>, TK <b class="v">1,600만 원</b>으로 회신드립니다.';
    body.querySelectorAll<HTMLElement>(".v").forEach((b) => { b.style.position = "relative"; b.style.fontWeight = "600"; raw.C.push(b); });
  }

  // 표
  const tw = P ? 568 : 760, tx = (W - tw) / 2, ty = P ? 120 : 92;
  const lw = P ? 150 : 200, colW = (tw - lw) / 3, rh = P ? 76 : 66, tfs = P ? 22 : 22;
  const tbl = box(el(cv), tx, ty, tw, rh * 5);
  const ks = ["A", "B", "C"];
  const heads = ks.map((k, i) => box(el(tbl, "rl-hd", `기관 ${k}`, { fontSize: px(tfs), textAlign: "right" }), lw + i * colW, 6, colW - 8));
  const topRule = box(el(tbl, "", null, { background: "#1B1B19", height: "2px", transformOrigin: "0 50%" }), 0, rh - 14, tw, 2);
  const rowMk = box(el(tbl, "rl-mk", null, { opacity: "0.5" }), -10, rh * 3 - 6, tw + 20, rh - 14);
  const bMk = box(el(tbl, "rl-mk"), lw + 2 * colW - 8 - 84, rh * 3 - 2, 84, rh - 22);
  const labels: HTMLElement[] = [], cells: Record<string, HTMLElement[]> = { A: [], B: [], C: [] }, rules: HTMLElement[] = [];
  RITEMS.concat(["합계"]).forEach((n, r) => {
    const y = rh * (r + 1);
    labels.push(box(el(tbl, "", n, { fontSize: px(tfs), fontWeight: r === 3 ? "700" : "500", whiteSpace: "nowrap" }), 0, y));
    if (r < 3) rules.push(box(el(tbl, "rl-rule", null, { transformOrigin: "0 50%" }), 0, y + rh - 16, tw));
    ks.forEach((k, i) => {
      const v = r < 3 ? RV[k][r] : RT(k);
      cells[k].push(box(el(tbl, "rl-num", v == null ? "미포함" : won(v), { fontSize: px(tfs), fontWeight: r === 3 ? "700" : "500", textAlign: "right", color: v == null ? "#B4322A" : "" }), lw + i * colW, y, colW - 8));
    });
  });
  const note = box(el(cv, "", "기관 B 회신에는 TK 분석이 빠져 있어요", { fontSize: px(P ? 26 : 24), fontWeight: "600", width: "100%", textAlign: "center", letterSpacing: "-.02em" }), 0, H - (P ? 110 : 84));

  // 날아가는 금액 (원래 표기 → 만 원 표기)
  const flies: { k: string; r: number; a: HTMLElement; b: HTMLElement; f: HTMLElement }[] = [];
  ks.forEach((k) => raw[k].forEach((src, j) => {
    const r = j; // A·C: 0,1,2 / B: 0,1
    const f = el(cv, "", null, { fontSize: px(tfs), fontWeight: "600", whiteSpace: "nowrap" });
    const a = el(f, "rl-mono", src.textContent ?? "", { position: "relative", display: "block", fontSize: px(sm) });
    const b = el(f, "rl-num", won(RV[k][r] ?? 0), { left: "0", top: "0" });
    flies.push({ k, r, a, b, f });
  }));

  // ---------- 초기 ----------
  tl.set([tbl, note, ...flies.map((x) => x.f)], { autoAlpha: 0 }, 0)
    .set([...heads, ...labels, ...ks.flatMap((k) => cells[k])], { autoAlpha: 0 }, 0)
    .set([topRule, ...rules, rowMk, bMk], { scaleX: 0 }, 0);
  docs.forEach((d, i) => tl.fromTo(d, { autoAlpha: 0, y: 40, rotation: 0 }, { autoAlpha: 1, y: 0, rotation: pos[i][2], duration: 0.6, ease: "expo.out" }, 0.1 + i * 0.15));
  // 금액마다 형광펜 (문서 안 위치 그대로)
  const allRaw = ks.flatMap((k) => raw[k]);
  tl.fromTo(allRaw, { backgroundColor: "rgba(237,239,92,0)" }, { backgroundColor: "rgba(237,239,92,1)", duration: 0.18, stagger: 0.12 }, 1.0);

  // 떠올라 날아간다
  const fT = 2.4;
  tl.set(tbl, { autoAlpha: 1 }, fT);
  const cvRect = () => cv.getBoundingClientRect();
  flies.forEach((x, n) => {
    const src = raw[x.k][x.r];
    const at = fT + n * 0.07;
    tl.add(() => {
      // 시작점: 원래 숫자 위치(캔버스 좌표). 축소 비율을 되돌려 계산
      const c = cvRect(), s = src.getBoundingClientRect(), k = c.width / W;
      gsap.set(x.f, { left: (s.left - c.left) / k, top: (s.top - c.top) / k });
    }, at - 0.01);
    const col = ks.indexOf(x.k);
    tl.to(x.f, { autoAlpha: 1, duration: 0.1 }, at);
    tl.to(x.f, { left: tx + lw + col * colW, top: ty + rh * (x.r + 1), width: colW - 8, duration: 0.9, ease: "expo.inOut" }, at);
    tl.fromTo(x.a, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, at + 0.4);
    tl.fromTo(x.b, { autoAlpha: 0, x: 0 }, { autoAlpha: 1, duration: 0.2 }, at + 0.45);
    tl.to(x.f, { autoAlpha: 0, duration: 0.1 }, at + 0.95);
    tl.to(cells[x.k][x.r], { autoAlpha: 1, duration: 0.1 }, at + 0.92);
  });
  // 문서는 기관 열 머리로 접혀 사라진다
  docs.forEach((d, i) => tl.to(d, { left: tx + lw + i * colW, top: ty - 30, scale: 0.18, rotation: 0, autoAlpha: 0, duration: 0.8, ease: "expo.inOut" }, fT + 0.3 + i * 0.06));
  tl.to(heads, { autoAlpha: 1, duration: 0.3, stagger: 0.06 }, fT + 0.9);
  tl.to(topRule, { scaleX: 1, duration: 0.6, ease: "expo.out" }, fT + 0.8);
  tl.to(labels, { autoAlpha: 1, duration: 0.3, stagger: 0.06 }, fT + 0.9);
  tl.to(rules, { scaleX: 1, duration: 0.6, ease: "expo.out", stagger: 0.05 }, fT + 0.9);
  tl.fromTo(cells.B[2], { autoAlpha: 0, scale: 1.3 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, fT + 1.7);
  ks.forEach((k, i) => { tl.to(cells[k][3], { autoAlpha: 1, duration: 0.1 }, fT + 1.8); count(tl, cells[k][3], RT(k), fT + 1.8 + i * 0.06, 0.8); });

  // 차이
  const dT = fT + 2.9;
  tl.to(bMk, { scaleX: 1, duration: 0.35, ease: "power3.out" }, dT);
  tl.to(rowMk, { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, dT + 0.3);
  tl.fromTo(note, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "expo.out" }, dT + 0.4);
  tl.to({}, { duration: 2 }, dT + 0.9);
  void bars;
  return tl;
}
export const croReplyDims = dims([1000, 640], [600, 860]);

/* ================================================================
 * 같은 규칙: 같은 요청서가 같은 기한으로 세 칸에 동시에. 회신은 비교표로만, 옆 칸은 볼 수 없다.
 * ================================================================ */
export function croRules(cv: HTMLDivElement, P: boolean): Tl {
  const W = P ? 600 : 1000, H = P ? 860 : 640;
  const tl = gsap.timeline({ paused: true });
  const M = P ? 12 : 30, gap = P ? 22 : 40;
  const LW = (W - M * 2 - gap * 2) / 3;
  const lx = (i: number) => M + i * (LW + gap);
  const laneTop = P ? 200 : 170, laneH = H - laneTop - (P ? 30 : 24);
  const fs = P ? 20 : 19;
  const ks = ["A", "B", "C"];

  const lanes = ks.map((_, i) => box(el(cv, "rl-lane"), lx(i), laneTop, LW, laneH));
  const heads = ks.map((k, i) => box(el(cv, "rl-hd", `기관 ${k}`, { fontSize: px(fs + 2), textAlign: "center" }), lx(i), laneTop + 14, LW));
  const walls = [0, 1].map((i) => {
    const w = box(el(cv, "", null, { borderLeft: "2px dashed #61615C" }), lx(i) + LW + gap / 2 - 1, laneTop, 2, laneH);
    const tw = P ? 64 : 84;
    const t = box(el(cv, "rl-chip", P ? "서로 볼<br>수 없음" : "서로 볼 수<br>없음", { fontSize: px(P ? 13 : 14), lineHeight: "1.25", textAlign: "center", padding: "6px 4px", borderColor: "#1B1B19", whiteSpace: "normal" }), lx(i) + LW + gap / 2 - tw / 2, laneTop + laneH * 0.62, tw);
    return { w, t };
  });
  // 위: 의뢰자 / 비교표
  const topW = P ? 220 : 240;
  const client = box(el(cv, "rl-pill", "의뢰자", { fontSize: px(fs + 2) }), W / 2 - topW / 2, 24, topW, 56);
  const board = box(el(cv, "rl-node", "비교표", { fontSize: px(fs + 2), borderWidth: "2px" }), W / 2 - topW / 2, 24, topW, 56);
  // 기한 막대
  const dl = box(el(cv), M, laneTop - (P ? 70 : 64), W - M * 2, 50);
  const dlTxt = box(el(dl, "", "같은 요청서, 같은 기한", { fontSize: px(fs), fontWeight: "600", whiteSpace: "nowrap" }), 0, 0);
  const dlTrack = box(el(dl, "", null, { background: "#D9D9D3", height: "4px" }), 0, 34, W - M * 2, 4);
  const dlFill = box(el(dlTrack, "", null, { background: "#1B1B19", transformOrigin: "0 50%" }), 0, 0, W - M * 2, 4);

  const rw = LW - (P ? 16 : 30), rH = P ? 120 : 110;
  const reqs = ks.map((_, i) => {
    const d = sheet(cv, lx(i) + (LW - rw) / 2, laneTop + 70, rw, rH);
    box(el(d, "rl-hd", "요청서", { fontSize: px(fs) }), 14, 12);
    bars(d, 14, [46, 66, 86], [rw - 40, rw - 70, rw - 56], 7);
    return d;
  });
  const reps = ks.map((_, i) => {
    const d = sheet(cv, lx(i) + (LW - rw) / 2, laneTop + 70 + rH + 30, rw, P ? 110 : 96);
    box(el(d, "rl-hd", "회신", { fontSize: px(fs) }), 14, 12);
    bars(d, 14, [46, 66], [rw - 50, rw - 80], 7);
    return d;
  });

  tl.set([...reqs, ...reps], { autoAlpha: 0 }, 0).set(board, { autoAlpha: 0 }, 0).set(dlFill, { scaleX: 0 }, 0)
    .set(walls.map((w) => w.t), { autoAlpha: 0 }, 0).set(walls.map((w) => w.w), { scaleY: 0, transformOrigin: "50% 0%" }, 0);
  tl.fromTo([...lanes, ...heads], { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.04 }, 0.05);
  tl.fromTo(client, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 0.1);
  tl.fromTo(dl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.4);
  // 같은 요청서가 동시에 떨어진다
  reqs.forEach((d, i) => tl.fromTo(d, { autoAlpha: 0, left: W / 2 - rw / 2, top: 40, scale: 0.6 }, { autoAlpha: 1, left: lx(i) + (LW - rw) / 2, top: laneTop + 70, scale: 1, duration: 0.8, ease: "expo.out" }, 0.8));
  tl.to(dlFill, { scaleX: 1, duration: 3.2, ease: "none" }, 1.1);
  tl.to(walls.map((w) => w.w), { scaleY: 1, duration: 0.7, ease: "expo.out", stagger: 0.08 }, 1.2);
  // 회신이 차례로
  reps.forEach((d, i) => tl.fromTo(d, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "expo.out" }, 2.0 + [0, 0.5, 1.0][i]));
  // B 회신이 옆 칸을 보려다 벽에 막힌다
  const peek = 3.6;
  tl.to(reps[1], { x: -(gap / 2 + (P ? 10 : 18)), duration: 0.3, ease: "power2.in" }, peek)
    .to(reps[1], { x: 0, duration: 0.5, ease: "back.out(3)" }, peek + 0.3)
    .to(walls.map((w) => w.t), { autoAlpha: 1, duration: 0.2 }, peek + 0.25)
    .fromTo(walls[0].t, { backgroundColor: "#EDEF5C", scale: 1.15 }, { backgroundColor: "#FBFBF8", scale: 1, duration: 0.8, ease: "expo.out" }, peek + 0.28);
  // 회신은 위로, 비교표로만
  const up = 4.8;
  tl.to(client, { autoAlpha: 0, duration: 0.25 }, up).to(board, { autoAlpha: 1, duration: 0.3 }, up + 0.1);
  reps.forEach((d, i) => tl.to(d, { top: 30, left: W / 2 - rw / 2, scale: 0.5, autoAlpha: 0, duration: 0.75, ease: "expo.inOut" }, up + 0.2 + i * 0.1));
  tl.to(board, { backgroundColor: "#EDEF5C", duration: 0.25 }, up + 1.0);
  tl.to({}, { duration: 1.6 }, up + 1.3);
  return tl;
}
export const croRulesDims = dims([1000, 640], [600, 860]);
