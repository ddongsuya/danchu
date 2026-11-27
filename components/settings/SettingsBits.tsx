"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppState";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { notiFailText } from "@/lib/settings";

/** 테마 한 줄 (시안 r-set-general · c-set-profile 화면). 바꾸면 "테마를 바꿨어요" 토스트 */
export function ThemeRow() {
  const { theme, setTheme } = useApp();
  const toast = useToast();
  return (
    <div className="set-row">
      <label htmlFor="set-theme">테마</label>
      <select
        id="set-theme"
        className="set-sel"
        value={theme}
        onChange={(e) => {
          setTheme(e.target.value as typeof theme);
          toast("테마를 바꿨어요");
        }}
      >
        <option value="system">시스템</option>
        <option value="light">밝게</option>
        <option value="dark">어둡게</option>
      </select>
    </div>
  );
}

type Key = "email" | "sms";
type Noti = { email: boolean; sms: boolean | null; hasPhone: boolean };

async function fetchNoti(): Promise<Noti> {
  const r = await fetch("/api/settings");
  if (!r.ok) throw new Error("알림 설정을 불러오지 못했어요.");
  const d = (await r.json()) as { email: boolean; sms: boolean | null; hasPhone?: boolean };
  return { email: d.email, sms: typeof d.sms === "boolean" ? d.sms : null, hasPhone: !!d.hasPhone };
}

/**
 * 알림 켜고 끄기 (시안 r-set-noti · c-set-noti). 코드에 있는 두 가지(이메일, 문자)만.
 * 저장하지 못하면 스위치는 원래대로 두고 그 자리에 이유와 "다시 저장"을 보인다.
 */
export function NotiSettings({ emailLabel, initial }: { emailLabel: string; initial?: { email: boolean; sms: boolean | null; hasPhone: boolean } }) {
  const [v, setV] = useState<{ email: boolean; sms: boolean | null; hasPhone: boolean } | null>(initial ?? null);
  const [loadFail, setLoadFail] = useState(false);
  const [fail, setFail] = useState<{ key: Key; to: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const label: Record<Key, string> = { email: emailLabel, sms: "문자 알림" };

  const load = () => fetchNoti().then(setV, () => setLoadFail(true));
  useEffect(() => {
    if (!initial) fetchNoti().then(setV, () => setLoadFail(true));
  }, [initial]);

  const save = async (key: Key, to: boolean) => {
    if (busy || !v) return;
    setBusy(true);
    setFail(null);
    try {
      const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: to }) });
      if (!r.ok) throw new Error();
      setV({ ...v, [key]: to });
    } catch {
      setFail({ key, to });
    } finally {
      setBusy(false);
    }
  };

  if (loadFail) return <ErrorState title="알림 설정을 불러오지 못했어요" onRetry={() => { setLoadFail(false); return load(); }} />;
  const toggle = (key: Key, on: boolean | null) =>
    on === null ? null : (
      <div className="set-row" key={key}>
        <span>
          {label[key]}
          {key === "sms" && v && !v.hasPhone && <small>휴대전화를 적으면 받을 수 있어요.</small>}
        </span>
        <button type="button" className="tgl" aria-label={label[key]} aria-pressed={on} disabled={busy} onClick={() => save(key, !on)}>
          <span />
        </button>
      </div>
    );
  return (
    <div className="set-rows" aria-busy={!v || undefined}>
      {!v ? (
        <div className="set-row"><span className="set-skl" aria-hidden="true" /><span className="sr-only" role="status">알림 설정을 불러오는 중</span></div>
      ) : (
        <>
          {toggle("email", v.email)}
          {toggle("sms", v.sms)}
        </>
      )}
      {fail && (
        <div className="note note--err set-ban" role="alert">
          <span>{notiFailText(label[fail.key], fail.to)}</span>
          <Button className="b2 bsm" onClick={() => save(fail.key, fail.to)}>다시 저장</Button>
        </div>
      )}
    </div>
  );
}
