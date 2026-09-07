"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark } from "@/components/app/ui";

/**
 * 로그인 화면.
 * - 이메일 매직링크는 계정 연동(Supabase Auth) 전이라 안내만 둔다.
 * - 데모 화면군(/app)은 운영자가 나눠 준 비밀번호로 연다 (APP_DEMO_PASSWORD).
 */
export default function Login() {
  return (
    <Suspense fallback={<div className="scr scr--sf" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");
  const dest = next && next.startsWith("/app") ? next : "/app";
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const enter = async () => {
    if (!pw || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "열 수 없습니다.");
      router.push(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "열 수 없습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="scr scr--sf">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "calc(var(--top) + 40px) 24px 0", gap: 28 }}>
        <div style={{ filter: "drop-shadow(0 20px 40px rgba(26,25,25,.12))" }}>
          <Mark size={120} shadow={false} />
        </div>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>단추</div>
          <div style={{ fontSize: 15, color: "var(--muted)" }}>비임상 시험 견적, 한번 요청하고 한눈에 비교</div>
        </div>
      </div>

      <div style={{ padding: "0 20px calc(40px + var(--bot))", display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="fld__lab" htmlFor="pw">데모 비밀번호</label>
        <input
          id="pw"
          className="inp"
          type="password"
          autoComplete="off"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
          placeholder="운영자에게 받은 비밀번호"
        />
        {error && (
          <p role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: "var(--err-bg)", color: "var(--err)", fontSize: 14 }}>
            {error}
          </p>
        )}
        <button type="button" className="b1" onClick={enter} disabled={!pw || busy}>
          {busy ? "확인 중…" : "데모 화면 열기"}
        </button>
        <p style={{ marginTop: 4, textAlign: "center", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          이 화면군은 예시 데이터로 구성된 데모입니다. 이메일 로그인은 계정 기능과 함께 제공됩니다.
          <br />
          견적 요청은 <Link href="/rfq">웹 양식</Link>에서 바로 할 수 있어요.
        </p>
        <p style={{ marginTop: 6, textAlign: "center", fontSize: 12, color: "var(--ph)" }}>
          계속하면 <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>에 동의합니다
        </p>
      </div>
    </div>
  );
}
