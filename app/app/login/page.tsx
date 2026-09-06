"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckDisc, Mark } from "@/components/app/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const ok = EMAIL.test(email);

  const send = () => {
    if (!ok) return;
    // 매직링크 발송은 계정 연동(Supabase Auth)이 붙으면 여기서 호출한다.
    setSent(true);
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
        {!sent ? (
          <>
            <label className="fld__lab" htmlFor="email">업무용 이메일</label>
            <input
              id="email"
              className="inp"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="name@company.com"
            />
            <button type="button" className="b1" onClick={send} disabled={!ok}>
              로그인 링크 보내기
            </button>
            <p style={{ marginTop: 4, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
              비밀번호 없이 이메일로 받은 링크로 로그인합니다. 처음이면 계정이 자동으로 만들어집니다.
            </p>
          </>
        ) : (
          <div className="card rise-in" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <CheckDisc size={44} />
            <div style={{ fontSize: 18, fontWeight: 700 }}>링크를 보냈습니다</div>
            <div style={{ fontSize: 14, color: "var(--body)" }}>
              <b style={{ fontWeight: 600 }}>{email}</b>의 받은편지함을 확인해 주세요. 링크는 15분간 유효합니다.
            </div>
            <button type="button" className="btxt" style={{ marginTop: 6 }} onClick={() => setSent(false)}>
              다른 이메일로 받기
            </button>
            <button type="button" className="b1" style={{ marginTop: 8 }} onClick={() => router.push("/app")}>
              데모 계정으로 둘러보기
            </button>
          </div>
        )}
        <p style={{ marginTop: 6, textAlign: "center", fontSize: 12, color: "var(--ph)" }}>
          계속하면 <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>에 동의합니다
        </p>
      </div>
    </div>
  );
}
