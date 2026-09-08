"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Caret, CheckMark } from "@/components/app/ui";
import { EMPTY_COMMON, INCL_KEYS, REPORT_LANGS, type ReplyCommon, type ReplyItem, type RfqView } from "@/lib/cro-data";
import { won } from "@/lib/format";
import { uploadToSigned } from "@/lib/upload";

const AVAILS: ReplyItem["avail"][] = ["가능", "조건부 가능", "불가"];
const MAX_PDF = 20 * 1024 * 1024;

type Loaded = {
  rfq: RfqView;
  draft: { items: ReplyItem[]; note: string; pdfName: string; status: string; common: ReplyCommon } | null;
  expired?: boolean;
  locked?: boolean;
  declined?: boolean;
  closed?: boolean;
};

/**
 * 견적 회신 폼 — 항목별 3칸(+사유) · 공통 조건 · 전달 사항 · 정본 PDF.
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
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>(0);

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
        if (d.draft) setSaved("saved");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }, [token]);

  const readOnly = !!(data?.expired || data?.locked || data?.closed || data?.declined);
  const isSubmitted = data?.draft?.status === "submitted";

  const queueSave = (nextItems: ReplyItem[], nextNote: string, nextCommon: ReplyCommon) => {
    if (readOnly || isSubmitted) return;
    setSaved("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const ok = await fetch(`/api/quote/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: nextItems, note: nextNote, common: nextCommon }),
      })
        .then((r) => r.ok)
        .catch(() => false);
      setSaved(ok ? "saved" : "failed");
    }, 800);
  };

  const update = (seq: number, patch: Partial<ReplyItem>) => {
    if (readOnly) return;
    const next = items.map((it) => (it.seq === seq ? { ...it, ...patch } : it));
    setItems(next);
    queueSave(next, note, common);
  };
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
    setPdf(f);
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
  const commonOk = !!(common.validUntil && common.startDate);
  const canSubmit = !readOnly && filled === items.length && !allNo && commonOk && (!!pdf || !!pdfName);
  const blockedLabel = readOnly
    ? "수정할 수 없습니다"
    : filled < items.length
      ? `항목 ${items.length - filled}개 남음`
      : allNo
        ? "전 항목 불가 — 회신하지 않음으로 처리"
        : !commonOk
          ? "유효기간·착수일을 입력하세요"
          : !pdf && !pdfName
            ? "PDF를 첨부하세요"
            : isSubmitted
              ? "수정 내용 제출"
              : "견적 제출";

  const submit = async () => {
    setBusy(true);
    setError("");
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
      router.push(`${doneHref}${doneHref.includes("?") ? "&" : "?"}t=${total}&w=${maxW}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했습니다.");
      setBusy(false);
    }
  };

  const savedLabel = saved === "saving" ? "저장 중…" : saved === "saved" ? (isSubmitted ? "제출본" : "초안 저장됨") : saved === "failed" ? "저장 실패" : "";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Link href={backHref} className="crumb" style={{ margin: 0 }}>
          <Caret size={14} /> 요청서
        </Link>
        <span style={{ fontSize: 12, fontWeight: 600, color: saved === "saved" ? "var(--ok)" : saved === "failed" ? "var(--err)" : "var(--muted)" }}>{readOnly ? "" : savedLabel}</span>
      </div>
      <div className="ph">
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>견적 회신 · {rfq.no} · {filled} / {items.length} 항목 완료</p>
          <h1>가능 여부·금액·기간을 채우세요</h1>
          <p>행은 요청서에서 자동 생성됩니다. 금액은 VAT 별도, 기간은 투여 개시~최종보고서 기준(주).</p>
        </div>
      </div>

      {readOnly && (
        <div className="note note--err" style={{ marginBottom: 16 }}>
          {data.expired ? "이 링크는 만료되어 열람만 할 수 있습니다. 연장이 필요하면 hello@danchu.kr로 알려주세요." : data.closed ? "의뢰자가 CRO 선택을 마쳐 회신이 닫혔습니다." : data.declined ? "회신하지 않음으로 처리된 요청입니다." : "회신 기한이 지나 제출한 견적을 수정할 수 없습니다."}
        </div>
      )}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 12 }}>
          {rfq.rows.map((r) => {
            const it = items.find((x) => x.seq === r.seq)!;
            const no = it.avail === "불가";
            const needReason = it.avail === "불가" || it.avail === "조건부 가능";
            return (
              <div key={r.seq} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.cond || r.category}</span>
                  </div>
                  <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: done(it) ? "var(--brand)" : "var(--dash)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckMark size={12} />
                  </span>
                </div>
                <div className="seg seg--full" role="radiogroup" aria-label="수행 가능 여부">
                  {AVAILS.map((a) => (
                    <button key={a} type="button" aria-pressed={it.avail === a} data-no={a === "불가" ? "1" : "0"} disabled={readOnly} onClick={() => update(r.seq, { avail: a })}>{a}</button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 8 }}>
                  <div className="numin">
                    <input type="text" inputMode="numeric" placeholder="금액" disabled={no || readOnly} value={it.amount ? Number(it.amount).toLocaleString("ko-KR") : ""} onChange={(e) => update(r.seq, { amount: e.target.value.replace(/[^\d]/g, "").slice(0, 13) })} aria-label={`${r.name} 금액`} />
                    <span>원</span>
                  </div>
                  <div className="numin">
                    <input type="text" inputMode="numeric" placeholder="기간" disabled={no || readOnly} value={it.weeks} onChange={(e) => update(r.seq, { weeks: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })} aria-label={`${r.name} 기간`} />
                    <span>주</span>
                  </div>
                </div>
                {needReason && (
                  <input className="inp" style={{ height: 44, fontSize: 14 }} placeholder={it.avail === "불가" ? "불가 사유 (필수)" : "조건 · 조건 충족 시 기준 금액 (필수)"} disabled={readOnly} value={it.reason ?? ""} onChange={(e) => update(r.seq, { reason: e.target.value.slice(0, 500) })} aria-label={`${r.name} 사유`} />
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
                <label className="fld__lab" htmlFor="valid">견적 유효기간<span className="req">*</span></label>
                <input id="valid" className="inp" type="date" disabled={readOnly} value={common.validUntil} onChange={(e) => updCommon({ validUntil: e.target.value })} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor="start">전체 착수 가능일<span className="req">*</span></label>
                <input id="start" className="inp" type="date" disabled={readOnly} value={common.startDate} onChange={(e) => updCommon({ startDate: e.target.value })} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor="pay">결제 조건 (선급 · 중도 · 잔금 %)</label>
                <input id="pay" className="inp" placeholder="예: 30 · 40 · 30" disabled={readOnly} value={common.payTerms} onChange={(e) => updCommon({ payTerms: e.target.value.slice(0, 60) })} />
              </div>
              <div className="fld">
                <label className="fld__lab" htmlFor="qty">시험물질 필요량</label>
                <input id="qty" className="inp" placeholder="예: 원료 40 g + 예비 10 g" disabled={readOnly} value={common.substanceQty} onChange={(e) => updCommon({ substanceQty: e.target.value.slice(0, 120) })} />
              </div>
            </div>
            <div className="fld">
              <span className="fld__lab">보고서 언어</span>
              <div className="chips">
                {REPORT_LANGS.map((l) => (
                  <button key={l} type="button" className="chip" aria-pressed={common.reportLang === l} disabled={readOnly} onClick={() => updCommon({ reportLang: l })}>{l}</button>
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
                    <button key={k} type="button" className="chip" aria-pressed={on} disabled={readOnly} onClick={() => updCommon({ includes: on ? common.includes.filter((x) => x !== k) : [...common.includes, k] })}>{k}</button>
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
              <textarea id="note" className="ta" rows={4} disabled={readOnly} value={note} onChange={(e) => { setNote(e.target.value); queueSave(items, e.target.value, common); }} placeholder="예: 영문 보고서 별도 +8,000,000원, 시험물질 보관 비용 미포함, 조직병리 판독 +18,000,000원" />
            </div>
          </div>

          <div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pickPdf(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              disabled={readOnly}
              onClick={() => fileRef.current?.click()}
              style={{ width: "100%", border: `1px dashed ${pdf || pdfName ? "var(--brand)" : "var(--dash)"}`, background: pdf || pdfName ? "var(--tint)" : "var(--wh)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, color: "var(--muted)", textAlign: "left" }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pdf ? pdf.name : pdfName || <>정식 견적서 PDF (정본)<span className="req">*</span></>}
              </span>
              <span style={{ color: "var(--brand)", fontWeight: 600, flex: "none" }}>{readOnly ? "" : pdf || pdfName ? "교체" : "첨부"}</span>
            </button>
            <p className="fld__help" style={{ marginTop: 6 }}>비교표와 PDF가 다르면 PDF가 우선합니다. 단추가 불일치를 발견하면 확인을 요청합니다.</p>
          </div>

          {error && <p className="note note--err" role="alert">{error}</p>}

          <div className="card card--pad stack" style={{ gap: 12, position: "sticky", bottom: "calc(72px + var(--bot))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>총 견적액 · VAT 별도 · {maxW ? `병렬 수행 ${maxW}주` : "기간 미입력"}</span>
              <span className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{total ? won(total) : "—"}</span>
            </div>
            <button type="button" className="b1 blg bfull" disabled={!canSubmit || busy} onClick={submit}>
              {busy ? "제출 중…" : blockedLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
