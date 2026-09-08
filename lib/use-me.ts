"use client";

import { useEffect, useState } from "react";

export type Me = { role: "requester" | "cro" | "admin"; to: string; name: string | null; email: string } | null;

let cached: Promise<Me> | null = null;

/** 현재 로그인 사용자 요약. 한 페이지 안에서는 한 번만 요청한다. */
export function fetchMe(): Promise<Me> {
  if (!cached) {
    cached = fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && d.ok ? (d as Me) : null))
      .catch(() => null);
  }
  return cached;
}

export function useMe(): { me: Me; loading: boolean } {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchMe().then((m) => {
      if (!alive) return;
      setMe(m);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { me, loading };
}
