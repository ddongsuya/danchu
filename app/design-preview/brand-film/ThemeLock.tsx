"use client";

import { useEffect } from "react";

/** 검토용: html[data-theme]를 쿼리 값으로 고정하고, 떠날 때 원래 값으로 돌린다. */
export function ThemeLock({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.dataset.theme;
    html.dataset.theme = theme;
    return () => { if (prev) html.dataset.theme = prev; else delete html.dataset.theme; };
  }, [theme]);
  return null;
}
