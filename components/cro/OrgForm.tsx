"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CroOrg } from "@/lib/auth";
import { CATS } from "@/lib/rfq-schema";

const GLP_OPTS = ["식약처(KGLP)", "OECD GLP", "US FDA GLP", "US EPA GLP", "기후에너지환경부·국립환경과학원", "농촌진흥청", "농림축산검역본부"];

export function OrgForm({ org }: { org: CroOrg }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: org.name, businessNo: org.business_no ?? "", website: org.website ?? "", address: org.address ?? "",
    contactName: org.contact_name ?? "", contactEmail: org.contact_email ?? "", contactPhone: org.contact_phone ?? "",
    otherCerts: org.other_certs ?? "", intro: org.intro ?? "",
  });
  const [glp, setGlp] = useState<string[]>(org.glp_certs ?? []);
  const [cats, setCats] = useState<string[]>(org.categories ?? []);
  const [aaalac, setAaalac] = useState<boolean | null>(org.aaalac);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (list: string[], setList: (v: string[]) => void, v: string) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cro/org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, glpCerts: glp, categories: cats, aaalac }) });
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
    <form className="stack" style={{ gap: 16 }} onSubmit={save}>
      <div className="grid2">
        <div className="fld"><label className="fld__lab" htmlFor="name">기관명<span className="req">*</span></label><input id="name" className="inp" value={f.name} onChange={set("name")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="bn">사업자등록번호</label><input id="bn" className="inp" value={f.businessNo} onChange={set("businessNo")} placeholder="000-00-00000" /></div>
        <div className="fld"><label className="fld__lab" htmlFor="web">웹사이트</label><input id="web" className="inp" type="url" value={f.website} onChange={set("website")} placeholder="https://" /></div>
        <div className="fld"><label className="fld__lab" htmlFor="addr">시험시설 소재지</label><input id="addr" className="inp" value={f.address} onChange={set("address")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="cn">대표 담당자</label><input id="cn" className="inp" value={f.contactName} onChange={set("contactName")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="ce">대표 이메일 (배포 메일 수신)</label><input id="ce" className="inp" type="email" value={f.contactEmail} onChange={set("contactEmail")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="cp">대표 연락처</label><input id="cp" className="inp" type="tel" value={f.contactPhone} onChange={set("contactPhone")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="oc">기타 인증·지정</label><input id="oc" className="inp" value={f.otherCerts} onChange={set("otherCerts")} placeholder="KOLAS, ISO 17025 등" /></div>
      </div>
      <div className="fld">
        <span className="fld__lab">보유 GLP 인증</span>
        <div className="chips">
          {GLP_OPTS.map((o) => <button key={o} type="button" className="chip" aria-pressed={glp.includes(o)} onClick={() => toggle(glp, setGlp, o)}>{o}</button>)}
        </div>
      </div>
      <div className="fld">
        <span className="fld__lab">AAALAC 인증</span>
        <div className="seg">
          {[["예", true], ["아니오", false]].map(([l, v]) => (
            <button key={String(l)} type="button" aria-pressed={aaalac === v} onClick={() => setAaalac(v as boolean)}>{l as string}</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <span className="fld__lab">수행 가능 시험 분야<span className="req">*</span></span>
        <span className="fld__help">선택한 분야의 요청서만 배포됩니다.</span>
        <div className="chips">
          {CATS.map((c) => <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>{c}</button>)}
        </div>
      </div>
      <div className="fld"><label className="fld__lab" htmlFor="intro">기관 소개</label><textarea id="intro" className="ta" rows={3} value={f.intro} onChange={set("intro")} /></div>
      {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
      <div><button type="submit" className="b1" disabled={busy || !f.name || cats.length === 0}>{busy ? "저장 중…" : "저장"}</button></div>
    </form>
  );
}
