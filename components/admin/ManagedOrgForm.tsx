"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATS } from "@/lib/rfq-schema";
import { GLP_OPTIONS } from "@/lib/concierge";

const EMPTY = { name: "", contactEmail: "", contactName: "", contactPhone: "", businessNo: "", website: "", otherCerts: "" };

/**
 * 기관 추가 (운영자 관리). 아직 가입하지 않은 기관을 운영자가 등록해 요청을 전달하고, 기관이 보낸 견적서 PDF 를 대신 입력한다.
 * 승인 메일 없이 바로 참여 중이 된다. 같은 기관이 있으면 그 기관으로 안내한다.
 */
export function ManagedOrgForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [cats, setCats] = useState<string[]>([]);
  const [glp, setGlp] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; existingId?: string } | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (list: string[], setList: (v: string[]) => void, v: string) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ready = !!f.name.trim() && !!f.contactEmail.trim() && cats.length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/cros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats, glpCerts: glp }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string; existingId?: string };
      if (!r.ok) {
        setMsg({ ok: false, text: d.error || "기관을 추가하지 못했습니다.", existingId: d.existingId });
        return;
      }
      setMsg({ ok: true, text: d.message || "추가했습니다." });
      setF(EMPTY);
      setCats([]);
      setGlp([]);
      setOpen(false);
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "기관을 추가하지 못했습니다. 연결을 확인하고 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="stack" style={{ gap: 8, marginBottom: 20 }}>
        <div>
          <button type="button" className="b2 bsm" onClick={() => { setOpen(true); setMsg(null); }}>기관 추가 (운영자 관리)</button>
        </div>
        {msg && <p className={`note ${msg.ok ? "note--ok" : "note--err"}`} role="status">{msg.text}</p>}
      </div>
    );
  }

  return (
    <form className="card card--pad stack" style={{ gap: 14, marginBottom: 20 }} onSubmit={save}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>기관 추가 (운영자 관리)</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: "70ch" }}>
          아직 가입하지 않은 기관을 등록합니다. 승인 메일 없이 바로 참여 중이 되고, 요청서 메일은 로그인 없는 회신 링크로 갑니다.
          기관이 보낸 견적서 PDF는 요청 화면의 회신 링크에서 대신 입력합니다. 자동 배포와 의뢰자 지명 목록에는 들어가지 않으니, 요청 화면의 배포 패널에서 골라 보내 주세요.
        </p>
      </div>
      <div className="grid2">
        <div className="fld"><label className="fld__lab" htmlFor="m-name">기관명<span className="req">*</span></label><input id="m-name" className="inp" value={f.name} onChange={set("name")} autoComplete="organization" /></div>
        <div className="fld"><label className="fld__lab" htmlFor="m-mail">대표 이메일<span className="req">*</span></label><input id="m-mail" className="inp" type="email" value={f.contactEmail} onChange={set("contactEmail")} /><p className="fld__help">요청서와 회신 링크, 계약 진행 확인 메일을 받는 주소입니다. 기관이 공개한 대표 연락처를 넣어 주세요. 요청서 메일에 그렇게 안내됩니다.</p></div>
        <div className="fld"><label className="fld__lab" htmlFor="m-person">담당자 성명</label><input id="m-person" className="inp" value={f.contactName} onChange={set("contactName")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="m-phone">대표 연락처</label><input id="m-phone" className="inp" type="tel" value={f.contactPhone} onChange={set("contactPhone")} /></div>
        <div className="fld"><label className="fld__lab" htmlFor="m-biz">사업자등록번호</label><input id="m-biz" className="inp tnum" inputMode="numeric" value={f.businessNo} onChange={set("businessNo")} /><p className="fld__help">같은 번호의 기관이 있으면 추가하지 않고 알려 드립니다.</p></div>
        <div className="fld"><label className="fld__lab" htmlFor="m-web">웹사이트</label><input id="m-web" className="inp" value={f.website} onChange={set("website")} /></div>
      </div>
      <div className="fld">
        <span className="fld__lab">수행 분야<span className="req">*</span></span>
        <div className="chips">
          {CATS.map((c) => <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>{c}</button>)}
        </div>
      </div>
      <div className="fld">
        <span className="fld__lab">GLP 인증</span>
        <div className="chips">
          {GLP_OPTIONS.map((g) => <button key={g} type="button" className="chip" aria-pressed={glp.includes(g)} onClick={() => toggle(glp, setGlp, g)}>{g}</button>)}
        </div>
        <p className="fld__help">비교표의 제출처 대응 판정에 쓰입니다. 비워 두면 "등록 정보 없음"으로 보입니다.</p>
      </div>
      <div className="fld"><label className="fld__lab" htmlFor="m-other">기타 인증</label><input id="m-other" className="inp" value={f.otherCerts} onChange={set("otherCerts")} /></div>
      {msg && !msg.ok && (
        <p className="note note--err" role="alert">
          {msg.text}
          {msg.existingId && <> <Link href={`/admin/cros/${msg.existingId}`}>기관 보기</Link></>}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="b1 bsm" disabled={!ready || busy}>{busy ? "추가 중…" : "기관 추가"}</button>
        <button type="button" className="b2 bsm" disabled={busy} onClick={() => setOpen(false)}>닫기</button>
      </div>
    </form>
  );
}
