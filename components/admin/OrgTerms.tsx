"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CroOrg } from "@/lib/auth";
import { CATS } from "@/lib/rfq-schema";

/**
 * 기관 약정과 운영 설정. 청구는 기관이 제출한 견적 1건 단위다 (lib/billing.ts):
 * 1,000만 원 미만은 월 구독료, 1,000만 원 이상은 건당 이용료, 5,000만 원 이상이 체결되면 성사수수료.
 * 약정 값은 서면 합의 뒤 운영자만 적는다. 승인 뒤 기관명 변경도 여기서만 한다 (같은 이름의 다른 기관과 합류 매칭이 섞이지 않게).
 */
export function OrgTerms({ org, autoReplyAvailable = false }: { org: CroOrg; autoReplyAvailable?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: org.name,
    perRequestFee: org.per_request_fee == null ? "" : String(org.per_request_fee),
    monthlyFee: org.monthly_fee == null ? "" : String(org.monthly_fee),
    monthlyFeeFrom: org.monthly_fee_from ? org.monthly_fee_from.slice(0, 7) : "",
    feeRate: org.fee_rate == null ? "" : String(Math.round(org.fee_rate * 10000) / 100),
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
        body: JSON.stringify({ name: f.name, perRequestFee: f.perRequestFee === "" ? null : Number(f.perRequestFee), monthlyFee: f.monthlyFee === "" ? null : Number(f.monthlyFee), monthlyFeeFrom: f.monthlyFee === "" ? null : f.monthlyFeeFrom || null, feeRate: f.feeRate === "" ? null : Number(f.feeRate) / 100, contactEmail: f.contactEmail, contactPhone: f.contactPhone, categories: cats, autoReply }),
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
        <div className="fld"><label className="fld__lab" htmlFor="t-monthly">월 구독료 (원)</label><input id="t-monthly" className="inp tnum" inputMode="numeric" value={f.monthlyFee} onChange={set("monthlyFee")} placeholder="구독하지 않으면 비워 둠" aria-describedby="t-monthly-help" /><span id="t-monthly-help" className="fld__help">1,000만 원 미만 견적이 여기에 포함됩니다. 바꾸거나 지우기 전에 지난달 명세를 마감해 두세요. 마감하지 않은 달에는 바뀐 값이 들어갑니다.</span></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-monthly-from">구독 시작 월</label><input id="t-monthly-from" className="inp tnum" type="month" value={f.monthlyFeeFrom} onChange={set("monthlyFeeFrom")} disabled={f.monthlyFee === ""} aria-describedby="t-monthly-from-help" /><span id="t-monthly-from-help" className="fld__help">이 달부터 명세에 월 구독료가 나옵니다. 비워 두면 구독료를 저장한 달부터입니다.</span></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-fee">건당 이용료 (원)</label><input id="t-fee" className="inp tnum" inputMode="numeric" value={f.perRequestFee} onChange={set("perRequestFee")} placeholder="미정이면 비워 둠" aria-describedby="t-fee-help" /><span id="t-fee-help" className="fld__help">1,000만 원 이상 견적 1건마다. 재제출은 다시 받지 않습니다.</span></div>
        <div className="fld"><label className="fld__lab" htmlFor="t-rate">성사수수료율 (%)</label><input id="t-rate" className="inp tnum" inputMode="decimal" value={f.feeRate} onChange={set("feeRate")} placeholder="예: 3 · 미정이면 비워 둠" aria-describedby="t-rate-help" /><span id="t-rate-help" className="fld__help">5,000만 원 이상 견적이 체결되면 계약 금액에 곱합니다.</span></div>
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
