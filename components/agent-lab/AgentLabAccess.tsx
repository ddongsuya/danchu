"use client";

import { useEffect, useState, type FormEvent } from "react";

async function unlock(accessCode: string) {
  const response = await fetch("/api/agent-lab/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "초대 링크를 확인해 주세요.");
}

export function AgentLabAccess() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const accessCode = new URLSearchParams(window.location.hash.slice(1)).get("access");
    if (!accessCode) return;
    // The invitation stays out of access logs and referrers; remove it before posting.
    window.history.replaceState(null, "", window.location.pathname);
    void unlock(accessCode).then(() => window.location.reload()).catch(e => setError(e instanceof Error ? e.message : "초대 링크를 확인해 주세요."));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try { await unlock(code.trim()); window.location.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "연결을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <main className="al al-access"><section>
    <span className="al-brand">단추</span>
    <h1>에이전트 테스트에<br />참여해 주세요.</h1>
    <p>의뢰자와 기관의 업무 흐름을 예시 데이터로 확인하는 초대 전용 공간입니다.</p>
    <form onSubmit={submit}>
      <label htmlFor="lab-access-code">테스트 초대 코드</label>
      <input id="lab-access-code" type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} maxLength={43} disabled={busy} required />
      {error && <p className="al-access-error" role="alert">{error}</p>}
      <button className="al-primary" disabled={busy || !code.trim()}>{busy ? "초대를 확인하고 있어요" : "테스트 시작"}</button>
    </form>
    <p>초대 링크로 접속하면 자동으로 열립니다. API 키를 입력하는 칸이 아닙니다.</p>
  </section></main>;
}
