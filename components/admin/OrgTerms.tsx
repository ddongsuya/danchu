"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CroOrg } from "@/lib/auth";
import { CATS } from "@/lib/rfq-schema";

/**
 * 기관 약정과 운영 설정. 전달 1건 = 청구 1건이므로 단가·월 한도는 운영자만 적는다.
 * 승인 뒤 기관명 변경도 여기서만 한다 (같은 이름의 다른 기관과 합류 매칭이 섞이지 않게).
 */
export function OrgTerms({ org, autoReplyAvailable = false }: { org: CroOrg; autoReplyAvailable?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: org.name,
    perRequestFee: org.per_request_fee == null ? "" : String(org.per_request_fee),
    monthlyCap: org.monthly_cap == null ? "" : String(org.monthly_cap),
    contactEmail: org.contact_email ?? "",
    contactPhone: org.contact_phone ?? "",
  });
  const [cats, setCats] = useState<string[]>(org.categories ?? []);
  const [autoReply, setAutoReply] = useState(!!org.auto_reply);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/cros/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, perRequestFee: f.perRequestFee === "" ? null : Number(f.perRequestFee), monthlyCap: f.monthlyCap === "" ? null : Number(f.monthlyCap), contactEmail: f.contactEmail, contactPhone: f.contactPhone, categories: cats, autoReply }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) throw new Error(d.error || "저장하지 못했습니다.");
      setMsg({ ok: true, text: d.message || "저장했습니다." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "저장하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={save}>
      <div className="grid2">
        <div className="fld"><label className="fld__lab" htmlFor="t-name">기관명</label><input id="t-name" className="inp" value={f.name} onChange={set("name")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-fee">전달 1건 이용료 (원)</label><input id="t-fee" className="inp tnum" inputMode="numeric" value={f.perRequestFee} onChange={set("perRequestFee")} placeholder="미정이면 비워 둠" /></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-cap">월 전달 한도 (건)</label><input id="t-cap" className="inp tnum" inputMode="numeric" value={f.monthlyCap} onChange={set("monthlyCap")} placeholder="없으면 비워 둠" /></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-mail">대표 이메일 (배포 메일 수신)</label><input id="t-mail" className="inp" type="email" value={f.contactEmail} onChange={set("contactEmail")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-phone">대표 연락처</label><input id="t-phone" className="inp" type="tel" value={f.contactPhone} onChange={set("contactPhone")} /></div>
      </div>
      <div className="fld">
        <span className="fld__lab">수행 분야 (바꾸면 맞는 요청이 바로 배포됨)</span>
        <div className="chips">
          {CATS.map((c) => <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>{c}</button>)}
        </div>
      </div>
      {autoReplyAvailable && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
          <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} style={{ marginTop: 3 }} />
          <span>자동 회신 <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>기한까지 손대지 않은 카탈로그 초안을 예비 견적으로 제출합니다. 예비 견적은 PDF를 붙이기 전까지 선정 대상이 아닙니다.</span></span>
        </label>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="submit" className="b1 bsm" disabled={busy || !f.name.trim() || cats.length === 0}>{busy ? "저장 중…" : "약정 저장"}</button>
        {msg && <span style={{ fontSize: 13, color: msg.ok ? "var(--ok)" : "var(--err)" }} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}
