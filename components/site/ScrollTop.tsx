"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 페이지를 열거나 옮기면 맨 위(제목)에서 시작한다.
 *
 * 제목이 사라져 보이던 원인 (2026-10-27 재현):
 * 페이지 중간에서 메뉴로 다른 페이지로 가면, 새 페이지가 그려진 뒤 브라우저가 스크롤 스냅을
 * "가장 가까운 장면"에 다시 맞추면서 제목 아래(두세 번째 장면)로 내려가 있었다.
 * 예전에는 60·250·700ms에 한 번씩만 맨 위로 올렸고, 화면을 살짝 누르기만 해도(touchstart) 멈췄다.
 * 휴대폰은 새 페이지 내용·글꼴이 늦게 자리 잡아 이 세 번이 모두 지나간 뒤 다시 밀리거나,
 * 누르는 순간 보정이 끝나 제목 아래에 그대로 남았다.
 *
 * 게다가 html의 scroll-behavior:smooth 때문에 맨 위로 올리는 것도 미끄러지듯 0.7초 걸렸고,
 * 그 도중 스냅이 다시 켜지면(예전엔 한 프레임 뒤) 중간 장면에 붙잡혔다.
 *
 * 지금 방식:
 * - 페이지가 바뀌면 스냅을 끄고 맨 위로 즉시 옮긴 뒤, 사용자가 실제로 스크롤하기 전까지(최대 3초) 매 프레임 맨 위를 지킨다.
 * - 멈추는 건 실제 스크롤 의도(손가락 끌기, 휠, 스크롤 키, 같은 페이지 안 링크)뿐이다. 그냥 누르는 건 멈추지 않는다.
 * - 끝나면 스냅을 원래대로 돌린다.
 * 앵커(#…)로 들어온 경우는 건드리지 않는다.
 */
const HOLD_MS = 3000;
// html에 scroll-behavior:smooth가 걸려 있어 그냥 scrollTo(0,0)은 0.7초 가까이 미끄러지며 올라간다.
// 그 사이 스냅이 다시 켜지거나 화면을 만지면 제목 아래에서 멈췄다. 맨 위로는 항상 즉시 옮긴다.
const jumpTop = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home", " ", "Spacebar"]);

export function ScrollTop() {
  const pathname = usePathname();
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = "light"; // 공개 페이지는 늘 밝은 테마 (앱에서 넘어와도)
    if (window.location.hash) return;
    try { history.scrollRestoration = "manual"; } catch { /* 지원 안 하는 브라우저 */ }

    let done = false;
    let raf = 0;
    const prevSnap = html.style.scrollSnapType;
    html.style.scrollSnapType = "none";

    const release = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      html.style.scrollSnapType = prevSnap;
      removeEventListener("touchmove", release);
      removeEventListener("wheel", release);
      removeEventListener("keydown", onKey);
      removeEventListener("click", onClick, true);
    };
    const onKey = (e: KeyboardEvent) => { if (SCROLL_KEYS.has(e.key)) release(); };
    // 같은 페이지 안으로 옮기는 링크("아래로 내려 보세요" 등)를 누르면 그 이동을 막지 않게 바로 놓는다
    const onClick = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href^="#"]')) release(); };
    addEventListener("click", onClick, true);
    addEventListener("touchmove", release, { passive: true });
    addEventListener("wheel", release, { passive: true });
    addEventListener("keydown", onKey);

    const hold = () => {
      if (done) return;
      if (window.scrollY !== 0) jumpTop();
      raf = requestAnimationFrame(hold);
    };
    hold();
    const timer = window.setTimeout(release, HOLD_MS);

    // 뒤로 가기 캐시(bfcache)로 돌아온 경우도 맨 위에서
    const onShow = (e: PageTransitionEvent) => { if (e.persisted && window.scrollY !== 0) jumpTop(); };
    addEventListener("pageshow", onShow);
    return () => {
      release();
      removeEventListener("pageshow", onShow);
    };
  }, [pathname]);
  return null;
}
