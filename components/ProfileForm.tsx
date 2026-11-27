"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Caret } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { phoneError } from "@/lib/settings";

type P = { name: string; company: string; dept: string; phone: string; orgType: string };

/**
 * 담당자 정보 (시안 r-set-company · c-set-profile). 저장하면 토스트, 휴대전화 오류는 칸 바로 아래,
 * 저장하지 않은 내용이 있으면 창을 닫거나 새로 고칠 때 브라우저가 한 번 묻는다.
 */
export function ProfileForm({ initial, orgTypes, showCompany }: { initial: P; orgTypes: readonly string[]; showCompany: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<P>(initial);
  const [saved, setSaved] = useState<P>(initial);
  const [busy, setBusy] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || busy) return;
    const pe = phoneError(f.phone);
    setPhoneErr(pe);
    if (pe) return document.getElementById("phone")?.focus();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "저장하지 못했어요. 입력한 내용은 그대로 있어요.");
      setSaved(f);
      toast("담당자 정보를 저장했어요");
      router.refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "저장하지 못했어요. 입력한 내용은 그대로 있어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={save} noValidate>
      <div className="grid2">
        <div className="fld">
          <label className="fld__lab" htmlFor="name">성명<span className="req">*</span></label>
          <input id="name" className="inp" value={f.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor="phone">휴대전화</label>
          <input id="phone" className="inp" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="010-" autoComplete="tel" aria-invalid={!!phoneErr} aria-describedby={phoneErr ? "phone-err" : undefined} />
          {phoneErr && <p id="phone-err" className="fld__err">{phoneErr}</p>}
        </div>
        {showCompany && (
          <>
            <div className="fld">
              <label className="fld__lab" htmlFor="company">회사·기관명<span className="req">*</span></label>
              <input id="company" className="inp" value={f.company} onChange={set("company")} autoComplete="organization" />
            </div>
            <div className="fld">
              <label className="fld__lab" htmlFor="orgType">기관 유형</label>
              <div className="selwrap">
                <select id="orgType" className="sel" value={f.orgType} onChange={set("orgType")}>
                  <option value="">선택</option>
                  {orgTypes.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <Caret dir="down" color="var(--muted)" />
              </div>
            </div>
          </>
        )}
        <div className="fld">
          <label className="fld__lab" htmlFor="dept">부서·직위</label>
          <input id="dept" className="inp" value={f.dept} onChange={set("dept")} placeholder="개발팀 · 팀장" autoComplete="organization-title" />
        </div>
      </div>
      {err && <p className="note note--err" role="alert">{err}</p>}
      <div>
        <button type="submit" className={busy ? "b1 is-loading" : "b1"} disabled={!dirty} aria-busy={busy || undefined}>저장</button>
      </div>
    </form>
  );
}
