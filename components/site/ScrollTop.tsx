"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 페이지를 열거나 옮기면 맨 위(제목)에서 시작한다.
 * - iOS 사파리·카카오톡 인앱은 스크롤 스냅이 켜진 상태에서 이전 위치를 새 페이지에 맞추거나,
 *   새로고침·다시 열기 때 예전 위치로 되돌려 제목을 건너뛴다.
 * - 그래서 브라우저 자동 복원을 끄고, 스냅을 잠깐 끈 채 맨 위로 올린 뒤,
 *   글꼴·이미지가 늦게 자리 잡아 밀리는 경우를 위해 사용자가 손대기 전까지 몇 번 더 맞춘다.
 * 앵커(#…)로 들어온 경우는 건드리지 않는다.
 */
export function ScrollTop() {
  const pathname = usePathname();
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = "light"; // 공개 페이지는 늘 밝은 테마 (앱에서 넘어와도)
    if (window.location.hash) return;
    try { history.scrollRestoration = "manual"; } catch { /* 지원 안 하는 브라우저 */ }

    let touched = false;
    const stop = () => { touched = true; };
    const opts = { passive: true, once: true } as const;
    addEventListener("touchstart", stop, opts);
    addEventListener("wheel", stop, opts);
    addEventListener("keydown", stop, { once: true });

    const toTop = () => {
      if (touched || window.scrollY === 0) return;
      const prev = html.style.scrollSnapType;
      html.style.scrollSnapType = "none";
      window.scrollTo(0, 0);
      requestAnimationFrame(() => { html.style.scrollSnapType = prev; });
    };
    toTop();
    // 메뉴 닫힘·글꼴 로드·주소창 변화 뒤에 다시 한 번씩 (사용자가 스크롤을 시작하면 멈춘다)
    const timers = [60, 250, 700].map((ms) => window.setTimeout(toTop, ms));
    const onLoad = () => toTop();
    addEventListener("load", onLoad, { once: true });
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { touched = false; toTop(); } };
    addEventListener("pageshow", onShow);
    return () => {
      timers.forEach(clearTimeout);
      removeEventListener("touchstart", stop);
      removeEventListener("wheel", stop);
      removeEventListener("keydown", stop);
      removeEventListener("load", onLoad);
      removeEventListener("pageshow", onShow);
    };
  }, [pathname]);
  return null;
}
