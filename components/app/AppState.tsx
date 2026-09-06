"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Settings = { theme: "light" | "dark" | "system"; push: boolean; mail: boolean };
type Ctx = Settings & {
  dark: boolean;
  setTheme: (t: Settings["theme"]) => void;
  toggleDark: () => void;
  setFlag: (k: "push" | "mail", v: boolean) => void;
};

const KEY = "danchu.app.settings";
const AppCtx = createContext<Ctx | null>(null);

function read(): Settings {
  if (typeof window === "undefined") return { theme: "system", push: true, mail: true };
  try {
    return { theme: "system", push: true, mail: true, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { theme: "system", push: true, mail: true };
  }
}

/** 앱 전역 설정(테마·알림). 값은 이 기기에만 저장된다. */
export function AppState({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Settings>({ theme: "system", push: true, mail: true });
  const [sysDark, setSysDark] = useState(false);

  useEffect(() => {
    setS(read());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSysDark(mq.matches);
    const on = () => setSysDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const dark = s.theme === "dark" || (s.theme === "system" && sysDark);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [dark]);

  const save = useCallback((next: Settings) => {
    setS(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* 시크릿 모드 등에서는 저장하지 않고 넘어간다 */
    }
  }, []);

  const value: Ctx = {
    ...s,
    dark,
    setTheme: (theme) => save({ ...s, theme }),
    toggleDark: () => save({ ...s, theme: dark ? "light" : "dark" }),
    setFlag: (k, v) => save({ ...s, [k]: v }),
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppState");
  return c;
}

/* ── 위자드 임시 저장 ────────────────────────────────
   문항 단위로 즉시 저장하고, 재진입 시 마지막 문항으로 돌아간다. */

const DRAFT = "danchu.app.rfqDraft";
export type Draft = { q: number; values: Record<string, string | string[] | boolean> };

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT, JSON.stringify(d));
  } catch {
    /* 무시 */
  }
}
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT);
  } catch {
    /* 무시 */
  }
}
