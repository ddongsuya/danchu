"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Done, ErrorBox, Field, PasswordInput, TextInput, postJson } from "@/components/AuthBits";
import { CONTACT } from "@/lib/rfq-schema";
import { Chevron } from "@/components/Chevron";

const ORG_TYPES = CONTACT.find((f) => f.id === "orgType")?.options ?? [];

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="auth__card" />}>
      <Signup />
    </Suspense>
  );
}

function Signup() {
  const sp = useSearchParams();
  const next = sp.get("next") || "";
  const [f, setF] = useState({ company: "", name: "", dept: "", email: sp.get("email") || "", phone: "", orgType: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [usePw, setUsePw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const ok = f.company && f.name && f.email && (!usePw || f.password.length >= 8) && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/signup", { ...f, password: usePw ? f.password : "", next });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth__card">
        <Done title="확인 메일을 보냈습니다">
          <p>
            <b>{f.email}</b>로 보낸 메일의 버튼을 누르면 가입이 완료되고 {next === "/app/new" ? "바로 견적 요청 화면이 열립니다" : "바로 로그인됩니다"}.
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>휴대폰에서 쓰시려면 휴대폰의 메일 앱에서 버튼을 누르세요. 링크를 누른 기기에서 로그인됩니다.</p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>메일이 오지 않으면 스팸함을 확인해 주세요. 이 주소로 이미 접수한 견적 요청이 있다면 로그인 후 자동으로 연결됩니다.</p>
        </Done>
      </div>
    );
  }

  return (
    <div className="auth__card auth__card--wide">
      <div>
        <h1 className="auth__title">{next === "/app/new" ? "견적 요청 전에 계정을 만들어 주세요" : "의뢰자 가입"}</h1>
        <p className="auth__sub">30초면 됩니다. 요청 진행 상황, 도착한 견적, 비교표를 한곳에서 볼 수 있고 비용은 없습니다.</p>
      </div>

      <form className="auth__form" onSubmit={submit}>
        <div className="auth__grid">
          <Field id="company" label="회사·기관명" required>
            <TextInput id="company" value={f.company} onChange={set("company")} placeholder="(주)바이오벤처" autoComplete="organization" autoFocus />
          </Field>
          <Field id="orgType" label="기관 유형">
            <div className="select-wrap">
              <select id="orgType" className="select" value={f.orgType} onChange={set("orgType")}>
                <option value="">선택</option>
                {ORG_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <Chevron size={16} className="" />
            </div>
          </Field>
          <Field id="name" label="담당자 성명" required>
            <TextInput id="name" value={f.name} onChange={set("name")} placeholder="홍길동" autoComplete="name" />
          </Field>
          <Field id="dept" label="부서·직위">
            <TextInput id="dept" value={f.dept} onChange={set("dept")} placeholder="개발팀 · 팀장" autoComplete="organization-title" />
          </Field>
          <Field id="email" label="업무용 이메일" required help="견적·비교표 알림이 이 주소로 갑니다.">
            <TextInput id="email" type="email" inputMode="email" value={f.email} onChange={set("email")} placeholder="name@company.com" autoComplete="email" />
          </Field>
          <Field id="phone" label="휴대전화">
            <TextInput id="phone" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="010-0000-0000" autoComplete="tel" />
          </Field>
        </div>
        <div className="field">
          <span className="field__label">로그인 방법</span>
          <div className="auth__tabs" role="group" aria-label="로그인 방법">
            <button type="button" aria-pressed={!usePw} onClick={() => setUsePw(false)}>이메일 링크만 (비밀번호 없음)</button>
            <button type="button" aria-pressed={usePw} onClick={() => setUsePw(true)}>비밀번호도 설정</button>
          </div>
          <p className="field__help">
            {usePw ? "비밀번호와 이메일 링크 둘 다로 로그인할 수 있습니다." : "로그인할 때마다 이메일로 받은 링크를 누릅니다. 비밀번호는 나중에 프로필에서 정할 수 있어요."}
          </p>
        </div>
        {usePw && (
          <Field id="password" label="비밀번호" required help="8자 이상">
            <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
          </Field>
        )}

        <label className={`chk${agree ? " chk--on" : ""}`}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>과{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a>에 동의합니다.
            <span className="field__req">*</span>
          </span>
        </label>

        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={!ok || busy}>
          {busy ? "만드는 중…" : "가입하고 확인 메일 받기"}
        </button>
      </form>

      <div className="auth__links">
        <span>
          이미 계정이 있나요? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>로그인</Link>
        </span>
        <span>
          시험기관(CRO)이라면 <Link href="/signup/cro">CRO 가입 신청</Link>
        </span>
      </div>
    </div>
  );
}
