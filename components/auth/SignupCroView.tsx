"use client";

import { useState } from "react";
import Link from "next/link";
import { Done, ErrorBox, Field, PasswordInput, TextInput, emailError, errStatus, postJson } from "@/components/AuthBits";
import { CATS } from "@/lib/rfq-schema";
import { allConsented, ConsentChecks, type ConsentItem } from "./ConsentChecks";

/** 가입 동의: 항목마다 따로 받는다 */
const CONSENTS: ConsentItem[] = [
  { id: "terms", label: <><a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>과 <a href="/terms/cro" target="_blank" rel="noopener noreferrer">기관 이용약관</a>에 동의합니다.</> },
  { id: "privacy", label: <><a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 수집·이용</a>에 동의합니다.</> },
  { id: "compare", label: "비교표는 의뢰자에게만 전달되고, 다른 기관의 견적은 볼 수 없다는 점을 확인합니다." },
];

export type CroSignupErrors = Partial<Record<"orgName" | "businessNo" | "cats" | "name" | "email" | "password" | "consent", string>>;

/** 기관 참여 신청 칸 검사 (시안 l-signup-cro~ferr). 사업자등록번호는 선택이지만 쓰면 10자리 */
export function croSignupErrors(f: { orgName: string; businessNo: string; name: string; email: string; password: string }, cats: string[], consented: boolean): CroSignupErrors {
  const e: CroSignupErrors = {};
  if (!f.orgName.trim()) e.orgName = "기관명을 입력해 주세요.";
  if (f.businessNo.trim() && f.businessNo.replace(/\D/g, "").length !== 10) e.businessNo = "사업자등록번호 10자리를 입력해 주세요.";
  if (!cats.length) e.cats = "수행 분야를 하나 이상 골라 주세요.";
  if (!f.name.trim()) e.name = "담당자 성명을 입력해 주세요.";
  const em = emailError(f.email);
  if (em) e.email = em;
  if (f.password.length < 8) e.password = "비밀번호는 8자 이상이어야 해요.";
  if (!consented) e.consent = "필수 약관에 동의해 주세요.";
  return e;
}

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

export function SignupCroView() {
  const [f, setF] = useState({ orgName: "", businessNo: "", website: "", address: "", name: "", email: "", phone: "", password: "", otherCerts: "", intro: "" });
  const [glp, setGlp] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [aaalac, setAaalac] = useState<boolean | null>(null);
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ joined: boolean; mailed: boolean } | null>(null);
  const [errs, setErrs] = useState<CroSignupErrors>({});
  const [dup, setDup] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (list: string[], setList: (v: string[]) => void, v: string) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const found = croSignupErrors(f, cats, allConsented(CONSENTS, agree));
    setErrs(found);
    setDup("");
    const first = (["orgName", "businessNo", "name", "email", "password"] as const).find((k) => found[k]);
    if (Object.keys(found).length) { if (first) document.getElementById(first)?.focus(); return; }
    setBusy(true);
    setError("");
    try {
      const d = await postJson<{ joined: boolean; mailed: boolean }>("/api/auth/signup-cro", {
        email: f.email, password: f.password, name: f.name, phone: f.phone,
        org: { name: f.orgName, businessNo: f.businessNo, website: f.website, address: f.address, contactPhone: f.phone, glpCerts: glp, aaalac, otherCerts: f.otherCerts, categories: cats, intro: f.intro },
      });
      setDone({ joined: d.joined, mailed: d.mailed });
    } catch (err) {
      const text = err instanceof Error ? err.message : "신청하지 못했어요.";
      if (errStatus(err) === 409) setDup(text);
      else setError(text);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth__card">
        <Done title="기관 참여 신청을 보냈어요">
          <p>{done.joined ? "이미 등록된 기관이라 담당자 추가로 접수됐어요. 운영자가 확인하면 업무용 이메일로 알려요." : "운영자가 승인하면 업무용 이메일로 알려요."}</p>
          <p className="auth__note" style={{ textAlign: "left" }}>
            {done.mailed ? <><b>{f.email}</b>로 보낸 확인 메일의 버튼을 눌러 주세요.</> : <><b>{f.email}</b>로 확인 메일을 보내지 못했어요.</>}
          </p>
          <Link href="/login" className="btn--next" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>로그인</Link>
          <button type="button" className="btn--ghost" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await postJson("/api/auth/magic", { email: f.email }); setDone({ ...done, mailed: true }); } catch (e) { setError(e instanceof Error ? e.message : "메일을 보내지 못했어요."); } finally { setBusy(false); } }}>{busy ? "보내는 중…" : "확인 메일 다시 받기"}</button>
          <ErrorBox>{error}</ErrorBox>
        </Done>
      </div>
    );
  }

  return (
    <div className="auth__card auth__card--wide">
      <div>
        <h1 className="auth__title">기관 참여 신청</h1>
      </div>
      <nav className="auth__tabs" aria-label="가입 갈래">
        <Link href="/signup">의뢰자</Link>
        <Link href="/signup/cro" aria-current="page">기관</Link>
      </nav>
      {dup && <div className="auth__ban auth__ban--info" role="alert"><span>{dup}</span><Link href="/login">로그인</Link></div>}

      <form className="auth__form" onSubmit={submit} noValidate>
        <div className="auth__section" style={{ borderTop: 0, paddingTop: 0, margin: 0 }}>기관 정보</div>
        <div className="auth__grid">
          <Field id="orgName" label="기관명" required error={errs.orgName}>
            <TextInput id="orgName" aria-invalid={!!errs.orgName || undefined} value={f.orgName} onChange={set("orgName")} placeholder="○○바이오 안전성평가연구소" autoComplete="organization" autoFocus />
          </Field>
          <Field id="businessNo" label="사업자등록번호" error={errs.businessNo}>
            <TextInput id="businessNo" aria-invalid={!!errs.businessNo || undefined} value={f.businessNo} onChange={set("businessNo")} placeholder="000-00-00000" inputMode="numeric" />
          </Field>
          <Field id="website" label="웹사이트">
            <TextInput id="website" type="url" value={f.website} onChange={set("website")} placeholder="https://" autoComplete="url" />
          </Field>
          <Field id="address" label="소재지">
            <TextInput id="address" value={f.address} onChange={set("address")} placeholder="시·군·구까지" />
          </Field>
        </div>

        <Field id="glp" label="GLP 인증" help="의뢰자에게 공개돼요.">
          <div className="chipset" role="group" aria-label="GLP 인증">
            {GLP_OPTS.map((o) => (
              <button key={o} type="button" className="chip" aria-pressed={glp.includes(o)} onClick={() => toggle(glp, setGlp, o)}>{o}</button>
            ))}
          </div>
        </Field>
        <div className="auth__grid">
          <Field id="aaalac" label="AAALAC">
            <div className="segmented" role="group" aria-label="AAALAC">
              {[["있음", true], ["없음", false]].map(([l, v]) => (
                <button key={String(l)} type="button" aria-pressed={aaalac === v} onClick={() => setAaalac(v as boolean)}>{l as string}</button>
              ))}
            </div>
          </Field>
          <Field id="otherCerts" label="기타 인증·지정">
            <TextInput id="otherCerts" value={f.otherCerts} onChange={set("otherCerts")} placeholder="KOLAS, ISO 17025 등" />
          </Field>
        </div>
        <Field id="cats" label="수행 분야" required help="고른 분야의 요청서를 받아요." error={errs.cats}>
          <div className="chipset" role="group" aria-label="수행 분야">
            {CATS.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>{c}</button>
            ))}
          </div>
        </Field>
        <Field id="intro" label="기관 소개 (선택)">
          <textarea id="intro" className="textarea" rows={3} value={f.intro} onChange={set("intro")} placeholder="주요 시험 분야, 시설 규모, 대표 실적 등" />
        </Field>

        <div className="auth__section">담당자 계정</div>
        <div className="auth__grid">
          <Field id="name" label="담당자 성명" required error={errs.name}>
            <TextInput id="name" aria-invalid={!!errs.name || undefined} value={f.name} onChange={set("name")} autoComplete="name" />
          </Field>
          <Field id="phone" label="연락처">
            <TextInput id="phone" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="010-0000-0000" autoComplete="tel" />
          </Field>
          <Field id="email" label="업무용 이메일" required help="기관 도메인의 이메일을 써 주세요." error={errs.email}>
            <TextInput id="email" aria-invalid={!!errs.email || undefined} type="email" inputMode="email" value={f.email} onChange={set("email")} placeholder="name@cro.co.kr" autoComplete="email" />
          </Field>
          <Field id="password" label="비밀번호" required error={errs.password}>
            <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
          </Field>
        </div>

        <ConsentChecks items={CONSENTS} checked={agree} onChange={setAgree} />
        {errs.consent && <p className="field__err" role="alert">{errs.consent}</p>}

        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "신청하는 중" : "기관 참여 신청"}
        </button>
      </form>

      <div className="auth__links">
        <span>
          이미 계정이 있나요? <Link href="/login">로그인</Link>
        </span>
      </div>
    </div>
  );
}
