"use client";
import { useEffect, useRef, useState } from "react";
import type { GuestContact } from "@/components/app/AppState";
import type { Values } from "@/lib/rfq-schema";
import { uploadToSigned, type UploadTicket } from "@/lib/upload";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER = 60;

type Uploads = { total: number; done: number; failed: string[]; running: boolean };

/**
 * 로그인 전 요청서의 "보내기". 화면을 떠나지 않고:
 * 1) 이메일·회사명·담당자 성명 → 인증번호 받기 (요청서를 서버에 맡기고, 첨부는 번호를 기다리는 동안 올린다)
 * 2) 메일로 받은 번호 입력 → 계정 확인과 접수가 한 번에 끝난다
 * 메일의 버튼을 눌러 다른 탭에서 접수가 끝나도 이 창이 알아채고 완료 화면으로 넘어간다.
 */
export function GuestVerify({
  open,
  values,
  files,
  contact,
  onContact,
  token,
  onToken,
  onClose,
  onDone,
}: {
  /** 닫아도 상태(번호 단계, 첨부 업로드)는 남는다. 다시 열면 이어진다 */
  open: boolean;
  values: Values;
  files: File[];
  contact: GuestContact;
  onContact: (c: GuestContact) => void;
  /** 이미 번호를 받아 둔 요청서 (내용이 그대로일 때만) */
  token?: string;
  onToken: (t: string) => void;
  onClose: () => void;
  onDone: (rfqNo: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"contact" | "code">(token ? "code" : "contact");
  const [c, setC] = useState<GuestContact>(contact);
  const [code, setCode] = useState("");
  const [codeLength, setCodeLength] = useState(6);
  const [busy, setBusy] = useState<"" | "send" | "verify" | "resend">("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(token ? 0 : RESEND_AFTER);
  const [uploads, setUploads] = useState<Uploads>({ total: 0, done: 0, failed: [], running: false });
  const uploading = useRef<Promise<void> | null>(null);
  const tokenRef = useRef(token);
  const doneRef = useRef(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => () => dialog.current?.close(), []);
  // 다시 열었을 때 받아 둔 번호가 지금 요청서와 맞지 않으면(요청서를 고친 경우) 처음부터
  useEffect(() => {
    if (open && !token && step === "code") {
      tokenRef.current = undefined;
      setStep("contact");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);
  useEffect(() => {
    if (open && step === "code") codeInput.current?.focus();
  }, [open, step]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const finish = (no: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(no);
  };

  // 메일 버튼으로 다른 탭에서 접수가 끝났는지 몇 초마다 확인한다
  useEffect(() => {
    if (step !== "code" || !open) return;
    const t = setInterval(async () => {
      const tk = tokenRef.current;
      if (!tk || busy === "verify") return;
      const r = await fetch(`/api/rfq/pending/status?token=${encodeURIComponent(tk)}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r?.claimed && r.rfqNo) finish(r.rfqNo);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, busy, open]);

  const startUploads = (tickets: UploadTicket[]) => {
    if (!files.length) return;
    setUploads({ total: files.length, done: 0, failed: [], running: true });
    uploading.current = (async () => {
      const failed: string[] = [];
      const sent = new Set<number>();
      for (const t of tickets) {
        // 서버는 첨부 순서를 경로 앞에 붙인다 (같은 이름의 파일이 둘이어도 구분된다)
        const i = Number(/\/(\d+)-[^/]*$/.exec(t.path)?.[1] ?? -1);
        const f = files[i];
        if (!f) continue;
        sent.add(i);
        const ok = await uploadToSigned(t, f).catch(() => false);
        if (!ok) failed.push(f.name);
        setUploads((u) => ({ ...u, done: u.done + 1, failed: ok ? u.failed : [...u.failed, f.name] }));
      }
      files.forEach((f, i) => {
        if (!sent.has(i)) failed.push(f.name);
      });
      setUploads((u) => ({ ...u, running: false, failed: [...new Set([...u.failed, ...failed])] }));
    })();
  };

  const sendCode = async () => {
    if (busy) return;
    const next = { email: c.email.trim().toLowerCase(), company: c.company.trim(), name: c.name.trim(), phone: c.phone.trim() };
    if (!EMAIL_RE.test(next.email)) return setError("이메일 형식을 확인해 주세요.");
    if (!next.company || !next.name) return setError("회사·기관명과 담당자 성명을 입력해 주세요.");
    onContact(next);
    setBusy("send");
    setError("");
    try {
      const r = await fetch("/api/rfq/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { ...values, ...next }, files: files.map(({ name, size, type }) => ({ name, size, type })) }),
      });
      const d = (await r.json().catch(() => ({}))) as { token?: string; uploads?: UploadTicket[]; mailed?: boolean; codeLength?: number; error?: string };
      if (!r.ok || !d.token) throw new Error(d.error || "인증번호를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
      tokenRef.current = d.token;
      onToken(d.token);
      setCodeLength(d.codeLength || 6);
      setCode("");
      setResendIn(RESEND_AFTER);
      setStep("code");
      if (!d.mailed) setError("메일을 보내지 못했습니다. 잠시 뒤 '다시 받기'를 눌러 주세요.");
      startUploads(d.uploads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const verify = async (value: string) => {
    const tk = tokenRef.current;
    if (!tk || busy) return;
    setBusy("verify");
    setError("");
    try {
      // 첨부가 다 올라간 뒤에 접수해야 기관이 첨부까지 함께 받는다
      if (uploading.current) await uploading.current;
      const r = await fetch("/api/rfq/pending/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tk, code: value }) });
      const d = (await r.json().catch(() => ({}))) as { rfqNo?: string; error?: string; resend?: boolean };
      if (!r.ok || !d.rfqNo) {
        setCode("");
        if (d.resend) setResendIn(0);
        throw new Error(d.error || "확인하지 못했습니다. 다시 시도해 주세요.");
      }
      finish(d.rfqNo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "확인하지 못했습니다.");
      setBusy("");
      codeInput.current?.focus();
    }
  };

  const resend = async () => {
    const tk = tokenRef.current;
    if (!tk || busy || resendIn > 0) return;
    setBusy("resend");
    setError("");
    try {
      const r = await fetch("/api/rfq/pending/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tk }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; rfqNo?: string; codeLength?: number };
      if (d.rfqNo) return finish(d.rfqNo);
      if (!r.ok) throw new Error(d.error || "다시 보내지 못했습니다.");
      setCodeLength(d.codeLength || 6);
      setCode("");
      setResendIn(RESEND_AFTER);
      codeInput.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 보내지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const mmss = `${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, "0")}`;
  const field = (id: keyof GuestContact, label: string, type: string, auto: string, required = true) => (
    <div className="field">
      <label className="field__label" htmlFor={`gv-${id}`}>
        {label}
        {required ? <span className="field__req">*</span> : <span className="fld__help"> 선택</span>}
      </label>
      <input
        id={`gv-${id}`}
        className="input"
        type={type}
        autoComplete={auto}
        value={c[id]}
        disabled={!!busy}
        onChange={(e) => {
          setC((o) => ({ ...o, [id]: e.target.value }));
          setError("");
        }}
      />
    </div>
  );

  return (
    <dialog
      ref={dialog}
      className="gv"
      aria-labelledby="gv-title"
      onCancel={(e) => {
        e.preventDefault();
        if (busy !== "verify") onClose();
      }}
    >
      <div className="gv__bar">
        <button type="button" className="btxt" onClick={onClose} disabled={busy === "verify"}>
          취소
        </button>
        <b>{step === "contact" ? "이메일 확인" : "인증번호"}</b>
        <span aria-hidden="true" />
      </div>

      {step === "contact" ? (
        <form
          className="gv__body"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <h2 id="gv-title">보내기 전에 이메일만 확인하겠습니다.</h2>
          <p className="gv__lead">쓰신 요청서는 이 화면에 그대로 둡니다. 확인이 끝나면 바로 접수됩니다.</p>
          {field("email", "이메일", "email", "email")}
          {field("company", "회사·기관명", "text", "organization")}
          {field("name", "담당자 성명", "text", "name")}
          {field("phone", "휴대전화", "tel", "tel", false)}
          {error && (
            <p className="note note--err" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="b1 blg bfull" disabled={!!busy}>
            {busy === "send" ? "보내는 중…" : "인증번호 받기"}
          </button>
          <p className="fld__help gv__center">이미 가입하셨다면 같은 이메일로 인증하면 됩니다.</p>
        </form>
      ) : (
        <form
          className="gv__body"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length >= 6) verify(code);
          }}
        >
          <h2 id="gv-title">메일로 보낸 {codeLength}자리를 입력해 주세요.</h2>
          <p className="gv__lead">{contact.email || c.email}로 보냈습니다.</p>
          <label className="sr-only" htmlFor="gv-code">
            인증번호
          </label>
          <input
            id="gv-code"
            ref={codeInput}
            className="input input--big gv__code tnum"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={codeLength}
            value={code}
            disabled={busy === "verify"}
            aria-describedby="gv-code-help"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, codeLength);
              setCode(v);
              setError("");
              if (v.length === codeLength) verify(v);
            }}
          />
          <p id="gv-code-help" className="fld__help">
            메일 속 버튼을 눌러도 이 화면이 그대로 이어집니다. 확인이 끝나면 쓰신 요청서가 바로 접수됩니다.
          </p>
          {uploads.total > 0 && (
            <p className="fld__help" role="status">
              {uploads.running
                ? `첨부 ${uploads.total}개를 올리는 중입니다 (${uploads.done}/${uploads.total}).`
                : uploads.failed.length
                  ? `첨부 ${uploads.failed.length}개를 올리지 못했습니다. 접수한 뒤 요청 화면에서 다시 올릴 수 있습니다.`
                  : `첨부 ${uploads.total}개를 올렸습니다.`}
            </p>
          )}
          {error && (
            <p className="note note--err" role="alert">
              {error}
            </p>
          )}
          {busy === "verify" && (
            <p className="fld__help" role="status">
              {uploads.running ? "첨부를 마저 올린 뒤 접수합니다…" : "확인하고 접수하는 중입니다…"}
            </p>
          )}
          <div className="gv__row">
            {resendIn > 0 ? (
              <span className="fld__help tnum">다시 받기 {mmss}</span>
            ) : (
              <button type="button" className="btxt" onClick={resend} disabled={!!busy}>
                {busy === "resend" ? "보내는 중…" : "번호 다시 받기"}
              </button>
            )}
            <button
              type="button"
              className="btxt"
              disabled={busy === "verify"}
              onClick={() => {
                setStep("contact");
                setError("");
              }}
            >
              이메일 바꾸기
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
