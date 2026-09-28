"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { REQUEST_HREF } from "@/components/RfqLink";

/**
 * 히어로·마지막 CTA의 이메일 시작 폼.
 * 로그인한 의뢰자는 바로 위자드로, 그 외에는 이메일을 가입 화면에 미리 채워 보낸다.
 * (가입 화면이 ?email= 을 읽어 초기값으로 쓴다 — components/auth/SignupView.tsx)
 */
export function EmailStart({ tone = "light", id = "start" }: { tone?: "light" | "onColor"; id?: string }) {
  const { me, loading } = useMe();
  const router = useRouter();
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading && me) {
      router.push(me.role === "requester" ? REQUEST_HREF : me.to);
      return;
    }
    const q = new URLSearchParams({ next: REQUEST_HREF });
    if (email.trim()) q.set("email", email.trim());
    router.push(`/signup?${q}`);
  };

  return (
    <form className={`lp-start lp-start--${tone}`} onSubmit={submit}>
      <label htmlFor={id} className="sr-only">
        업무용 이메일 주소
      </label>
      <input
        id={id}
        type="email"
        name="email"
        autoComplete="email"
        placeholder="업무용 이메일 주소"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="lp-start__input"
      />
      <button type="submit" className="lp-start__btn">
        무료로 견적 요청
      </button>
    </form>
  );
}
