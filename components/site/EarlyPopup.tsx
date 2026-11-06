"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { EarlySpec } from "./EarlySpec";
import "./early-shared.css";

const KEY = "danchu-early-popup-hide";

/** 한국 날짜 (YYYY-MM-DD) */
const kstDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/**
 * 메인 사전예약 팝업 (2026-11-06 시안 판 15). 넓은 화면은 가운데 두 칸, 휴대폰은 아래에서 올라오는 시트.
 * "오늘 하루 보지 않기"는 이 브라우저에서 한국 날짜로 오늘까지만 숨긴다. 저장이 막힌 브라우저면 매번 뜬다.
 * 사전예약 기간에만 메인에서 그린다 (app/page.tsx).
 */
export function EarlyPopup({ days }: { days: number }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let hidden = false;
    try { hidden = localStorage.getItem(KEY) === kstDay(); } catch { /* 저장소를 못 쓰면 보여 준다 */ }
    const d = ref.current;
    if (!hidden && d && !d.open) {
      // 첫 장면이 그려진 뒤 띄운다 (LCP 를 팝업이 가리지 않게)
      // 열리면 창 자체에 초점을 둔다 (닫기 단추에 초점 테두리가 바로 생기지 않게). Tab 은 안의 단추로 간다
      const t = window.setTimeout(() => { d.showModal(); d.focus(); }, 400);
      return () => window.clearTimeout(t);
    }
  }, []);

  function close() { ref.current?.close(); }
  function hideToday() {
    try { localStorage.setItem(KEY, kstDay()); } catch { /* 저장소를 못 쓰면 이번만 닫는다 */ }
    close();
  }

  return (
    <dialog
      ref={ref}
      className="epop"
      tabIndex={-1}
      aria-labelledby="epop-t"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="epop-in">
        <div className="epop-l">
          <p className="epop-live mono">사전예약 진행 중<span className="epop-dm"> · D-{days}</span></p>
          <h2 id="epop-t">단추를<br />가장 먼저<span className="epop-br"><br /></span> 만나보세요.</h2>
          <p className="epop-subm">사전예약하고 시범 운영 소식을 문자로 받아보세요.</p>
          <p className="epop-d"><b>D-{days}</b><span>2027.06.01 시범 운영</span></p>
        </div>
        <div className="epop-r">
          <button type="button" className="epop-x" onClick={close} aria-label="닫기"><X size={20} aria-hidden="true" /></button>
          <p className="epop-sub">사전예약하고 시범 운영 소식을<br />문자로 가장 먼저 받아보세요.</p>
          <EarlySpec className="epop-spec" />
          <div className="epop-foot">
            <div className="epop-cta">
              <a href="/early" className="epop-go solid"><small>의뢰자</small><b>사전예약하기</b></a>
              <a href="/early?for=cro" className="epop-go"><small>시험 기관</small><b>사전예약하기</b></a>
            </div>
            <button type="button" className="epop-hide" onClick={hideToday}>오늘 하루 보지 않기</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
