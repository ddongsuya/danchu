"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 메모 지우기. 한 번 누르면 "지울까요?"로 바뀌고, 한 번 더 누르면 지운다 (브라우저 확인창 없이) */
export function NoteDelete({ id }: { id: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!ask) return setAsk(true);
    setBusy(true);
    const r = await fetch("/api/cro/notes", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    setBusy(false);
    setAsk(false);
    if (r?.ok) router.refresh();
  }
  return <button type="button" className="cl__del" onClick={go} onBlur={() => setAsk(false)} disabled={busy}>{busy ? "지우는 중" : ask ? "지울까요?" : "지우기"}</button>;
}
