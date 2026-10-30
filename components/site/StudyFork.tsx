"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { buffer, drawCard, setReduced, W, H, type Kind } from "@/components/site/study-fork-motion";

/**
 * 견적 요청 첫 화면의 네 갈래(Tox·PD·PK·Other).
 * 카드마다 상징 그래픽 네 장면이 이어 재생되고(카드끼리 0.7초 엇갈림), 고르면 그래픽이 화면 가운데로 퍼지며 다음 화면으로 넘어간다.
 * 링크는 진짜 <a href>라 스크립트 없이도, 새 탭(⌘·Ctrl 클릭)으로도 열린다. 동작 줄이기에서는 정지 화면 한 장, 누르면 바로 이동.
 */
const OPTS: { k: Kind; name: string; sub: string; href: string }[] = [
  { k: "tox", name: "Tox", sub: "독성", href: "/request/tox" },
  { k: "pd", name: "PD", sub: "효력", href: "/request/pd" },
  { k: "pk", name: "PK", sub: "약동학", href: "/request/pk" },
  { k: "other", name: "Other", sub: "개별 분석", href: "/request/other" },
];

export function StudyFork() {
  const router = useRouter();
  const root = useRef<HTMLUListElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = mq.matches;
    setReduced(reduce);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const items = [...el.querySelectorAll<HTMLAnchorElement>("a[data-k]")].map((a, i) => {
      const cv = a.querySelector("canvas")!;
      cv.width = W * dpr;
      cv.height = H * dpr;
      return { a, k: a.dataset.k as Kind, c: cv.getContext("2d")!, off: i * 700, A: buffer(), B: buffer(), vis: true };
    });
    OPTS.forEach((o) => router.prefetch(o.href));

    let raf = 0;
    const t0 = performance.now();
    const paint = (now: number) => {
      for (const it of items) if (it.vis) drawCard(it.c, it.k, now - t0 + it.off, it.A, it.B, reduce);
    };
    const frame = (now: number) => {
      paint(now);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { const it = items.find((x) => x.a === e.target); if (it) it.vis = e.isIntersecting; }),
      { threshold: 0.1 },
    );
    items.forEach((it) => io.observe(it.a));
    const onMq = () => { reduce = mq.matches; setReduced(reduce); run(); };
    mq.addEventListener("change", onMq);
    // 화면이 다시 보일 때(뒤로 가기 포함) 덮개를 걷고 다시 재생한다
    const onShow = () => { busy.current = false; cover.current?.classList.remove("on"); items.forEach((it) => (it.a.style.visibility = "")); run(); };
    window.addEventListener("pageshow", onShow);
    let cancelled = false;
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { if (!cancelled) run(); });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      mq.removeEventListener("change", onMq);
      window.removeEventListener("pageshow", onShow);
    };
  }, [router]);

  const pick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // 새 탭·새 창으로 여는 클릭은 브라우저에 맡긴다
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 키보드(Enter)로 고른 경우와 동작 줄이기는 전환 없이 바로 이동
    if (reduce || e.detail === 0) { router.push(href); return; }
    const a = e.currentTarget;
    const cv = a.querySelector("canvas")!;
    const r = cv.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const vw = window.innerWidth, vh = window.innerHeight;
    const fly = document.createElement("canvas");
    fly.className = "rqfly";
    fly.width = cv.width;
    fly.height = cv.height;
    fly.getContext("2d")?.drawImage(cv, 0, 0);
    Object.assign(fly.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(fly);
    a.style.visibility = "hidden";
    const big = Math.max(vw / r.width, vh / r.height);
    const to = `translate(${vw / 2 - cx}px, ${vh / 2 - cy}px)`;
    const anim = fly.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1, filter: "blur(0)" },
        { transform: `${to} scale(${big * 1.05})`, opacity: 1, filter: "blur(0)", offset: 0.55 },
        { transform: `${to} scale(${big * 1.7})`, opacity: 0, filter: "blur(10px)" },
      ],
      { duration: 980, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
    );
    anim.onfinish = () => fly.remove();
    window.setTimeout(() => cover.current?.classList.add("on"), 420);
    window.setTimeout(() => router.push(href), 700);
    // 이동이 늦어져도 화면이 덮인 채 멈추지 않게
    window.setTimeout(() => { fly.remove(); }, 1400);
  };

  return (
    <>
      <ul className="rqfork" ref={root} aria-label="시험 종류">
        {OPTS.map((o) => (
          <li key={o.k}>
            <a className="rqk" data-k={o.k} href={o.href} onClick={(e) => pick(e, o.href)}>
              <canvas aria-hidden="true" />
              <span className="t"><b>{o.name}</b><small>{o.sub}</small></span>
            </a>
          </li>
        ))}
      </ul>
      <div className="rqcover" ref={cover} aria-hidden="true" />
    </>
  );
}
