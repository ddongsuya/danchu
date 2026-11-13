"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { inkOn, type DocData, type DocHead, type QuoteStyle } from "@/lib/quote-doc";
import { uploadToSigned } from "@/lib/upload";
import { Cover, QuotePage, pageCount } from "./DocPages";

const SWATCHES = ["#1b1b19", "#23395b", "#1f4e46", "#5b2333", "#4a3f6b", "#6b4a1f"];
const STEPS = [
  { key: "received", label: "접수" },
  { key: "making", label: "제작 중" },
  { key: "review", label: "검토" },
  { key: "applied", label: "적용" },
];
const STATUS_LABEL: Record<string, string> = { received: "접수", making: "제작 중", review: "검토", applied: "적용", cancelled: "취소" };

export type DesignReq = { id: string; status: string; note: string; files: { name: string; size: number }[]; reply: string; createdAt: string };

type Props = { initial: QuoteStyle; sample: { head: DocHead; data: DocData }; sampleIsReal: boolean; requests: DesignReq[]; readOnly?: boolean };

/** 이미지 파일 → 가로 최대 640px PNG/JPEG data URL (300KB 이하) */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("이미지를 읽지 못했어요.")); i.src = url; });
    const scale = Math.min(1, 640 / img.width, 240 / img.height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/png");
    if (out.length > 380_000) out = c.toDataURL("image/jpeg", 0.85);
    if (out.length > 380_000) throw new Error("로고가 너무 커요. 더 작은 이미지를 올려 주세요.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 견적서 양식: 로고·브랜드 색·공급자 정보·거래 조건 기본 문구를 정하면 미리보기에 바로 반영된다.
 * 아래에서 지금 쓰는 견적서 파일을 올려 양식 제작을 요청한다 (접수 → 제작 중 → 검토 → 적용).
 */
export function StyleEditor({ initial, sample, sampleIsReal, requests, readOnly = false }: Props) {
  const router = useRouter();
  const [st, setSt] = useState<QuoteStyle>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hex, setHex] = useState(initial.brandColor ?? "#1b1b19");
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (p: Partial<QuoteStyle>) => { setSt((s) => ({ ...s, ...p })); setDirty(true); setMsg(null); };
  const setSup = (k: keyof QuoteStyle["supplier"], v: string) => set({ supplier: { ...st.supplier, [k]: v } });
  const setTerm = (k: keyof QuoteStyle["terms"], v: string) => set({ terms: { ...st.terms, [k]: v } });

  const pickLogo = async (f: File | null) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setMsg({ ok: false, text: "로고는 PNG·JPG·WEBP 이미지로 올려 주세요." });
    try { set({ logo: await shrink(f) }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "이미지를 읽지 못했어요." }); }
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/cro/quote-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(st) }).catch(() => null);
    const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: d?.error || "저장하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요." });
    setDirty(false);
    setMsg({ ok: true, text: "저장했어요. 로고와 색은 모든 견적서에, 거래 조건 기본 문구는 새 견적서부터 들어가요." });
    router.refresh();
  };

  const color = st.brandColor ?? "#1b1b19";
  return (
    <div className="qsty">
      <div className="qsty__form">
        <section className="qsty__sec">
          <h2 className="qsty__h2">로고와 브랜드 색</h2>
          <p className="qed__muted">고르는 대로 미리보기에 바로 보여요.</p>
          <div className="fld">
            <span className="fld__lab">로고</span>
            <div className="qsty__logo">
              <span className="qsty__logobox">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {st.logo ? <img src={st.logo} alt="올린 로고" /> : <span>로고 없음</span>}
              </span>
              <div className="qsty__logoact">
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void pickLogo(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                <button type="button" className="b2 bsm" disabled={readOnly} onClick={() => logoRef.current?.click()}>{st.logo ? "로고 바꾸기" : "로고 올리기"}</button>
                {st.logo && <button type="button" className="btxt" disabled={readOnly} onClick={() => set({ logo: null })}>로고 지우기</button>}
              </div>
            </div>
            <p className="fld__help">PNG·JPG·WEBP. 가로가 긴 로고가 잘 맞아요. 없으면 기관명이 글자로 들어가요.</p>
          </div>
          <div className="fld">
            <span className="fld__lab">로고 위치</span>
            <div className="chips" role="radiogroup" aria-label="로고 위치">
              {(["left", "right"] as const).map((p) => <button key={p} type="button" role="radio" className="chip" aria-checked={st.logoPos === p} aria-pressed={st.logoPos === p} disabled={readOnly} onClick={() => set({ logoPos: p })}>{p === "left" ? "왼쪽" : "오른쪽"}</button>)}
            </div>
          </div>
          <div className="fld">
            <span className="fld__lab">브랜드 색</span>
            <div className="qsty__sw" role="radiogroup" aria-label="브랜드 색">
              {SWATCHES.map((c) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} disabled={readOnly} style={{ background: c }} onClick={() => { set({ brandColor: c }); setHex(c); }} />)}
              <input aria-label="색 직접 입력" className="inp qsty__hex tnum" value={hex} maxLength={7} disabled={readOnly} onChange={(e) => { const v = e.target.value.trim(); setHex(v); if (/^#[0-9a-f]{6}$/i.test(v)) set({ brandColor: v.toLowerCase() }); }} />
            </div>
            <p className="fld__help">표 머리글과 제목에 쓰여요. 글자색은 읽기 쉬운 색으로 자동 조정돼요{inkOn(color) === "#1b1b19" ? " (지금은 먹색 글자)" : ""}.</p>
          </div>
        </section>

        <section className="qsty__sec">
          <h2 className="qsty__h2">공급자 정보</h2>
          <p className="qed__muted">표지 아래와 엑셀 머리에 들어가요.</p>
          <div className="grid2">
            {([["name", "기관명"], ["address", "주소"], ["contact", "대표 연락처"], ["person", "담당자"], ["email", "이메일"]] as [keyof QuoteStyle["supplier"], string][]).map(([k, label]) => (
              <div className="fld" key={k}><label className="fld__lab" htmlFor={`sup-${k}`}>{label}</label><input id={`sup-${k}`} className="inp" disabled={readOnly} value={st.supplier[k]} maxLength={k === "address" ? 200 : 120} onChange={(e) => setSup(k, e.target.value)} /></div>
            ))}
          </div>
        </section>

        <section className="qsty__sec">
          <h2 className="qsty__h2">거래 조건 기본 문구</h2>
          <p className="qed__muted">새 견적서에 미리 채워져요. 견적서마다 고칠 수 있어요.</p>
          <div className="fld"><label className="fld__lab" htmlFor="t-pay">결제 조건</label><input id="t-pay" className="inp" disabled={readOnly} value={st.terms.pay} maxLength={300} placeholder="예: 계약 시 50%, 최종 보고서 제출 시 50%" onChange={(e) => setTerm("pay", e.target.value)} /></div>
          <div className="fld"><label className="fld__lab" htmlFor="t-extra">별도 비용</label><input id="t-extra" className="inp" disabled={readOnly} value={st.terms.extra} maxLength={300} placeholder="예: 시험물질 운송, 영문 보고서" onChange={(e) => setTerm("extra", e.target.value)} /></div>
          <div className="fld"><label className="fld__lab" htmlFor="t-note">비고</label><textarea id="t-note" className="ta" rows={2} disabled={readOnly} value={st.terms.note} maxLength={600} placeholder="예: 시험 설계가 바뀌면 수정 견적서를 다시 드립니다." onChange={(e) => setTerm("note", e.target.value)} /></div>
        </section>

        <div className="qsty__save">
          {msg && <span role="status" className={msg.ok ? "qrate__ok" : "qed__warn"}>{msg.text}</span>}
          {!readOnly && <button type="button" className="b1" disabled={busy || !dirty} onClick={save}>{busy ? "저장 중…" : "저장"}</button>}
        </div>

        <DesignRequestForm requests={requests} readOnly={readOnly} />
      </div>

      <aside className="qsty__preview" aria-label="미리보기">
        <p className="qed__muted">{sampleIsReal ? "가장 최근 견적서로 보여요" : "견적서를 만들면 그 견적서로 보여요"}</p>
        <div className="qsty__pages">
          <div className="qsty__page"><Cover head={sample.head} data={sample.data} style={st} i={1} total={pageCount(sample.data)} /></div>
          <div className="qsty__page"><QuotePage head={sample.head} data={sample.data} style={st} i={2} total={pageCount(sample.data)} /></div>
        </div>
      </aside>
    </div>
  );
}

function DesignRequestForm({ requests, readOnly }: { requests: DesignReq[]; readOnly: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const open = requests.find((r) => ["received", "making", "review"].includes(r.status));

  const send = async () => {
    setBusy(true); setErr("");
    try {
      const up: { path: string; name: string; size: number }[] = [];
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) throw new Error(`${f.name}: 파일은 20MB 이하만 올릴 수 있어요.`);
        const r = await fetch("/api/cro/design-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload-url", name: f.name, size: f.size, type: f.type }) });
        const d = (await r.json().catch(() => ({}))) as { path?: string; signedUrl?: string; error?: string };
        if (!r.ok || !d.path || !d.signedUrl) throw new Error(d.error || "업로드를 준비하지 못했어요.");
        if (!(await uploadToSigned({ name: f.name, path: d.path, signedUrl: d.signedUrl }, f))) throw new Error(`${f.name}을 올리지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.`);
        up.push({ path: d.path, name: f.name, size: f.size });
      }
      const r = await fetch("/api/cro/design-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", note, files: up }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "요청을 보내지 못했어요.");
      setFiles([]); setNote("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "요청을 보내지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="qsty__sec">
      <h2 className="qsty__h2">양식 제작 요청 <small>구독 포함</small></h2>
      <p className="qed__muted">지금 쓰는 견적서 양식을 올려 주세요. 단추가 같은 모양으로 제작해요.</p>
      {open ? (
        <div className="qsty__req">
          <ol className="qsty__steps">
            {STEPS.map((s, i) => {
              const at = STEPS.findIndex((x) => x.key === open.status);
              return <li key={s.key} data-s={i < at ? "done" : i === at ? "now" : "next"}><b>{s.label}</b>{i === 0 ? <span className="tnum">{open.createdAt.slice(5, 10).replace("-", "-")}</span> : null}</li>;
            })}
          </ol>
          {open.files.length > 0 && <p className="qed__muted">첨부 {open.files.map((f) => f.name).join(", ")}</p>}
          {open.reply && <p className="qsty__reply">{open.reply}</p>}
          <p className="qed__muted">진행 중인 요청이 적용되면 새로 요청할 수 있어요.</p>
        </div>
      ) : (
        <>
          <div className="fld">
            <span className="fld__lab">지금 쓰는 견적서</span>
            <input ref={ref} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 10)); e.target.value = ""; }} />
            <div className="qsty__files">
              {files.map((f, i) => <span key={`${f.name}-${i}`} className="tag">{f.name}<button type="button" className="qed__x" aria-label={`${f.name} 빼기`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></span>)}
              <button type="button" className="b2 bsm" disabled={readOnly} onClick={() => ref.current?.click()}>파일 올리기</button>
            </div>
            <p className="fld__help">PDF·엑셀·워드·이미지, 파일당 20MB 이하. 회사 정보가 든 실제 견적서도 괜찮아요. 운영자만 열어 봐요.</p>
          </div>
          <div className="fld">
            <label className="fld__lab" htmlFor="dr-note">요청 내용 <span className="qnew__opt">선택</span></label>
            <textarea id="dr-note" className="ta" rows={3} maxLength={2000} disabled={readOnly} value={note} placeholder="예: 표지는 지금 양식 그대로, 견적 내역 표는 회사 색으로" onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <p role="alert" className="qed__warn">{err}</p>}
          {!readOnly && <button type="button" className="b1" disabled={busy || (!files.length && !note.trim())} onClick={send}>{busy ? "보내는 중…" : "제작 요청"}</button>}
        </>
      )}
      {requests.filter((r) => r !== open).length > 0 && (
        <ul className="qsty__past">
          {requests.filter((r) => r !== open).map((r) => <li key={r.id}><span className="tnum">{r.createdAt.slice(0, 10)}</span><span>{STATUS_LABEL[r.status] ?? r.status}</span>{r.reply && <small>{r.reply}</small>}</li>)}
        </ul>
      )}
    </section>
  );
}
