"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppState";
export function ThemeSettings() {
  const { theme, setTheme } = useApp();
  const [mail, setMail] = useState<boolean | null>(null);
  // 문자 알림 (0033). null 이면 아직 못 불러왔거나 DB 가 0033 전
  const [sms, setSms] = useState<boolean | null>(null);
  const [hasPhone, setHasPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("알림 설정을 불러오지 못했어요.");
      const d = await r.json();
      setMail(d.email);
      setSms(typeof d.sms === "boolean" ? d.sms : null);
      setHasPhone(!!d.hasPhone);
      setMessage("");
    } catch {
      setMessage("알림 설정을 불러오지 못했어요.");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const update = async (which: "email" | "sms") => {
    const cur = which === "email" ? mail : sms;
    if (cur === null || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [which]: !cur }),
      });
      if (!r.ok) throw new Error();
      if (which === "email") setMail(!cur);
      else setSms(!cur);
      setMessage("알림 설정을 저장했어요.");
    } catch {
      setMessage("저장하지 못했어요. 다시 눌러 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card card--pad stack" aria-label="화면과 알림 설정">
      <h2 style={{ fontSize: 16 }}>화면과 알림</h2>
      <label className="fld">
        <span className="fld__lab">화면 테마</span>
        <select
          className="sel"
          value={theme}
          onChange={(e) => setTheme(e.target.value as typeof theme)}
        >
          <option value="system">기기 설정 따르기</option>
          <option value="light">밝게</option>
          <option value="dark">어둡게</option>
        </select>
      </label>
      <div className="kv">
        <div>
          <b>진행 상황 이메일</b>
          <p className="fld__help">
            견적 도착과 진행 상황을 메일로 받아요. 앱 안의 알림, 접수 확인,
            로그인 메일은 계속 받을 수 있어요.
          </p>
        </div>
        {/* 불러오기 전·실패를 "꺼짐"처럼 보이지 않게 한다 (2026-10-29 점검 7: DB 는 켜짐인데 화면은 꺼진 스위치) */}
        {mail === null ? (
          <span className="fld__help" aria-live="polite">{message ? "불러오지 못함" : "불러오는 중…"}</span>
        ) : (
          <button
            type="button"
            className="tgl"
            aria-label="진행 상황 이메일"
            aria-pressed={mail}
            disabled={busy}
            onClick={() => update("email")}
          >
            <span />
          </button>
        )}
      </div>
      {sms !== null && (
        <div className="kv">
          <div>
            <b>문자 알림</b>
            <p className="fld__help">
              {hasPhone
                ? "새 참여 안내, 선정, 비교표 공개, 계약 확인, 청구서처럼 꼭 알아야 하는 순간에만 프로필의 휴대전화로 보내요."
                : "프로필에 휴대전화를 적으면 꼭 알아야 하는 순간에 문자로도 알려요."}
            </p>
          </div>
          <button
            type="button"
            className="tgl"
            aria-label="문자 알림"
            aria-pressed={sms}
            disabled={busy}
            onClick={() => update("sms")}
          >
            <span />
          </button>
        </div>
      )}
      {mail === null && message && (
        <button className="b2" onClick={load}>
          알림 설정 다시 불러오기
        </button>
      )}
      {message && (
        <p role="status" className="fld__help">
          {message}
        </p>
      )}
    </section>
  );
}
