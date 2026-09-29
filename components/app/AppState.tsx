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

/* Account-scoped local drafts. Files are deliberately metadata only. */
export type Draft = {
  version: 2; q: number; phase: "edit" | "review"; updatedAt: string;
  values: Record<string, string | string[] | boolean | undefined>;
  files: { name: string; size: number }[];
  pendingNo?: string;
};
const draftKey = (userId: string) => `danchu.rfqDraft.v2.${userId}`;
export function loadDraft(userId: string): Draft | null {
  try {
    // Legacy drafts have no owner and must never transfer to another account.
    localStorage.removeItem("danchu.app.rfqDraft");
    const d = JSON.parse(localStorage.getItem(draftKey(userId)) || "null");
    if (!d || d.version !== 2 || !Number.isInteger(d.q) || d.q < 0 || d.q > 3 || !d.values || typeof d.values !== "object" || Array.isArray(d.values)) return null;
    if (!Object.values(d.values).every((v) => typeof v === "string" || typeof v === "boolean" || (Array.isArray(v) && v.every((x) => typeof x === "string")))) return null;
    return { ...d, files: Array.isArray(d.files) ? d.files.filter((f: { name?: unknown; size?: unknown }) => typeof f?.name === "string" && typeof f?.size === "number") : [], pendingNo: /^DC-\d{4}-\d{4,}$/.test(d.pendingNo || "") ? d.pendingNo : undefined };
  } catch { return null; }
}
export function saveDraft(userId: string, d: Draft): boolean {
  try { localStorage.setItem(draftKey(userId), JSON.stringify(d)); return true; }
  catch { return false; }
}
export function clearDraft(userId: string): boolean {
  try { localStorage.removeItem(draftKey(userId)); return true; }
  catch { return false; }
}
