"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className = "btxt", style }: { className?: string; style?: React.CSSProperties }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      style={{ alignSelf: "flex-start", padding: "6px 0", ...style }}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        router.push("/login");
        router.refresh();
      }}
    >
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
