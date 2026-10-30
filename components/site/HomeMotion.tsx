"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { endCard } from "@/components/site/reel/kit";

/**
 * 랜딩 아래 세 장면(금액 비교 · 한번 요청 · 근거)의 GSAP 타임라인.
 * CSS 기본값이 완성 상태이므로, 동작 줄이기에서는 아무것도 하지 않는다.
 * 장면 그림이 화면 아래 12% 선을 넘어 들어오면 바로 재생하고, 완전히 벗어나면 초기화해 다시 재생한다.
 */
export function HomeMotion() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode) => r.querySelector(s) as T;
    const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode) => [...r.querySelectorAll(s)] as T[];
    const wide = () => matchMedia("(min-width:861px)").matches;
    const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
    const count = (tl: gsap.core.Timeline, el: Element, to: number, at: number, d = 0.9) => {
      const o = { v: 0 };
      el.textContent = "0";
      tl.fromTo(o, { v: 0 }, { v: to, duration: d, ease: "expo.out", onUpdate: () => (el.textContent = fmt(o.v)) }, at);
    };
    // 컨테이너 안에서 요소의 기준점 좌표
    const pt = (el: Element, box: Element, ax: number, ay: number) => {
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      return { x: r.left - b.left + r.width * ax, y: r.top - b.top + r.height * ay };
    };

    /* ---- 1. 금액만 비교: 총액이 먼저, 막대가 갈라지며 차이가 설명된다 ---- */
    function cmp(s: HTMLElement) {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      const ph = $$(".gm-ph li", s), list = $(".gm-ph", s);
      const [A, B] = $$(".gm-bar", s);
      const step = (i: number, at: number) => {
        tl.to(ph, { opacity: (k: number) => (k === i ? 1 : 0.32), duration: 0.35, ease: "power2.out" }, at)
          .to(list, { "--pr": (i + 1) / 3, duration: 0.5, ease: "power3.inOut" }, at);
      };
      tl.set(ph, { opacity: 0.32 }, 0).set(list, { "--pr": 0 }, 0);
      tl.fromTo([$(".g-main", A), $(".g-main", B)], { scaleX: 0 }, { scaleX: 1, duration: 0.9, stagger: 0.08 }, 0.1)
        .fromTo($(".g-tk", A), { scaleX: 0, backgroundColor: "#1B1B19", borderLeftWidth: 0 }, { scaleX: 1, duration: 0.5, ease: "expo.out" }, 0.55)
        .fromTo($$(".g-seg em", s), { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0)
        .fromTo($(".g-ghost", B), { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0);
      count(tl, $(".g-sum b", A), 1200, 0.15);
      count(tl, $(".g-sum b", B), 900, 0.2);
      tl.fromTo($(".g-brk.g-tot", s), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.75)
        .fromTo($(".g-brk.g-tot i", s), { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, 0.75)
        .fromTo($(".g-brk.g-tot span", s), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.9);
      step(0, 0.1);
      const p2 = 2.0;
      tl.to($(".g-tk", A), { backgroundColor: "#5C5C57", borderLeftWidth: 2, duration: 0.25, ease: "power2.out" }, p2)
        .fromTo($(".g-tk", A), { y: 0 }, { y: -7, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1 }, p2)
        .to($$(".g-seg em", s), { opacity: 1, duration: 0.3, stagger: 0.05 }, p2 + 0.15)
        .to($(".g-ghost", B), { opacity: 1, duration: 0.01 }, p2 + 0.1)
        .fromTo($(".g-ghost rect", B), { strokeDashoffset: 100, strokeDasharray: "100 100" }, { strokeDashoffset: 0, duration: 0.45, ease: "power2.inOut" }, p2 + 0.1)
        .fromTo($(".g-ghost", B), { backgroundColor: "rgba(237,239,92,0)" }, { backgroundColor: "rgba(237,239,92,1)", duration: 0.3, ease: "power2.out" }, p2 + 0.5)
        .set($(".g-ghost rect", B), { strokeDasharray: "4 3", strokeDashoffset: 0 }, p2 + 0.55)
        .to($(".g-brk.g-tot", s), { opacity: 0, duration: 0.25, ease: "power2.out" }, p2 + 0.3)
        .fromTo($(".g-brk.g-tkb i", s), { scaleX: 0 }, { scaleX: 1, duration: 0.45 }, p2 + 0.45)
        .fromTo($(".g-brk.g-tkb span", s), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, p2 + 0.55)
        .fromTo($$(".gm-items tr", s), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, stagger: 0.06, ease: "power3.out" }, p2 + 0.2)
        .fromTo($$(".g-r2 .g-mk, .g-r3 .g-mk", s), { scaleX: 0 }, { scaleX: 1, duration: 0.35, stagger: 0.12, ease: "power2.inOut" }, p2 + 0.8);
      step(1, p2);
      const p3 = 3.9;
      tl.fromTo($(".gm-guides", s), { "--go": 0 }, { "--go": 0.55, duration: 0.3, ease: "power2.out" }, p3)
        .fromTo($$(".gm-guides i", s), { scaleY: 0, transformOrigin: "top" }, { scaleY: 1, duration: 0.5, stagger: 0.08 }, p3)
        .fromTo($(".g-brk.g-same i", s), { scaleX: 0 }, { scaleX: 1, duration: 0.45 }, p3 + 0.25)
        .fromTo($(".g-brk.g-same span", s), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, p3 + 0.35)
        .fromTo($$(".g-r1 .g-mk", s), { scaleX: 0 }, { scaleX: 1, duration: 0.35, stagger: 0.1, ease: "power2.inOut" }, p3 + 0.3);
      step(2, p3);
      return tl;
    }

    /* ---- 2. 한번 요청으로: 사본이 선을 타고 나가고, 회신이 표로 돌아온다 ---- */
    function fl(s: HTMLElement) {
      const dia = $(".gm-dia", s), svg = $<SVGSVGElement>(".gm-wires", s), doc = $(".gm-doc", s), card = $(".gm-card", s);
      const orgs = $$(".g-org", s), rows = $$(".g-mrow", s), cps = $$(".g-cp", s), rps = $$(".g-rp", s);
      const W = wide();
      const paths = $$<SVGPathElement>("path", svg);
      const curve = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        W ? `M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`
          : `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
      orgs.forEach((o, i) => paths[i].setAttribute("d", curve(pt(doc, dia, W ? 1 : 0.5, W ? 0.5 : 1), pt(o, dia, W ? 0 : 0.12, W ? 0.5 : 0))));
      [0, 1].forEach((i) => paths[3 + i].setAttribute("d", curve(pt(orgs[i], dia, W ? 1 : 0.88, W ? 0.5 : 1), pt(rows[i], dia, W ? 0 : 0.5, W ? 0.5 : 0))));
      const ride = (tl: gsap.core.Timeline, el: Element, path: SVGPathElement, at: number, d: number, w: number, h: number) => {
        const len = path.getTotalLength(), o = { p: 0 };
        tl.fromTo(o, { p: 0 }, {
          p: 1, duration: d, ease: "power2.inOut",
          onUpdate: () => { const q = path.getPointAtLength(o.p * len); gsap.set(el, { x: q.x - w / 2, y: q.y - h / 2 }); },
        }, at);
        if (W) tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: d, ease: "power2.inOut" }, at);
      };
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      const steps = $$(".gm-steps li", s), prog = $(".gm-steps .prog", s);
      const stepTo = (i: number, at: number) =>
        tl.to(steps, { color: (k: number) => (k <= i ? "#1B1B19" : "#ADADA6"), duration: 0.3, ease: "power2.out" }, at)
          .to(prog, { scaleX: (i + 1) / 3, duration: 0.6, ease: "power3.inOut" }, at);
      tl.set(steps, { color: "#ADADA6" }, 0).set(prog, { scaleX: 0 }, 0);
      if (!W) paths.forEach((p) => gsap.set(p, { strokeDasharray: "none" }));
      tl.fromTo(doc, { y: 24, opacity: 0, rotation: -1.5 }, { y: 0, opacity: 1, rotation: 0, duration: 0.7 }, 0)
        .fromTo($$(".gm-doc dl div", s), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.07 }, 0.25)
        .fromTo(orgs, { opacity: 0.35 }, { opacity: 0.35, duration: 0.01 }, 0)
        .fromTo($$(".g-org small, .g-org .g-st", s), { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0)
        .fromTo(card, { opacity: 0.35 }, { opacity: 0.35, duration: 0.01 }, 0)
        .fromTo($$(".gm-card .g-bt i", s), { scaleX: 0 }, { scaleX: 0, duration: 0.01 }, 0)
        .fromTo($$(".gm-card em, .gm-card small", s), { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0)
        .fromTo(paths.slice(3), { opacity: 0 }, { opacity: 0, duration: 0.01 }, 0);
      stepTo(0, 0);
      const t1 = 0.7;
      cps.forEach((c, i) => {
        const at = t1 + i * 0.12;
        tl.fromTo(c, { opacity: 0, scale: 0.7, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.25, ease: "back.out(2)" }, at);
        ride(tl, c, paths[i], at, 0.75, 44, 56);
        tl.to(c, { opacity: 0, scale: 0.6, duration: 0.2, ease: "power2.out" }, at + 0.72)
          .to(orgs[i], { opacity: 1, duration: 0.2, ease: "power2.out" }, at + 0.72)
          .fromTo(orgs[i], { backgroundColor: "#F5F6B4" }, { backgroundColor: "#F4F4F0", duration: 0.6, ease: "power2.out", immediateRender: false }, at + 0.72);
      });
      const t2 = 2.0;
      stepTo(1, t2);
      orgs.forEach((o, i) => {
        tl.fromTo($$("small, .g-st", o), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06 }, t2 + i * 0.18);
      });
      tl.to(card, { opacity: 1, duration: 0.3, ease: "power2.out" }, t2 + 0.2)
        .to(paths.slice(3), { opacity: 1, duration: 0.01 }, t2 + 0.35);
      rps.forEach((r, i) => {
        const at = t2 + 0.35 + i * 0.16, b = r.getBoundingClientRect();
        const bar = $(".g-bt i", rows[i]), em = $("em", rows[i]);
        tl.fromTo(r, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, at);
        ride(tl, r, paths[3 + i], at, 0.7, b.width, b.height);
        tl.to(r, { opacity: 0, scale: 0.7, duration: 0.18, ease: "power2.out" }, at + 0.68)
          .to(bar, { scaleX: +bar.style.getPropertyValue("--w"), duration: 0.7 }, at + 0.66)
          .to(em, { opacity: 1, duration: 0.01 }, at + 0.66);
        count(tl, em, +(em.dataset.to || 0), at + 0.66, 0.7);
      });
      tl.to($$(".g-wait em, .gm-card small", s), { opacity: 1, duration: 0.35, ease: "power2.out" }, t2 + 1.3);
      stepTo(2, t2 + 1.3);
      return tl;
    }

    /* ---- 3. 근거: 답변 칩이 붙고, 제안마다 출처 페이지가 열리며 줄이 표시된다 ---- */
    function ev(s: HTMLElement) {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      const chips = $$(".g-chip", s), rows = $$(".g-sr", s);
      tl.fromTo(chips, { opacity: 0, y: 10, scale: 0.92, backgroundColor: "#E9E9E4", color: "#1B1B19" },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.09, ease: "back.out(2)" }, 0.05)
        .to(chips, { backgroundColor: "#1B1B19", color: "#F4F4F0", duration: 0.2, stagger: 0.09, ease: "power2.out" }, 0.3);
      rows.forEach((r, i) => {
        const at = 0.75 + i * 0.5;
        tl.fromTo(r, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.out" }, at)
          .fromTo($(".g-t", r), { x: -10 }, { x: 0, duration: 0.6 }, at)
          .fromTo($(".g-pg", r), { rotationY: -80, transformPerspective: 500, opacity: 0 }, { rotationY: 0, opacity: 1, duration: 0.6 }, at + 0.2)
          .fromTo($$(".g-pg i:not(.g-hl)", r), { scaleX: 0 }, { scaleX: 1, duration: 0.4, stagger: 0.04 }, at + 0.3)
          .fromTo($(".g-pg .g-hl", r), { scaleX: 0 }, { scaleX: 1, duration: 0.32, ease: "power2.inOut" }, at + 0.5)
          .fromTo($(".g-src .g-mk", r), { scaleX: 0 }, { scaleX: 1, duration: 0.32, ease: "power2.inOut" }, at + 0.5);
      });
      tl.fromTo($(".g-foot", s), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, 2.4);
      return tl;
    }

    const build: Record<string, (s: HTMLElement) => gsap.core.Timeline> = { cmp, fl, ev };
    const observers: IntersectionObserver[] = [];
    const timelines: gsap.core.Timeline[] = [];
    const timers: (() => void)[] = [];
    $$("[data-gm]", document).forEach((s) => {
      const kind = s.dataset.gm || "";
      if (!build[kind]) return;
      let tl: gsap.core.Timeline | null = null, played = false;
      // data-cycle: 재생이 끝나면 잠시 멈췄다가 다음 예시로 바꿔 다시 재생 (한 장의 요청서 장면: Tox → PD → PK → Other)
      type Ex = { tag: string; t: string; k: string; v: string; a: [number, number]; b: [number, number] };
      let cycle: Ex[] = [];
      try { cycle = s.dataset.cycle ? (JSON.parse(s.dataset.cycle) as Ex[]) : []; } catch { cycle = []; }
      let idx = 0;
      const won = (n: number) => n.toLocaleString("ko-KR");
      const apply = (d: Ex) => {
        const set = (sel: string, txt: string, i = 0) => { const el = s.querySelectorAll<HTMLElement>(sel)[i]; if (el) el.textContent = txt; };
        set(".gm-doc .mono", `요청서 · ${d.tag}`);
        set(".gm-doc > b", d.t);
        set(".gm-doc dt", d.k);
        set(".gm-doc dd", d.v);
        [d.a, d.b].forEach(([amt, wk], i) => {
          set(".g-org small", `${won(amt)}만 원 · ${wk}주`, i);
          set(".g-rp", won(amt), i);
          const em = s.querySelectorAll<HTMLElement>(".g-mrow em")[i];
          if (em) { em.dataset.to = String(amt); em.textContent = won(amt); }
        });
      };
      const host = s.querySelector<HTMLElement>(".gm-sheet, .gm-dia, .gm-adv");
      let endEls: HTMLElement[] = [];
      const fresh = () => {
        if (tl) tl.progress(0).kill();
        endEls.forEach((e) => e.remove());
        endEls = [];
        gsap.set(s.querySelectorAll("*"), { clearProps: "transform,opacity,clipPath,backgroundColor,color,borderLeftWidth" });
        tl = build[kind](s);
        // 마무리 로고 엔드카드: 그림 영역을 덮고 가운데 로고만 남긴다. 예시가 바뀌며 반복되는 장면은 한 바퀴(마지막 예시) 끝에만
        if (host && (cycle.length < 2 || idx === cycle.length - 1)) {
          const bg = getComputedStyle(host).backgroundColor;
          endEls = endCard(tl, host, host.clientWidth, host.clientHeight, null, bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "var(--paper,#F4F4F0)");
        }
        tl.progress(0);
        timelines.push(tl);
        if (cycle.length > 1) tl.eventCallback("onComplete", () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            if (!played) return;
            idx = (idx + 1) % cycle.length;
            apply(cycle[idx]);
            fresh();
            tl!.play(0);
          }, endEls.length ? 300 : 2400);
        });
      };
      let timer = 0;
      timers.push(() => window.clearTimeout(timer));
      fresh();
      const vis = s.querySelector(".gm-sheet, .gm-dia, .gm-adv");
      if (!vis) return;
      const start = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !played) { played = true; fresh(); tl!.play(0); } }), { rootMargin: "0px 0px -12% 0px" });
      start.observe(vis);
      const reset = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting && played) { played = false; window.clearTimeout(timer); fresh(); } }));
      reset.observe(s);
      observers.push(start, reset);
    });
    return () => {
      observers.forEach((o) => o.disconnect());
      timelines.forEach((t) => t.kill());
      timers.forEach((c) => c());
    };
  }, []);
  return null;
}
