"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="b2 bsm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
        router.refresh();
        setBusy(false);
      }}
    >
      모두 읽음
    </button>
  );
}
