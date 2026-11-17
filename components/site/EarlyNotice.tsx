"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import "./early-shared.css";

const KEY = "danchu-early-notice-hide";

/** 한국 날짜 (YYYY-MM-DD) */
const kstDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/**
 * 메인 사전예약 알림(2026-11-17, 자동 팝업을 대신함). 들어오자마자 화면을 막지 않고,
 * 첫 화면(히어로)을 지나 내려가면 아래에서 한 줄로 올라온다. 히어로나 마지막 장면(사전예약 버튼이 이미 있는 화면)이
 * 보이면 내려가서, 한 화면에 채운 버튼이 둘이 되지 않게 한다. 닫으면 이 브라우저에서 한국 날짜로 오늘까지 숨긴다.
 * 사전예약 기간에만 메인에서 그린다 (app/page.tsx).
 */
export function EarlyNotice({ days }: { days: number }) {
  const [on, setOn] = useState(false);
  const [closed, setClosed] = useState(false);
  const seen = useRef({ first: true, fin: false });

  useEffect(() => {
    let off = false;
    try { off = localStorage.getItem(KEY) === kstDay(); } catch { /* 저장소를 못 쓰면 보여 준다 */ }
    if (off) return;
    const first = document.querySelector(".a .first");
    const fin = document.querySelector(".a .fin");
    const sync = () => setOn(!seen.current.first && !seen.current.fin);
    // 히어로: 아래쪽 절반에 남아 있는 동안은 "보임"(사전예약 버튼이 아직 손 닿는 곳에 있다)
    const ioFirst = new IntersectionObserver(([e]) => { seen.current.first = e.isIntersecting; sync(); }, { rootMargin: "-50% 0px 0px 0px" });
    // 마지막 장면: 화면 위쪽 6할 안으로 들어오면 "보임"(그 장면의 사전예약 버튼과 겹치지 않게)
    const ioFin = new IntersectionObserver(([e]) => { seen.current.fin = e.isIntersecting; sync(); }, { rootMargin: "0px 0px -40% 0px" });
    if (first) ioFirst.observe(first);
    if (fin) ioFin.observe(fin);
    const io = { disconnect: () => { ioFirst.disconnect(); ioFin.disconnect(); } };
    return () => io.disconnect();
  }, []);

  function close() {
    try { localStorage.setItem(KEY, kstDay()); } catch { /* 저장소를 못 쓰면 이번만 닫는다 */ }
    setClosed(true);
  }

  // 처음 그릴 때는 숨은 상태(visibility:hidden)라 화면·초점 순서에 나타나지 않는다
  return (
    <aside className="enote" data-on={on && !closed ? "" : undefined} aria-label="사전예약 알림">
      <p className="enote-t"><b>사전예약 진행 중</b><span>시범 운영까지 <span className="enote-d">D-{days}</span></span></p>
      <a href="/early" className="btn solid enote-go">사전예약하기</a>
      <button type="button" className="enote-x" onClick={close} aria-label="알림 닫기"><X size={18} aria-hidden="true" /></button>
    </aside>
  );
}
