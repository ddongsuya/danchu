"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Caret, CheckMark } from "@/components/app/ui";
import { EMPTY_COMMON, INCL_KEYS, REPORT_LANGS, type ReplyCommon, type ReplyItem, type RfqView } from "@/lib/cro-data";
import { won } from "@/lib/format";
import { uploadToSigned } from "@/lib/upload";
import { designSummary, EXPLAIN_FIELDS, ROUTES, SPECIES } from "@/lib/catalog";
import type { Cat } from "@/lib/rfq-schema";
import { EfficacyCosts } from "@/components/cro/EfficacyCosts";
import { EFFICACY_CAT } from "@/lib/efficacy";

const AVAILS: ReplyItem["avail"][] = ["가능", "조건부 가능", "불가"];
const MAX_PDF = 20 * 1024 * 1024;

type Design = Record<string, unknown>;
const dnum = (d: Design, k: string) => (typeof d[k] === "number" ? String(d[k]) : typeof d[k] === "string" ? (d[k] as string) : "");
const dstr = (d: Design, k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
const dspecies = (d: Design) => (Array.isArray(d.species) ? (d.species as string[]) : []);

/** 항목별 설계 요약 - 접힌 상태에서는 한 줄, 펼치면 칸별 수정 */
function DesignEditor({ value, category, disabled, onChange }: { value: Design; category: string; disabled: boolean; onChange: (d: Design) => void }) {
  const [open, setOpen] = useState(false);
  const explain = EXPLAIN_FIELDS[category as Cat] ?? [];
  const extra = (value.extra && typeof value.extra === "object" ? value.extra : {}) as Record<string, unknown>;
  const filledExp = explain.filter((f) => typeof extra[f.id] === "string" && (extra[f.id] as string).trim()).length;
  const summary = designSummary({
    species: dspecies(value),
    groups_ctrl: dnum(value, "groups_ctrl") ? Number(dnum(value, "groups_ctrl")) : null,
    groups_test: dnum(value, "groups_test") ? Number(dnum(value, "groups_test")) : null,
    per_sex: dnum(value, "per_sex") ? Number(dnum(value, "per_sex")) : null,
    recovery_weeks: dnum(value, "recovery_weeks") ? Number(dnum(value, "recovery_weeks")) : null,
    recovery_per_sex: dnum(value, "recovery_per_sex") ? Number(dnum(value, "recovery_per_sex")) : null,
    route: dstr(value, "route") || null,
    dosing: dstr(value, "dosing") || null,
    method: dstr(value, "method") || null,
  });
  const setNum = (k: string, v: string) => onChange({ ...value, [k]: v ? Number(v.replace(/[^\d]/g, "").slice(0, 4)) : null });
  const numIn = (k: string, label: string, unit: string) => (
    <div className="fld" style={{ gap: 4 }}>
      <span className="fld__lab" style={{ fontSize: 12 }}>{label}</span>
      <div className="numin"><input type="text" inputMode="numeric" disabled={disabled} value={dnum(value, k)} onChange={(e) => setNum(k, e.target.value)} aria-label={label} /><span>{unit}</span></div>
    </div>
  );
  return (
    <div style={{ borderTop: "1px dashed var(--cline)", paddingTop: 10 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)", textAlign: "left", background: "none", border: 0, padding: 0 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>설계 · {summary || "미입력 (등록한 기본 조건를 적어 두면 비교표에 표시됩니다)"}</span>
        <span style={{ flex: "none", color: "var(--brand)", fontWeight: 600 }}>{open ? "접기" : "수정"}</span>
      </button>
      {open && (
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          <div className="fld" style={{ gap: 4 }}>
            <span className="fld__lab" style={{ fontSize: 12 }}>동물종·계통</span>
            <div className="chips">
              {SPECIES.map((s) => {
                const on = dspecies(value).includes(s);
                return <button key={s} type="button" className="chip" aria-pressed={on} disabled={disabled} onClick={() => onChange({ ...value, species: on ? dspecies(value).filter((x) => x !== s) : [...dspecies(value), s] })}>{s}</button>;
              })}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {numIn("groups_ctrl", "대조군", "군")}
            {numIn("groups_test", "시험군", "군")}
            {numIn("per_sex", "군당 마릿수", "/성")}
            {numIn("recovery_weeks", "회복기간", "주")}
            {numIn("recovery_per_sex", "회복군 추가", "/성")}
          </div>
          <div className="grid2">
            <div className="fld" style={{ gap: 4 }}>
              <span className="fld__lab" style={{ fontSize: 12 }}>투여경로</span>
              <div className="chips">
                {ROUTES.map((s) => <button key={s} type="button" className="chip" aria-pressed={dstr(value, "route") === s} disabled={disabled} onClick={() => onChange({ ...value, route: dstr(value, "route") === s ? null : s })}>{s}</button>)}
              </div>
            </div>
            <div className="fld" style={{ gap: 4 }}>
              <label className="fld__lab" style={{ fontSize: 12 }}>투여 빈도·기간</label>
              <input className="inp" style={{ height: 40, fontSize: 13 }} placeholder="예: 1일 1회 · 4주" disabled={disabled} value={dstr(value, "dosing")} onChange={(e) => onChange({ ...value, dosing: e.target.value.slice(0, 120) })} />
            </div>
            <div className="fld" style={{ gap: 4 }}>
              <label className="fld__lab" style={{ fontSize: 12 }}>{category === EFFICACY_CAT ? "질환 모델" : "시험법·가이드라인"}</label>
              <input className="inp" style={{ height: 40, fontSize: 13 }} placeholder="예: OECD TG 423 급성독성등급법" disabled={disabled} value={dstr(value, "method")} onChange={(e) => onChange({ ...value, method: e.target.value.slice(0, 120) })} />
            </div>
          </div>
        </div>
      )}
      {explain.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--brand)" }}>시험 설계와 비용 조건 <span style={{ fontWeight: 400, color: "var(--muted)" }}>{filledExp} / {explain.length} · 비교표에 나란히 표시됩니다</span></summary>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {explain.map((f) => (
              <div key={f.id} className="fld" style={{ gap: 4 }}>
                <label className="fld__lab" style={{ fontSize: 12 }}>{f.label}</label>
                <input className="inp" style={{ height: 40, fontSize: 13 }} placeholder={f.placeholder} disabled={disabled} value={typeof extra[f.id] === "string" ? (extra[f.id] as string) : ""} onChange={(e) => onChange({ ...value, extra: { ...extra, [f.id]: e.target.value.slice(0, 300) } })} aria-label={f.label} />
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="fld" style={{ gap: 4, marginTop: 10 }}>
        <label className="fld__lab" style={{ fontSize: 12 }}>그 밖의 설명 <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 비교표에 그대로 표시됩니다</span></label>
        <textarea className="ta" rows={2} style={{ fontSize: 13 }} placeholder="예: 회복 동물은 대조군·고용량군의 마지막 5마리/성 지정. 분석법 검증 1회 포함." disabled={disabled} value={dstr(value, "note")} onChange={(e) => onChange({ ...value, note: e.target.value.slice(0, 1000) })} />
      </div>
    </div>
  );
}

type Loaded = {
  rfq: RfqView;
  draft: { items: ReplyItem[]; note: string; pdfName: string; status: string; common: ReplyCommon; prefilled?: boolean } | null;
  expired?: boolean;
  locked?: boolean;
  declined?: boolean;
  closed?: boolean;
};

/**
 * 견적 회신 폼 - 항목별 3칸(+사유) · 공통 조건 · 전달 사항 · 견적서 원본(PDF).
 * 초안은 800ms 뒤 자동 저장. 제출본은 자동 저장으로 덮지 않고 "제출" 버튼으로만 갱신한다.
 */
export function ReplyForm({ token, backHref, doneHref, orgCerts }: { token: string; backHref: string; doneHref: string; orgCerts?: string[] }) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [items, setItems] = useState<ReplyItem[]>([]);
  const [common, setCommon] = useState<ReplyCommon>(EMPTY_COMMON);
  const [note, setNote] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const revision = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>(0);
  const saveAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`/api/quote/${token}`)
      .then((r) => r.json())
      .then((d: Loaded & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setItems(d.draft?.items ?? d.rfq.rows.map((r) => ({ seq: r.seq, avail: "", amount: "", weeks: "", reason: "" })));
        setCommon(d.draft?.common ?? EMPTY_COMMON);
        setNote(d.draft?.note ?? "");
        setPdfName(d.draft?.pdfName ?? "");
        if (d.draft && !d.draft.prefilled) setSaved("saved");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }, [token]);

  // 화면을 떠날 때 대기 중인 자동 저장을 정리한다
  useEffect(() => () => { window.clearTimeout(timer.current); saveAbort.current?.abort(); }, []);

  const readOnly = !!(data?.expired || data?.locked || data?.closed || data?.declined);
  const isSubmitted = data?.draft?.status === "submitted";

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || pdf) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pdf]);
  const leave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if ((dirty || pdf) && !window.confirm("아직 저장·제출하지 않은 변경사항 또는 첨부가 있습니다. 이 화면을 나갈까요?")) e.preventDefault();
  };
  const queueSave = (nextItems: ReplyItem[], nextNote: string, nextCommon: ReplyCommon) => {
    if (readOnly) return;
    setDirty(true);
    const current = ++revision.current;
    if (isSubmitted) return;
    setSaved("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      saveAbort.current?.abort();
      const ac = new AbortController();
      saveAbort.current = ac;
      const ok = await fetch(`/api/quote/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: nextItems, note: nextNote, common: nextCommon }),
        signal: ac.signal,
      })
        .then((r) => r.ok)
        .catch(() => (ac.signal.aborted ? null : false));
      if (ok === null || current !== revision.current) return; // 제출로 취소됨
      setSaved(ok ? "saved" : "failed");
      if (ok) setDirty(false);
    }, 800);
  };

  const update = (seq: number, patch: Partial<ReplyItem>) => {
    if (readOnly) return;
    const next = items.map((it) => {
      if (it.seq !== seq) return it;
      const n = { ...it, ...patch };
      // Edited values change the source; review checks require explicit confirmation.
      if ("amount" in patch || "weeks" in patch || "unitPrice" in patch || "sampleCount" in patch || "design" in patch) {
        n.source = "manual";
        // Only the explicit review action clears outstanding condition checks.
      }
      if (n.unit === "per_sample" && n.unitPrice && n.sampleCount) n.amount = String(Number(n.unitPrice) * Number(n.sampleCount));
      return n;
    });
    setItems(next);
    queueSave(next, note, common);
  };
  const confirmChecks = (seq: number) => update(seq, { checks: [] });
  const updCommon = (patch: Partial<ReplyCommon>) => {
    if (readOnly) return;
    const next = { ...common, ...patch };
    setCommon(next);
    queueSave(items, note, next);
  };

  const pickPdf = (f: File | null) => {
    setError("");
    if (!f) return setPdf(null);
    if (f.size > MAX_PDF) return setError("PDF는 20MB 이하만 첨부할 수 있습니다.");
    if (f.type && f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return setError("PDF 파일만 첨부할 수 있습니다.");
    setPdf(f); setDirty(true);
  };

  if (error && !data) {
    return (
      <div className="empty">
        <b>링크를 열 수 없습니다</b>
        {error}
        <div style={{ marginTop: 14 }}>
          <Link href={backHref} className="b2">돌아가기</Link>
        </div>
      </div>
    );
  }
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>불러오는 중…</div>;

  const { rfq } = data;
  const done = (it: ReplyItem) => it.avail === "불가" ? !!it.reason : !!(it.avail && it.amount && it.weeks && (it.avail === "가능" || it.reason));
  const filled = items.filter(done).length;
  const total = items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0);
  const maxW = Math.max(0, ...items.map((it) => (it.avail !== "불가" && it.weeks ? Number(it.weeks) : 0)));
  const allNo = items.length > 0 && items.every((it) => it.avail === "불가");
  const commonOk = !!common.startDate;
  const pending = items.filter((it) => it.checks && it.checks.length).length;
  const canSubmit = !readOnly && filled === items.length && !allNo && commonOk && pending === 0 && (!!pdf || !!pdfName);
  const blockedLabel = readOnly
    ? "수정할 수 없습니다"
    : filled < items.length
      ? `항목 ${items.length - filled}개 남음`
      : allNo
        ? "전 항목 불가 - 견적 참여하지 않기"
        : pending
          ? `확인 필요 ${pending}건 남음`
        : !commonOk
          ? "착수 가능일을 입력하세요"
          : !pdf && !pdfName
            ? "PDF를 첨부하세요"
            : isSubmitted
              ? "수정 내용 제출"
              : "견적 제출";

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError("");
    // 제출본이 자동 저장에 덮이지 않도록 대기 중·진행 중인 초안 저장을 멈춘다
    window.clearTimeout(timer.current);
    saveAbort.current?.abort();
    try {
      let pdfRef: { path: string; name: string; size: number } | undefined;
      if (pdf) {
        const u = await fetch(`/api/quote/${token}/upload-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: pdf.name, size: pdf.size, type: pdf.type }) });
        const ud = (await u.json().catch(() => ({}))) as { path?: string; signedUrl?: string; error?: string };
        if (!u.ok || !ud.path || !ud.signedUrl) throw new Error(ud.error || "PDF 업로드 준비에 실패했습니다.");
        if (!(await uploadToSigned({ name: pdf.name, path: ud.path, signedUrl: ud.signedUrl }, pdf))) throw new Error("PDF 업로드에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
        pdfRef = { path: ud.path, name: pdf.name, size: pdf.size };
      }
      const res = await fetch(`/api/quote/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, note, common, pdf: pdfRef }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "제출에 실패했습니다.");
      setDirty(false); setPdf(null);
      router.push(`${doneHref}${doneHref.includes("?") ? "&" : "?"}t=${total}&w=${maxW}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했습니다.");
      setBusy(false);
    }
  };

  const savedLabel = isSubmitted && dirty ? "수정 내용 미제출" : saved === "saving" ? "저장 중…" : saved === "saved" ? (isSubmitted ? "제출본" : "초안 저장됨") : saved === "failed" ? "저장 실패" : "";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Link href={backHref} onClick={leave} className="crumb" style={{ margin: 0 }}>
          <Caret size={14} /> 요청서
        </Link>
        <span role="status" style={{ fontSize: 12, fontWeight: 600, color: saved === "saved" ? "var(--ok)" : saved === "failed" ? "var(--err)" : "var(--muted)" }}>{readOnly ? "" : savedLabel}</span>
      </div>
      {saved === "failed" && !readOnly && !isSubmitted && <div className="note note--err"><span>초안을 저장하지 못했습니다. 화면을 닫기 전에 다시 저장해 주세요.</span><button className="b2" type="button" onClick={() => queueSave(items, note, common)}>초안 다시 저장</button></div>}
      {pdf && <p className="fld__help">첨부파일은 견적 제출 시 업로드됩니다. 화면을 닫으면 다시 선택해야 합니다.</p>}
      <div className="ph">
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>견적 회신 · {rfq.no} · {filled} / {items.length} 항목 완료</p>
          <h1>가능 여부·금액·기간을 채우세요</h1>
          <p>요청된 시험별로 수행 가능 여부와 견적을 입력하세요. 금액은 VAT 별도입니다. 예상 소요기간은 동물 입고부터 보고서 초안 발행까지 주 단위로 적어 주세요.</p>
        </div>
      </div>

      {data.draft?.prefilled && !readOnly && (
        <div className="note" style={{ marginBottom: 16 }}>
          <b>카탈로그로 초안을 채웠습니다.</b>{" "}
          {pending ? `요청 조건이 등록한 기본 조건와 다른 항목 ${pending}건에 "확인 필요"가 붙어 있습니다. 금액·기간을 확인하고 제출하세요.` : "금액·기간이 맞는지 보고 바로 제출할 수 있습니다."}{" "}
          <Link href="/cro/catalog" style={{ color: "var(--brand)", fontWeight: 600 }}>카탈로그 수정</Link>
        </div>
      )}

      {rfq.ask.length > 0 && (
        <div className="note note--tint" style={{ marginBottom: 16, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <b>회신에서 설명해 주세요</b>
          <span style={{ fontSize: 13 }}>가이드라인이 정하지 않아 기관마다 다른 부분입니다. 해당 항목의 설계 설명 칸이나 전달 사항에 기관의 방식을 적어 주세요. 의뢰자는 기관별 설명을 나란히 봅니다.</span>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
            {rfq.ask.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}

      {readOnly && (
        <div className="note note--err" style={{ marginBottom: 16 }}>
          {data.expired ? "이 링크는 만료되어 열람만 할 수 있습니다. 연장이 필요하면 hello@danchu.kr로 알려주세요." : data.closed ? "의뢰자가 CRO 선택을 마쳐 회신이 닫혔습니다." : data.declined ? "견적 참여하지 않기된 요청입니다." : "회신 기한이 지나 제출한 견적을 수정할 수 없습니다."}
        </div>
      )}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 12 }}>
          {rfq.rows.map((r) => {
            const it = items.find((x) => x.seq === r.seq)!;
            const no = it.avail === "불가";
            const needReason = it.avail === "불가" || it.avail === "조건부 가능";
            const perSample = it.unit === "per_sample";
            const checks = it.checks ?? [];
            const src = it.source === "catalog" ? "카탈로그" : it.source === "learned" ? "최근 회신" : "";
            return (
              <div id={`reply-item-${r.seq}`} tabIndex={-1} key={r.seq} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, borderColor: checks.length ? "var(--warn, #C98A1B)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.cond || r.category}</span>
                    {(src || checks.length > 0) && (
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {src && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--surface2, #F1EEE8)", color: "var(--muted)" }}>{src}</span>}
                        {checks.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--tint)", color: "var(--brand)" }}>확인 필요 · {checks.join(" · ")}</span>}
                      </span>
                    )}
                  </div>
                  <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: done(it) && !checks.length ? "var(--brand)" : "var(--dash)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckMark size={12} />
                  </span>
                </div>
                {checks.length > 0 && !readOnly && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--body)", background: "var(--tint)", borderRadius: 10, padding: "8px 12px" }}>
                    <span>요청 조건이 등록한 기본 조건와 다릅니다. 금액·기간을 이 조건에 맞게 고치거나, 등록한 조건을 모두 확인한 뒤 아래 버튼을 누르세요.</span>
                    <button type="button" className="b2 bsm" style={{ flex: "none" }} disabled={busy} onClick={() => confirmChecks(r.seq)}>현재 금액과 기간으로 회신</button>
                  </div>
                )}
                <div className="seg seg--full" role="group" aria-label={`${r.name} 수행 가능 여부`}>
                  {AVAILS.map((a) => (
                    <button key={a} type="button" aria-pressed={it.avail === a} data-no={a === "불가" ? "1" : "0"} disabled={readOnly || busy} onClick={() => update(r.seq, { avail: a })}>{a}</button>
                  ))}
                </div>
                {perSample && !no && (
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 8 }}>
                    <div className="numin">
                      <input type="text" inputMode="numeric" placeholder="검체당 단가" style={{ paddingRight: 70 }} disabled={readOnly || busy} value={it.unitPrice ? Number(it.unitPrice).toLocaleString("ko-KR") : ""} onChange={(e) => update(r.seq, { unitPrice: e.target.value.replace(/[^\d]/g, "").slice(0, 13) })} aria-label={`${r.name} 검체당 단가`} />
                      <span>원/검체</span>
                    </div>
                    <div className="numin">
                      <input type="text" inputMode="numeric" placeholder="검체 수" disabled={readOnly || busy} value={it.sampleCount ?? ""} onChange={(e) => update(r.seq, { sampleCount: e.target.value.replace(/[^\d]/g, "").slice(0, 6) })} aria-label={`${r.name} 검체 수`} />
                      <span>건</span>
                    </div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 8 }}>
                  <div className="numin">
                    <input type="text" inputMode="numeric" placeholder={perSample ? "총액 (단가×검체 수)" : "금액"} disabled={no || readOnly || busy || (perSample && !!it.unitPrice && !!it.sampleCount)} value={it.amount ? Number(it.amount).toLocaleString("ko-KR") : ""} onChange={(e) => update(r.seq, { amount: e.target.value.replace(/[^\d]/g, "").slice(0, 13) })} aria-label={`${r.name} 금액`} />
                    <span>원</span>
                  </div>
                  <div className="numin">
                    <input type="text" inputMode="numeric" placeholder="예상 소요기간" disabled={no || readOnly || busy} value={it.weeks} onChange={(e) => update(r.seq, { weeks: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })} aria-label={`${r.name} 예상 소요기간`} />
                    <span>주</span>
                  </div>
                </div>
                {!no && <DesignEditor value={it.design ?? {}} category={r.category} disabled={readOnly || busy} onChange={(d) => update(r.seq, { design: d })} />}
                {!no && r.category === EFFICACY_CAT && <EfficacyCosts value={it.design ?? {}} disabled={readOnly || busy} onChange={(d, total) => update(r.seq, total ? { design: d, amount: total } : { design: d })} />}
                {needReason && (
                  <input className="inp" style={{ height: 44, fontSize: 14 }} placeholder={it.avail === "불가" ? "불가 사유 (필수)" : "조건 · 조건 충족 시 기준 금액 (필수)"} disabled={readOnly || busy} value={it.reason ?? ""} onChange={(e) => update(r.seq, { reason: e.target.value.slice(0, 500) })} aria-label={`${r.name} 사유`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="card card--pad stack" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>공통 조건</h2>
            <div className="grid2">
              <div className="fld">
                <label className="fld__lab" htmlFor="valid">견적 유효기간 <span style={{ fontWeight: 400, color: "var(--muted)" }}>(비우면 제출일 +30일)</span></label>
                <input id="valid" className="inp" type="date" disabled={readOnly || busy} value={common.validUntil} onChange={(e) => updCommon({ validUntil: e.target.value })} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor="start">전체 착수 가능일<span className="req">*</span></label>
                <input id="start" className="inp" type="date" disabled={readOnly || busy} value={common.startDate} onChange={(e) => updCommon({ startDate: e.target.value })} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor="pay">결제 조건 (선급 · 중도 · 잔금 %)</label>
                <input id="pay" className="inp" placeholder="예: 30 · 40 · 30" disabled={readOnly || busy} value={common.payTerms} onChange={(e) => updCommon({ payTerms: e.target.value.slice(0, 60) })} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor="qty">시험물질 필요량</label>
                <input id="qty" className="inp" placeholder="예: 원료 40 g + 예비 10 g" disabled={readOnly || busy} value={common.substanceQty} onChange={(e) => updCommon({ substanceQty: e.target.value.slice(0, 120) })} />
              </div>
            </div>
            <div className="fld">
              <span className="fld__lab">보고서 언어</span>
              <div className="chips">
                {REPORT_LANGS.map((l) => (
                  <button key={l} type="button" className="chip" aria-pressed={common.reportLang === l} disabled={readOnly || busy} onClick={() => updCommon({ reportLang: l })}>{l}</button>
                ))}
              </div>
            </div>
            <div className="fld">
              <span className="fld__lab">기본 포함 항목</span>
              <span className="fld__help">총액에 포함된 것만 선택하세요. 비교표의 핵심 행입니다.</span>
              <div className="chips">
                {INCL_KEYS.map((k) => {
                  const on = common.includes.includes(k);
                  return (
                    <button key={k} type="button" className="chip" aria-pressed={on} disabled={readOnly || busy} onClick={() => updCommon({ includes: on ? common.includes.filter((x) => x !== k) : [...common.includes, k] })}>{k}</button>
                  );
                })}
              </div>
            </div>
            {orgCerts && (
              <div className="fld">
                <span className="fld__lab">보유 GLP 인증 (기관 정보에서 자동)</span>
                <span style={{ fontSize: 14, color: "var(--body)" }}>{orgCerts.length ? orgCerts.join(" · ") : "등록된 인증이 없습니다. 기관 탭에서 등록하세요."}</span>
              </div>
            )}
            <div className="fld">
              <label className="fld__lab" htmlFor="note">제외 항목 · 별도 옵션 · 의뢰자 전달 사항</label>
              <textarea id="note" className="ta" rows={4} disabled={readOnly || busy} value={note} onChange={(e) => { setNote(e.target.value); queueSave(items, e.target.value, common); }} placeholder="예: 영문 보고서 별도 +8,000,000원, 시험물질 보관 비용 미포함, 조직병리 판독 +18,000,000원" />
            </div>
          </div>

          <div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pickPdf(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              disabled={readOnly || busy}
              onClick={() => fileRef.current?.click()}
              style={{ width: "100%", border: `1px dashed ${pdf || pdfName ? "var(--brand)" : "var(--dash)"}`, background: pdf || pdfName ? "var(--tint)" : "var(--wh)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, color: "var(--muted)", textAlign: "left" }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pdf ? pdf.name : pdfName || <>정식 견적서 PDF (원본)<span className="req">*</span></>}
              </span>
              <span style={{ color: "var(--brand)", fontWeight: 600, flex: "none" }}>{readOnly ? "" : pdf || pdfName ? "교체" : "첨부"}</span>
            </button>
            <p className="fld__help" style={{ marginTop: 6 }}>비교표와 PDF가 다르면 PDF가 우선합니다. 단추가 불일치를 발견하면 확인을 요청합니다.</p>
          </div>

          {error && <p className="note note--err" role="alert">{error}</p>}

          <div className="card card--pad stack" style={{ gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>총 견적액 · VAT 별도 · {maxW ? `병렬 수행 ${maxW}주` : "기간 미입력"}</span>
              <span className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{total ? won(total) : "-"}</span>
            </div>
            {!readOnly && (filled < items.length || pending > 0) && <button type="button" className="b2" onClick={() => { const item = items.find((it) => !done(it) || it.checks?.length); if (item) { const target = document.getElementById(`reply-item-${item.seq}`); target?.scrollIntoView({ block: "center" }); target?.focus(); } }}>확인할 항목으로 이동</button>}
            {allNo && !readOnly && <Link href={`${backHref}?decline=1`} onClick={leave} className="b2">견적 참여하지 않기</Link>}
            <button type="button" className="b1 blg bfull" disabled={!canSubmit || busy} onClick={submit}>
              {busy ? "제출 중…" : blockedLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
