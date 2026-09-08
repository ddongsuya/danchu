"use client";

import { useState } from "react";
import Link from "next/link";
import { Done, ErrorBox, Field, PasswordInput, TextInput, postJson } from "@/components/AuthBits";
import { CATS } from "@/lib/rfq-schema";

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

export default function SignupCro() {
  const [f, setF] = useState({ orgName: "", businessNo: "", website: "", address: "", name: "", email: "", phone: "", password: "", otherCerts: "", intro: "" });
  const [glp, setGlp] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [aaalac, setAaalac] = useState<boolean | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ joined: boolean } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (list: string[], setList: (v: string[]) => void, v: string) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const ok = f.orgName && f.name && f.email && f.password.length >= 8 && cats.length > 0 && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await postJson<{ joined: boolean }>("/api/auth/signup-cro", {
        email: f.email, password: f.password, name: f.name, phone: f.phone,
        org: { name: f.orgName, businessNo: f.businessNo, website: f.website, address: f.address, contactPhone: f.phone, glpCerts: glp, aaalac, otherCerts: f.otherCerts, categories: cats, intro: f.intro },
      });
      setDone({ joined: d.joined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth__card">
        <Done title="가입 신청을 받았습니다">
          <p>
            <b>{f.email}</b>로 보낸 확인 메일의 버튼을 눌러 이메일을 확인해 주세요.
          </p>
          <p className="auth__note" style={{ textAlign: "left" }}>
            {done.joined
              ? "이미 등록된 기관이라 담당자 추가로 접수되었습니다. 운영자가 확인 후 연결해 드립니다."
              : "운영자가 기관 정보를 확인한 뒤 승인합니다. 보통 영업일 1~2일 안에 결과를 메일로 알려 드립니다."}{" "}
            승인 전에도 로그인해서 신청 내용을 볼 수 있습니다.
          </p>
        </Done>
      </div>
    );
  }

  return (
    <div className="auth__card auth__card--wide">
      <div>
        <h1 className="auth__title">CRO 가입 신청</h1>
        <p className="auth__sub">참여 기관으로 등록되면 요청서가 배포되고, 단추 표준 양식으로 견적을 회신할 수 있습니다.</p>
      </div>

      <form className="auth__form" onSubmit={submit}>
        <div className="auth__section" style={{ borderTop: 0, paddingTop: 0, margin: 0 }}>기관 정보</div>
        <div className="auth__grid">
          <Field id="orgName" label="기관명" required>
            <TextInput id="orgName" value={f.orgName} onChange={set("orgName")} placeholder="○○바이오 안전성평가연구소" autoComplete="organization" autoFocus />
          </Field>
          <Field id="businessNo" label="사업자등록번호">
            <TextInput id="businessNo" value={f.businessNo} onChange={set("businessNo")} placeholder="000-00-00000" inputMode="numeric" />
          </Field>
          <Field id="website" label="웹사이트">
            <TextInput id="website" type="url" value={f.website} onChange={set("website")} placeholder="https://" autoComplete="url" />
          </Field>
          <Field id="address" label="시험시설 소재지">
            <TextInput id="address" value={f.address} onChange={set("address")} placeholder="시·군·구까지" />
          </Field>
        </div>

        <Field id="glp" label="보유 GLP 인증" help="회신할 때 자동으로 채워지고, 제출처 대응 여부 판정에 쓰입니다.">
          <div className="chipset" role="group" aria-label="보유 GLP 인증">
            {GLP_OPTS.map((o) => (
              <button key={o} type="button" className="chip" aria-pressed={glp.includes(o)} onClick={() => toggle(glp, setGlp, o)}>{o}</button>
            ))}
          </div>
        </Field>
        <div className="auth__grid">
          <Field id="aaalac" label="AAALAC 인증">
            <div className="segmented" role="group" aria-label="AAALAC">
              {[["예", true], ["아니오", false]].map(([l, v]) => (
                <button key={String(l)} type="button" aria-pressed={aaalac === v} onClick={() => setAaalac(v as boolean)}>{l as string}</button>
              ))}
            </div>
          </Field>
          <Field id="otherCerts" label="기타 인증·지정">
            <TextInput id="otherCerts" value={f.otherCerts} onChange={set("otherCerts")} placeholder="KOLAS, ISO 17025 등" />
          </Field>
        </div>
        <Field id="cats" label="수행 가능 시험 분야" required help="선택한 분야의 요청서만 배포됩니다.">
          <div className="chipset" role="group" aria-label="수행 가능 시험 분야">
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
          <Field id="name" label="담당자 성명" required>
            <TextInput id="name" value={f.name} onChange={set("name")} placeholder="홍길동" autoComplete="name" />
          </Field>
          <Field id="phone" label="연락처">
            <TextInput id="phone" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="010-0000-0000" autoComplete="tel" />
          </Field>
          <Field id="email" label="업무용 이메일" required help="기관 도메인 이메일을 권장합니다.">
            <TextInput id="email" type="email" inputMode="email" value={f.email} onChange={set("email")} placeholder="name@cro.co.kr" autoComplete="email" />
          </Field>
          <Field id="password" label="비밀번호" required>
            <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
          </Field>
        </div>

        <label className={`chk${agree ? " chk--on" : ""}`}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>과{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a>에 동의하며, 비교표는 의뢰자에게만 전달되고 타사 견적을 열람할 수 없음을 확인합니다.
            <span className="field__req">*</span>
          </span>
        </label>

        <ErrorBox>{error}</ErrorBox>
        <button type="submit" className="btn--next" disabled={!ok || busy}>
          {busy ? "신청 중…" : "가입 신청"}
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
