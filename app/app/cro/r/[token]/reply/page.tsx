"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Caret, CheckMark } from "@/components/app/ui";
import type { ReplyItem, RfqView } from "@/lib/cro-data";
import { won } from "@/lib/app-data";

const AVAILS: ReplyItem["avail"][] = ["가능", "조건부 가능", "불가"];

type Loaded = { rfq: RfqView; draft: { items: ReplyItem[]; note: string; pdfName: string; status: string } | null };

export default function Reply({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [items, setItems] = useState<ReplyItem[]>([]);
  const [note, setNote] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
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
        setItems(d.draft?.items ?? d.rfq.rows.map((r) => ({ seq: r.seq, avail: "", amount: "", weeks: "" })));
        setNote(d.draft?.note ?? "");
        setPdfName(d.draft?.pdfName ?? "");
        if (d.draft) setSaved("saved");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }, [token]);

  /** 입력이 멈추고 800ms 뒤 초안 저장 */
  const queueSave = (nextItems: ReplyItem[], nextNote: string) => {
    setSaved("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await fetch(`/api/quote/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: nextItems, note: nextNote }),
      }).catch(() => null);
      setSaved("saved");
    }, 800);
  };

  const update = (seq: number, patch: Partial<ReplyItem>) => {
    const next = items.map((it) => (it.seq === seq ? { ...it, ...patch } : it));
    setItems(next);
    queueSave(next, note);
  };

  if (error && !data) {
    return (
      <div className="scr scr--wh" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 700 }}>링크를 열 수 없습니다</p>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>{error}</p>
        <Link href="/app/cro" className="b2" style={{ maxWidth: 200 }}>받은 요청으로</Link>
      </div>
    );
  }
  if (!data) return <div className="scr scr--wh" />;

  const { rfq } = data;
  const done = (it: ReplyItem) => it.avail === "불가" || (it.avail && it.amount && it.weeks);
  const filled = items.filter(done).length;
  const total = items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0);
  const maxW = Math.max(0, ...items.map((it) => (it.avail !== "불가" && it.weeks ? Number(it.weeks) : 0)));
  const allNo = items.length > 0 && items.every((it) => it.avail === "불가");
  const canSubmit = filled === items.length && !allNo && (!!pdf || !!pdfName);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ items, note }));
      if (pdf) fd.append("pdf", pdf, pdf.name);
      const res = await fetch(`/api/quote/${token}`, { method: "POST", body: fd });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "제출에 실패했습니다.");
      router.push(`/app/cro/r/${token}/reply/done?t=${total}&w=${maxW}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="scr scr--wh">
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--wh)", paddingTop: "calc(var(--top) + 6px)", borderBottom: "1px solid var(--cline)" }}>
        <div className="hd__bar" style={{ padding: "0 20px" }}>
          <Link href={`/app/cro/r/${token}`} className="hd__back">
            <Caret />
            요청서
          </Link>
          <span className="hd__ttl tnum">견적 회신 · {rfq.no}</span>
          <span style={{ minWidth: 56, textAlign: "right", fontSize: 12, fontWeight: 600, color: saved === "saved" ? "var(--ok)" : "var(--muted)" }}>
            {saved === "saving" ? "저장 중…" : saved === "saved" ? "저장됨" : ""}
          </span>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--brand)" }}>항목별 견적 · {filled} / {items.length} 항목 완료</p>
        <h1 style={{ fontSize: 22, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.02em" }}>가능 여부·금액·기간만 채우세요</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>행은 요청서에서 자동 생성됩니다. 금액은 VAT 별도, 기간은 투여 개시~최종보고서 기준(주).</p>
      </div>

      <div className="pad" style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {rfq.rows.map((r) => {
          const it = items.find((x) => x.seq === r.seq)!;
          const no = it.avail === "불가";
          return (
            <div key={r.seq} style={{ border: "1px solid var(--cline)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
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
                  <button key={a} type="button" aria-pressed={it.avail === a} data-no={a === "불가" ? "1" : "0"} onClick={() => update(r.seq, { avail: a })}>
                    {a}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 8 }}>
                <div className="numin">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="금액"
                    disabled={no}
                    value={it.amount ? Number(it.amount).toLocaleString("ko-KR") : ""}
                    onChange={(e) => update(r.seq, { amount: e.target.value.replace(/[^\d]/g, "").slice(0, 13) })}
                    aria-label={`${r.name} 금액`}
                  />
                  <span>원</span>
                </div>
                <div className="numin">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="기간"
                    disabled={no}
                    value={it.weeks}
                    onChange={(e) => update(r.seq, { weeks: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                    aria-label={`${r.name} 기간`}
                  />
                  <span>주</span>
                </div>
              </div>
              <button type="button" className="btxt" style={{ alignSelf: "flex-start", padding: 0, fontSize: 13 }}>
                + 설계·포함 항목·별도 옵션 (선택)
              </button>
            </div>
          );
        })}
      </div>

      <div className="pad" style={{ paddingTop: 12 }}>
        <div style={{ border: "1px solid var(--cline)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="fld__lab" htmlFor="note">제외 항목 · 의뢰자 전달 사항</label>
          <textarea
            id="note"
            className="ta"
            rows={3}
            style={{ fontSize: 16, padding: "12px 14px", borderRadius: 10 }}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              queueSave(items, e.target.value);
            }}
            placeholder="예: 영문 보고서 별도 +8,000,000원, 시험물질 보관 비용 미포함"
          />
        </div>
      </div>

      <div className="pad" style={{ padding: "12px 20px 24px" }}>
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ width: "100%", border: `1px dashed ${pdf || pdfName ? "var(--brand)" : "var(--dash)"}`, background: pdf || pdfName ? "var(--tint)" : "none", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, color: "var(--muted)", textAlign: "left" }}
        >
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pdf ? pdf.name : pdfName || <>정식 견적서 PDF (정본)<span className="req">*</span></>}
          </span>
          <span style={{ color: "var(--brand)", fontWeight: 600, flex: "none" }}>{pdf || pdfName ? "교체" : "첨부"}</span>
        </button>
        {error && (
          <p role="alert" style={{ marginTop: 10, padding: "12px 16px", borderRadius: 10, background: "var(--err-bg)", color: "var(--err)", fontSize: 14 }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ position: "sticky", bottom: 0, marginTop: "auto", background: "var(--wh)", borderTop: "1px solid var(--cline)", padding: "14px 20px calc(20px + var(--bot))", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--muted)", flex: 1, minWidth: 0 }}>총 견적액 · VAT 별도 · {maxW ? `병렬 수행 ${maxW}주` : "기간 미입력"}</span>
          <span className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", flex: "none" }}>{total ? won(total) : "—"}</span>
        </div>
        <button type="button" className="b1" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? "제출 중…" : filled < items.length ? `항목 ${items.length - filled}개 남음` : allNo ? "전 항목 불가 — 회신하지 않음으로 처리" : !pdf && !pdfName ? "PDF를 첨부하세요" : "견적 제출"}
        </button>
      </div>
    </div>
  );
}
