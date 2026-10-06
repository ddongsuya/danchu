"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppState";
export function ThemeSettings() {
  const { theme, setTheme } = useApp();
  const [mail, setMail] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error("알림 설정을 불러오지 못했습니다.");
      const d = await r.json();
      setMail(d.email);
      setMessage("");
    } catch {
      setMessage("알림 설정을 불러오지 못했습니다.");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const update = async () => {
    if (mail === null || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: !mail }),
      });
      if (!r.ok) throw new Error();
      setMail(!mail);
      setMessage("알림 설정을 저장했습니다.");
    } catch {
      setMessage("저장하지 못했습니다. 다시 눌러 시도해 주세요.");
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
            견적 도착과 진행 상황을 메일로 받습니다. 앱 안의 알림, 접수 확인,
            로그인 메일은 계속 받을 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="tgl"
          aria-label="진행 상황 이메일"
          aria-pressed={mail ?? false}
          disabled={mail === null || busy}
          onClick={update}
        >
          <span />
        </button>
      </div>
      {mail === null && (
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
