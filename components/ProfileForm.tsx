"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Caret } from "@/components/app/ui";

type P = { name: string; company: string; dept: string; phone: string; orgType: string };

export function ProfileForm({ initial, orgTypes, showCompany }: { initial: P; orgTypes: readonly string[]; showCompany: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<P>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "저장하지 못했습니다.");
      setMsg({ ok: true, text: "저장했습니다." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "저장하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={save}>
      <div className="grid2">
        <div className="fld">
          <label className="fld__lab" htmlFor="name">성명<span className="req">*</span></label>
          <input id="name" className="inp" value={f.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div className="fld">
          <label className="fld__lab" htmlFor="phone">휴대전화</label>
          <input id="phone" className="inp" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="010-0000-0000" autoComplete="tel" />
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
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
      <div>
        <button type="submit" className="b1" disabled={!dirty || busy}>{busy ? "저장 중…" : "저장"}</button>
      </div>
    </form>
  );
}
