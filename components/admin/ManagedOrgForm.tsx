"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATS } from "@/lib/rfq-schema";
import { GLP_OPTIONS } from "@/lib/concierge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LONG_ACTION_TIMEOUT_MS } from "@/components/ui/toast-queue";

const EMPTY = { name: "", contactEmail: "", contactName: "", contactPhone: "", businessNo: "", website: "", otherCerts: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 추가 전 칸 검사 (시안 a-cro-new~ferr). 첫 오류 한 줄만 돌려준다 */
export function managedOrgError(f: { name: string; contactEmail: string }, cats: string[]): string {
  if (!f.name.trim()) return "기관명을 입력해 주세요.";
  if (!EMAIL_RE.test(f.contactEmail.trim())) return "이메일 형식을 확인해 주세요.";
  if (!cats.length) return "수행 분야를 하나 이상 골라 주세요.";
  return "";
}

/**
 * 기관 추가 (운영자 관리, 시안 검토판 a-cro-new). 아직 가입하지 않은 기관을 운영자가 등록해 참여 안내를 보내고, 기관이 참여한 뒤 보낸 견적서 PDF 를 대신 입력한다.
 * 승인 메일 없이 바로 참여 중이 된다. 같은 기관(사업자번호·이름)이 있으면 서버가 만들지 않고(409) 그 기관을 알려 준다.
 */
export function ManagedOrgForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [cats, setCats] = useState<string[]>([]);
  const [glp, setGlp] = useState<string[]>([]);
  const [dup, setDup] = useState<{ id: string } | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (list: string[], setList: (v: string[]) => void, v: string) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    const bad = managedOrgError(f, cats);
    if (bad) throw new Error(bad);
    setDup(null);
    const fallback = "기관을 추가하지 못했어요. 입력한 내용은 그대로 있어요.";
    let r: Response;
    try {
      r = await fetch("/api/admin/cros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats, glpCerts: glp }), signal: AbortSignal.timeout(LONG_ACTION_TIMEOUT_MS) });
    } catch {
      throw new Error(fallback);
    }
    const d = (await r.json().catch(() => ({}))) as { error?: string; existingId?: string; id?: string };
    if (r.status === 409 && d.existingId) {
      setDup({ id: d.existingId });
      throw new Error((d.error ?? "").replace(/^이미 등록된 기관입니다: /, "같은 사업자등록번호의 기관이 있어요: ") || fallback);
    }
    if (!r.ok) throw new Error(d.error || fallback);
    setF(EMPTY);
    setCats([]);
    setGlp([]);
    router.refresh();
  };

  const fld = (id: string, label: string, k: keyof typeof EMPTY, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="fld"><label className="fld__lab" htmlFor={id}>{label}</label><input id={id} className="inp" value={f[k]} onChange={set(k)} {...extra} /></div>
  );

  return (
    <>
      <button type="button" className="b1 bsm" onClick={() => { setDup(null); setOpen(true); }}>기관 추가</button>
      <ConfirmDialog
        open={open}
        title="기관 추가 (운영자 관리)"
        body={
          <div className="stack" style={{ gap: 12 }}>
            <div className="grid2">
              {fld("m-name", "기관명", "name", { autoComplete: "organization" })}
              {fld("m-mail", "대표 이메일", "contactEmail", { type: "email" })}
              {fld("m-person", "담당자 성명", "contactName")}
              {fld("m-phone", "대표 연락처", "contactPhone", { type: "tel" })}
              {fld("m-biz", "사업자등록번호", "businessNo", { inputMode: "numeric" })}
              {fld("m-web", "웹사이트", "website")}
            </div>
            <div className="fld">
              <span className="fld__lab">수행 분야</span>
              <div className="chips">
                {CATS.map((c) => <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>{c}</button>)}
              </div>
            </div>
            <div className="fld">
              <span className="fld__lab">GLP 인증</span>
              <div className="chips">
                {GLP_OPTIONS.map((g) => <button key={g} type="button" className="chip" aria-pressed={glp.includes(g)} onClick={() => toggle(glp, setGlp, g)}>{g}</button>)}
              </div>
            </div>
            {fld("m-other", "기타 인증", "otherCerts")}
            {dup && <Link href={`/admin/cros/${dup.id}`} className="b2 bsm" style={{ alignSelf: "flex-start" }}>그 기관 열기</Link>}
          </div>
        }
        confirmLabel="추가"
        cancelLabel="닫기"
        pendingLabel="추가하는 중"
        action={save}
        onResult={() => setOpen(false)}
      />
    </>
  );
}
