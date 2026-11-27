"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Caret, CheckMark } from "@/components/app/ui";
import { EMPTY_COMMON, INCL_KEYS, REPORT_LANGS, type ReplyCommon, type ReplyItem, type RfqView, type ScheduleStep, STEP_SEQ_BASE } from "@/lib/cro-data";
import { planQuote } from "@/lib/schedule";
import { ItemSchedule, ScheduleCard } from "@/components/cro/ReplySchedule";
import { md } from "@/lib/format";
import { hm, replyPdfError, saveStatus, validUntilError, type SaveState } from "@/lib/cro-due";
import { Ban, testsLine } from "./CroStory";
import { CroSkeleton } from "./CroSkeleton";
import { WithdrawButton } from "./Participation";
import { uploadToSigned } from "@/lib/upload";
import { designSummary, EXPLAIN_FIELDS, ROUTES, SPECIES } from "@/lib/catalog";
import type { Cat } from "@/lib/rfq-schema";
import { EfficacyCosts } from "@/components/cro/EfficacyCosts";
import { PayScheduleField } from "@/components/cro/PayScheduleField";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EFFICACY_CAT } from "@/lib/efficacy";
import "./layout-request.css";

const AVAILS: ReplyItem["avail"][] = ["가능", "조건부 가능", "불가"];

type Design = Record<string, unknown>;
const dnum = (d: Design, k: string) => (typeof d[k] === "number" ? String(d[k]) : typeof d[k] === "string" ? (d[k] as string) : "");
const dstr = (d: Design, k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
const dspecies = (d: Design) => (Array.isArray(d.species) ? (d.species as string[]) : []);

/** 항목별 설계 요약 - 접힌 상태에서는 한 줄, 펼치면 칸별 수정 */
function DesignEditor({ value, category, disabled, onChange }: { value: Design; category: string; disabled: boolean; onChange: (d: Design) => void }) {
  const [open, setOpen] = useState(false);
  const memoId = useId();
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
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>설계 · {summary || "미입력 (등록한 기본 조건을 적어 두면 비교표에 표시돼요)"}</span>
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
          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--brand)" }}>시험 설계와 비용 조건 <span style={{ fontWeight: 400, color: "var(--muted)" }}>{filledExp} / {explain.length} · 비교표에 나란히 표시돼요</span></summary>
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
        <label className="fld__lab" style={{ fontSize: 12 }} htmlFor={memoId}>그 밖의 설명 <span style={{ fontWeight: 400, color: "var(--muted)" }}>· 의뢰자의 견적 상세에 그대로 표시</span></label>
        <textarea id={memoId} className="ta" rows={2} style={{ fontSize: 13 }} placeholder="예: 회복 동물은 대조군·고용량군의 마지막 5마리/성 지정. 분석법 검증 1회 포함." disabled={disabled} value={dstr(value, "note")} onChange={(e) => onChange({ ...value, note: e.target.value.slice(0, 1000) })} />
      </div>
    </div>
  );
}

export type ReplyLoaded = {
  rfq: RfqView;
  draft: { items: ReplyItem[]; note: string; pdfName: string; status: string; common: ReplyCommon; prefilled?: boolean; steps?: ScheduleStep[] } | null;
  expired?: boolean;
  locked?: boolean;
  declined?: boolean;
  closedMessage?: string;
  closed?: boolean;
  /** 참여 전이면 false (0023). 회신 화면은 참여 뒤에만 열리지만, 그 사이 상태가 바뀐 경우를 막는다 */
  joined?: boolean;
  withdrawn?: boolean;
  /** 참여 전 불참을 되돌릴 수 있는지 (참여 결정 기한 전, 2026-10-20 결정 3) */
  canRejoin?: boolean;
};

/**
 * 견적 회신 폼 (시안 검토판 c-reply · q-reply, 2026-11-27). 항목별 가능 여부·금액·기간(+사유) · 공통 조건 · 지급 조건 · 전체 일정,
 * 오른쪽에 요청 요약 · 견적서 PDF(선택, 1개, 20MB) · 견적서. 아래 줄에 합계 · 참여 철회 · 임시 저장 · 회신 제출.
 * 초안은 800ms 뒤 서버에 자동 저장한다(PUT /api/quote/[token]. 서버 초안이 있어 브라우저 저장소는 쓰지 않는다). 제목 줄에 "저장됨 14:02",
 * 연결이 끊기면 위 띠와 "다시 연결". 제출본은 자동 저장으로 덮지 않고 확인 창의 "제출"로만 갱신한다.
 */
/** 견적서 생성 툴(0036)에서 넘어온 금액. 요청의 행 번호마다 시험 합계와 기간 */
/** auto: ?doc= 없이 이 요청의 최근 견적서로 채운 것. 기관이 이미 저장한 회신 초안이 있으면 덮어쓰지 않는다 */
export type DocFill = { docNo: string; href: string; printHref: string; auto?: boolean; lines: { seq: number; amount: number; weeks: number | null; extra?: Record<string, string | string[]> }[] };

/** catalogHref: 시험 목록 링크. null 이면 그 요금제에 시험 목록이 없어 링크를 두지 않는다. preview: 검토 화면(/design-preview)용 예시 데이터. 주면 불러오지 않는다 */
export function ReplyForm({ token, backHref, doneHref, orgCerts, docFill, docLink, catalogHref = "/cro/catalog", preview }: { token: string; backHref: string; doneHref: string; orgCerts?: string[]; docFill?: DocFill; docLink?: { href: string; label: string }; catalogHref?: string | null; preview?: ReplyLoaded }) {
  const router = useRouter();
  const [data, setData] = useState<ReplyLoaded | null>(null);
  const [items, setItems] = useState<ReplyItem[]>([]);
  const [common, setCommon] = useState<ReplyCommon>(EMPTY_COMMON);
  const [note, setNote] = useState("");
  const [steps, setSteps] = useState<ScheduleStep[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [saved, setSaved] = useState<SaveState>("idle");
  // 이 화면에서 마지막으로 저장한 시각. 불러온 초안은 저장된 시각을 모르므로 "저장됨"만 보인다
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pdfBad, setPdfBad] = useState<{ name: string; size: number; err: string } | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  // 지급 조건 줄 검사 결과 (PayScheduleField 가 올린다). 저장된 값은 늘 올바른 줄이라 처음은 없음
  const [payErr, setPayErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const revision = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>(0);
  const saveAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    (preview ? Promise.resolve(preview) : fetch(`/api/quote/${token}`).then((r) => r.json()))
      .then((d: ReplyLoaded & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        if (d.joined === false) {
          // 참여 전 요약에는 회신 표를 채울 내용이 없다. 요청 화면으로 돌려보내 참여를 먼저 결정하게 한다
          router.replace(backHref);
          return;
        }
        setData(d);
        setItems(d.draft?.items ?? d.rfq.rows.map((r) => ({ seq: r.seq, avail: "", amount: "", weeks: "", reason: "" })));
        setCommon(d.draft?.common ?? EMPTY_COMMON);
        setNote(d.draft?.note ?? "");
        setSteps(d.draft?.steps ?? []);
        setPdfName(d.draft?.pdfName ?? "");
        if (d.draft && !d.draft.prefilled) setSaved("saved");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, [token, backHref, router, preview]);

  // 견적서에서 "회신 보내기"로 왔으면 시험별 금액·기간을 한 번 채운다 (요청 행 번호가 같은 시험만)
  const filledFromDoc = useRef(false);
  const [docApplied, setDocApplied] = useState(0);
  useEffect(() => {
    if (!docFill || !data || filledFromDoc.current || data.expired || data.locked || data.closed || data.declined) return;
    filledFromDoc.current = true;
    if (docFill.auto && data.draft && !data.draft.prefilled) return;
    const by = new Map(docFill.lines.map((l) => [l.seq, l]));
    let count = 0;
    const next = items.map((it) => {
      const l = by.get(it.seq);
      if (!l) return it;
      count++;
      // 견적서의 설계 설명(군 구성·일정·비용 다섯 칸·고친 이유)이 회신 설계 칸을 채운다. 견적서가 주지 않은 칸은 그대로 둔다
      const prev = (it.design?.extra && typeof it.design.extra === "object" ? it.design.extra : {}) as Record<string, unknown>;
      const extra = { ...prev, ...(l.extra ?? {}) };
      return { ...it, avail: it.avail === "조건부 가능" ? it.avail : "가능" as const, amount: String(l.amount), weeks: l.weeks ? String(l.weeks) : it.weeks, unit: "total" as const, unitPrice: "", sampleCount: "", source: "manual" as const, checks: [], design: { ...(it.design ?? {}), extra } };
    });
    if (!count) return;
    setItems(next);
    setDocApplied(count);
    queueSave(next, note, common);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docFill, data]);

  // 화면을 떠날 때 대기 중인 자동 저장을 정리한다
  useEffect(() => () => { window.clearTimeout(timer.current); saveAbort.current?.abort(); }, []);

  const readOnly = !!(data?.expired || data?.locked || data?.closed || data?.declined);
  const isSubmitted = data?.draft?.status === "submitted";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || pdf) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pdf]);
  const confirm = useConfirm();
  // 확인 창은 비동기라 링크 이동을 먼저 막고, "나가기"를 고르면 같은 주소로 보낸다 (시안 검토판 c-reply~leave)
  const leave = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!(dirty || pdf) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const href = e.currentTarget.getAttribute("href");
    const body = pdf ? "고른 견적서 PDF는 제출할 때 올라가므로 다시 골라야 합니다." : savedAt ? `${hm(savedAt)}까지 입력한 내용은 저장되어 있습니다.` : "저장하지 않은 내용은 사라집니다.";
    if (href && (await confirm({ title: "작성 중인 회신에서 나갈까요?", body, confirmLabel: "나가기", cancelLabel: "계속 작성" }))) router.push(href);
  };
  const queueSave = (nextItems: ReplyItem[], nextNote: string, nextCommon: ReplyCommon, nextSteps: ScheduleStep[] = steps, delay = 800) => {
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
        body: JSON.stringify({ items: nextItems, note: nextNote, common: nextCommon, steps: nextSteps }),
        signal: ac.signal,
      })
        .then((r) => r.ok)
        .catch(() => (ac.signal.aborted ? null : false));
      if (ok === null || current !== revision.current) return; // 제출로 취소됨
      setSaved(ok ? "saved" : "failed");
      if (ok) { setDirty(false); setSavedAt(Date.now()); }
    }, delay);
  };
  const saveNow = () => queueSave(items, note, common, steps, 0);
  // 연결이 끊기면 저장을 멈췄다고 알리고, 다시 연결되면 바로 저장한다 (시안 검토판 c-reply~off)
  const pendingRef = useRef(false);
  useEffect(() => { pendingRef.current = dirty && !isSubmitted && !readOnly; });
  useEffect(() => {
    const off = () => { if (pendingRef.current) setSaved("failed"); };
    const on = () => { if (pendingRef.current) document.getElementById("reply-resave")?.click(); };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);

  const update = (seq: number, patch: Partial<ReplyItem>) => {
    if (readOnly) return;
    const next = items.map((it) => {
      if (it.seq !== seq) return it;
      const n = { ...it, ...patch };
      // Edited values change the source; review checks require explicit confirmation.
      if ("amount" in patch || "weeks" in patch || "unitPrice" in patch || "sampleCount" in patch || "design" in patch) {
        n.source = "manual";
      }
      if (n.unit === "per_sample" && n.unitPrice && n.sampleCount) n.amount = String(Number(n.unitPrice) * Number(n.sampleCount));
      return n;
    });
    setItems(next);
    queueSave(next, note, common);
  };
  const confirmChecks = (seq: number) => update(seq, { checks: [] });
  const updSteps = (next: ScheduleStep[]) => {
    if (readOnly) return;
    // 뺀 단계를 앞 단계로 고른 항목에서도 지운다
    const live = new Set(next.map((st) => st.seq));
    const nextItems = items.map((it) => (it.afterSeqs?.some((a) => a >= STEP_SEQ_BASE && !live.has(a)) ? { ...it, afterSeqs: it.afterSeqs.filter((a) => a < STEP_SEQ_BASE || live.has(a)) } : it));
    setSteps(next);
    setItems(nextItems);
    queueSave(nextItems, note, common, next);
  };
  const updCommon = (patch: Partial<ReplyCommon>) => {
    if (readOnly) return;
    const next = { ...common, ...patch };
    setCommon(next);
    queueSave(items, note, next);
  };

  // 견적서 PDF 한 줄 (선택 첨부). 형식·크기가 맞지 않으면 그 줄에 이유와 다시 올리기 (시안 검토판 c-reply~up · ~big)
  const pickPdf = (f: File | null) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    const err = replyPdfError(f);
    setPdfBad(err ? { name: f.name, size: f.size, err } : null);
    if (err) return;
    setPdf(f);
    setDirty(true);
  };

  if (error && !data) {
    return (
      <div className="empty">
        <b>회신을 불러오지 못했어요</b>
        {error}
        <div style={{ marginTop: 14 }}>
          <Link href={backHref} className="b2">돌아가기</Link>
        </div>
      </div>
    );
  }
  if (!data) return <CroSkeleton kind="page" label="회신을 불러오는 중" />;

  const { rfq } = data;
  const done = (it: ReplyItem) => it.avail === "불가" ? !!it.reason : !!(it.avail && it.amount && it.weeks && (it.avail === "가능" || it.reason));
  const filled = items.filter(done).length;
  const total = items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0);
  const maxW = Math.max(0, ...items.map((it) => (it.avail !== "불가" && it.weeks ? Number(it.weeks) : 0)));
  const plan = planQuote({ rows: rfq.rows, items, steps: steps.filter((st) => st.name.trim()) });
  const finalW = plan.finalReportWeek ?? maxW;
  const allNo = items.length > 0 && items.every((it) => it.avail === "불가");
  const validErr = readOnly ? null : validUntilError(common.validUntil, today);
  const startErr = !common.startDate ? "착수 가능일을 골라 주세요." : null;
  const pending = items.filter((it) => it.checks && it.checks.length).length;
  const pdfCount = pdf || pdfName ? 1 : 0;
  // 견적서 PDF는 선택 첨부 (2026-11-18 사용자 결정). 실패한 PDF 줄은 제출을 막지 않는다
  const canSubmit = !readOnly && filled === items.length && !allNo && !startErr && !validErr && !payErr && pending === 0;

  // 막힌 채로 회신 제출을 누르면 첫 오류 칸으로 간다 (시안 검토판 c-reply~ferr)
  const goFirstProblem = () => {
    setTried(true);
    const item = items.find((it) => !done(it) || it.checks?.length);
    const target = item ? document.getElementById(`reply-item-${item.seq}`) : document.getElementById(validErr ? "valid" : startErr ? "start" : "lr-pay");
    target?.scrollIntoView({ block: "center" });
    target?.focus();
  };

  const submit = async () => {
    if (!canSubmit) { goFirstProblem(); return; }
    const ok = await confirm({
      title: "회신을 제출할까요?",
      body: (
        <div className="stack" style={{ gap: 10 }}>
          <p>제출하면 비교표가 열릴 때 의뢰자에게 공개되고, 비교표가 열리기 전까지는 고칠 수 있습니다.</p>
          <dl className="lr-dl">
            <div><dt>시험</dt><dd className="tnum">{items.length}건</dd></div>
            <div><dt>합계</dt><dd className="tnum">{total.toLocaleString("ko-KR")} (VAT 별도)</dd></div>
            <div><dt>견적서 PDF</dt><dd className="tnum">{pdfCount ? "1개" : "없음"}</dd></div>
          </dl>
        </div>
      ),
      confirmLabel: "제출",
      pendingLabel: "제출하는 중",
      retryLabel: "다시 제출",
      action: async () => {
        const fail = "회신을 제출하지 못했어요. 입력한 내용은 그대로 있어요.";
        // 제출본이 자동 저장에 덮이지 않도록 대기 중·진행 중인 초안 저장을 멈춘다
        window.clearTimeout(timer.current);
        saveAbort.current?.abort();
        let pdfRef: { path: string; name: string; size: number } | undefined;
        if (pdf) {
          const u = await fetch(`/api/quote/${token}/upload-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: pdf.name, size: pdf.size, type: pdf.type }) }).catch(() => null);
          const ud = (await u?.json().catch(() => ({}))) as { path?: string; signedUrl?: string } | undefined;
          if (!u?.ok || !ud?.path || !ud.signedUrl || !(await uploadToSigned({ name: pdf.name, path: ud.path, signedUrl: ud.signedUrl }, pdf))) {
            setPdfBad({ name: pdf.name, size: pdf.size, err: "올리지 못했어요. 다시 올려 주세요." });
            setPdf(null);
            throw new Error("견적서 PDF를 올리지 못했어요. 입력한 내용은 그대로 있어요.");
          }
          pdfRef = { path: ud.path, name: pdf.name, size: pdf.size };
        }
        const res = await fetch(`/api/quote/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, note, common, steps, pdf: pdfRef }) }).catch(() => null);
        if (!res?.ok) {
          const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
          // 닫힘·기한처럼 이유가 있는 거절은 그 이유를, 연결·서버 문제는 시안 문구를 보여 준다
          throw new Error(res && res.status < 500 && d?.error ? d.error : fail);
        }
      },
    });
    if (!ok) return;
    setDirty(false);
    setPdf(null);
    router.push(`${doneHref}${doneHref.includes("?") ? "&" : "?"}t=${total}&w=${finalW}&f=${pdfCount}&at=${encodeURIComponent(new Date().toISOString())}`);
  };

  const status = isSubmitted && dirty ? "고친 내용은 제출 전" : saveStatus(saved, savedAt);
  const closedText = data.closedMessage ?? "";
  const roText = data.closed
    ? isSubmitted && closedText.startsWith("비교표가 열려") ? "비교표가 열려 고칠 수 없어요." : closedText || "이 요청의 회신이 닫혔어요."
    : data.expired ? "만료된 링크예요. 볼 수만 있어요." : data.withdrawn ? "참여를 철회한 요청이에요." : data.declined ? "불참으로 처리한 요청이에요." : "회신 기한이 지나 고칠 수 없어요.";
  const ddayText = rfq.ddayLabel === "회신 D-0" ? "오늘 마감" : rfq.ddayLabel.replace("회신 ", "");
  const leftText = `합계 ${total.toLocaleString("ko-KR")} (VAT 별도) · 남은 항목 ${items.length - filled} · 견적서 PDF ${pdfCount}개`;

  return (
    <div className="lr lr-reply">
      <Link href={backHref} onClick={leave} className="crumb lr-crumb">
        <Caret size={14} /> 요청서
      </Link>
      <header className="lr-head">
        <div className="lr-head__main">
          <h1><span className="tnum">{rfq.no}</span><span className="lr-tail"> / {testsLine(rfq.rows.map((r) => r.name))} · 회신</span></h1>
          {!readOnly && status && <p role="status" className={`lr-sub lr-head__state${saved === "failed" ? " lr-head__state--err" : ""}`}>{status}</p>}
        </div>
        {docLink && !readOnly && <div className="lr-head__side"><Link href={docLink.href} className="b2" onClick={leave}>견적서 편집</Link></div>}
      </header>

      {saved === "failed" && !readOnly && !isSubmitted && (
        <Ban tone="bad" action={<button id="reply-resave" type="button" className="b2" onClick={saveNow}>다시 연결</button>}>
          연결이 끊겼어요. {savedAt ? `${hm(savedAt)} 뒤에 입력한 내용은 저장 전이에요.` : "입력한 내용은 저장 전이에요."}
        </Ban>
      )}
      {readOnly && <Ban tone="end">{roText}</Ban>}

      {docFill && docApplied > 0 && !readOnly && (
        <div className="note note--tint lr-note">
          <span>
            <b>견적서 {docFill.docNo}의 금액으로 시험 {docApplied}개를 채웠어요.</b>{" "}
            <Link href={docFill.printHref} style={{ color: "var(--brand)", fontWeight: 600 }}>PDF 저장</Link>{" · "}
            <Link href={docFill.href} style={{ color: "var(--brand)", fontWeight: 600 }}>견적서 고치기</Link>
          </span>
        </div>
      )}
      {data.draft?.prefilled && !readOnly && (
        <div className="note lr-note">
          <span>
            <b>시험 목록으로 초안을 채웠어요.</b>{" "}
            {pending ? `요청 조건이 등록한 기본 조건과 다른 항목 ${pending}건에 "확인 필요"가 붙어 있어요.` : "금액·기간을 확인하고 제출해 주세요."}{" "}
            {catalogHref && <Link href={catalogHref} style={{ color: "var(--brand)", fontWeight: 600 }}>시험 목록 고치기</Link>}
          </span>
        </div>
      )}

      <div className="lr-split">
        <div className="lr-main">
          <section className="lr-sec" aria-labelledby="lr-items-title">
            <div className="lr-sec__head">
              <h2 id="lr-items-title">가능 여부·금액·기간</h2>
              <span className="lr-sec__aside tnum">{filled} / {items.length}</span>
            </div>
            <div className="card lr-items">
              <div className="lr-items__head" aria-hidden="true">
                <span />
                <span>시험</span>
                <span>가능 여부</span>
                <span className="lr-num">금액 (원)</span>
                <span className="lr-num">기간</span>
              </div>
              {rfq.rows.map((r) => {
                const it = items.find((x) => x.seq === r.seq)!;
                const nodes = [
                  ...steps.filter((st) => st.name.trim()).map((st) => ({ seq: st.seq, name: st.name.trim() })),
                  ...rfq.rows.filter((x) => items.find((y) => y.seq === x.seq)?.avail !== "불가").map((x) => ({ seq: x.seq, name: x.name })),
                ];
                const no = it.avail === "불가";
                const needReason = it.avail === "불가" || it.avail === "조건부 가능";
                const perSample = it.unit === "per_sample";
                const checks = it.checks ?? [];
                const src = it.source === "catalog" ? "시험 목록" : it.source === "learned" ? "최근 회신" : "";
                const ok = done(it) && !checks.length;
                const itemErr = tried && !ok ? (!it.avail ? "가능 여부를 골라 주세요." : needReason && !it.reason ? "사유를 적어 주세요." : !no && (!it.amount || !it.weeks) ? "금액과 기간을 적어 주세요." : checks.length ? "확인 필요 항목을 확인해 주세요." : "") : "";
                return (
                  <div id={`reply-item-${r.seq}`} tabIndex={-1} key={r.seq} className={`lr-item${checks.length ? " lr-item--check" : ""}`}>
                    <div className="lr-item__row">
                      <span className={`lr-item__done${ok ? " lr-item__done--on" : ""}`} aria-label={ok ? "작성 완료" : "작성 전"} role="img">
                        <CheckMark size={12} />
                      </span>
                      <div className="lr-item__name">
                        <b>{r.name}</b>
                        {(r.cond || (r.category !== r.name ? r.category : "")) && <span>{r.cond || r.category}</span>}
                        {(src || checks.length > 0) && (
                          <span className="lr-item__tags">
                            {src && <span className="pill pill--sf">{src}</span>}
                            {checks.length > 0 && <span className="pill pill--tint">확인 필요 · {checks.join(" · ")}</span>}
                          </span>
                        )}
                      </div>
                      <div className="seg seg--full lr-item__avail" role="group" aria-label={`${r.name} 수행 가능 여부`}>
                        {AVAILS.map((a) => (
                          <button key={a} type="button" aria-pressed={it.avail === a} data-no={a === "불가" ? "1" : "0"} disabled={readOnly} onClick={() => update(r.seq, { avail: a })}>{a}</button>
                        ))}
                      </div>
                      <div className="numin lr-item__amount">
                        <input type="text" inputMode="numeric" placeholder={perSample ? "총액" : "금액"} disabled={no || readOnly || (perSample && !!it.unitPrice && !!it.sampleCount)} value={it.amount ? Number(it.amount).toLocaleString("ko-KR") : ""} onChange={(e) => update(r.seq, { amount: e.target.value.replace(/[^\d]/g, "").slice(0, 13) })} aria-label={`${r.name} 금액`} />
                        <span>원</span>
                      </div>
                      <div className="numin lr-item__weeks">
                        <input type="text" inputMode="numeric" placeholder="기간" disabled={no || readOnly} value={it.weeks} onChange={(e) => update(r.seq, { weeks: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })} aria-label={`${r.name} 예상 소요기간`} />
                        <span>주</span>
                      </div>
                    </div>
                    {itemErr && <p className="fld__err lr-item__err" role="alert">{itemErr}</p>}
                    <div className="lr-item__more">
                      {checks.length > 0 && !readOnly && (
                        <div className="lr-item__check">
                          <span>요청 조건이 등록한 기본 조건과 달라요. 금액·기간을 이 조건에 맞게 고치거나, 등록한 조건을 모두 확인한 뒤 아래 버튼을 눌러 주세요.</span>
                          <button type="button" className="b2 bsm" onClick={() => confirmChecks(r.seq)}>현재 금액과 기간으로 회신</button>
                        </div>
                      )}
                      {needReason && (
                        <input className="inp lr-item__reason" placeholder={it.avail === "불가" ? "불가 사유 (필수)" : "조건 · 조건 충족 시 기준 금액 (필수)"} disabled={readOnly} value={it.reason ?? ""} onChange={(e) => update(r.seq, { reason: e.target.value.slice(0, 500) })} aria-label={`${r.name} 사유`} />
                      )}
                      {perSample && !no && (
                        <div className="lr-item__sample">
                          <div className="numin">
                            <input type="text" inputMode="numeric" placeholder="검체당 단가" style={{ paddingRight: 70 }} disabled={readOnly} value={it.unitPrice ? Number(it.unitPrice).toLocaleString("ko-KR") : ""} onChange={(e) => update(r.seq, { unitPrice: e.target.value.replace(/[^\d]/g, "").slice(0, 13) })} aria-label={`${r.name} 검체당 단가`} />
                            <span>원/검체</span>
                          </div>
                          <div className="numin">
                            <input type="text" inputMode="numeric" placeholder="검체 수" disabled={readOnly} value={it.sampleCount ?? ""} onChange={(e) => update(r.seq, { sampleCount: e.target.value.replace(/[^\d]/g, "").slice(0, 6) })} aria-label={`${r.name} 검체 수`} />
                            <span>건</span>
                          </div>
                        </div>
                      )}
                      {!no && <ItemSchedule it={it} rfq={rfq} nodes={nodes} disabled={readOnly} onChange={(patch) => update(r.seq, patch)} />}
                      {!no && <DesignEditor value={it.design ?? {}} category={r.category} disabled={readOnly} onChange={(d) => update(r.seq, { design: d })} />}
                      {!no && r.category === EFFICACY_CAT && <EfficacyCosts value={it.design ?? {}} disabled={readOnly} onChange={(d, t) => update(r.seq, t ? { design: d, amount: t } : { design: d })} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="lr-grid2">
            <section className="lr-sec" aria-labelledby="lr-common-title">
              <div className="lr-sec__head"><h2 id="lr-common-title">공통 조건</h2></div>
              <div className="card card--pad lr-form">
                <div className="grid2">
                  <div className="fld">
                    <label className="fld__lab" htmlFor="valid">견적 유효기간</label>
                    <input id="valid" className="inp" type="date" disabled={readOnly} value={common.validUntil} min={today} aria-invalid={!!validErr || undefined} aria-describedby="valid-help" onChange={(e) => updCommon({ validUntil: e.target.value })} />
                    {validErr ? <span id="valid-help" className="fld__err" role="alert">{validErr}</span> : <span id="valid-help" className="fld__help">비우면 제출일 + 30일</span>}
                  </div>
                  <div className="fld">
                    <label className="fld__lab" htmlFor="start">전체 착수 가능일<span className="req">*</span></label>
                    <input id="start" className="inp" type="date" disabled={readOnly} value={common.startDate} aria-invalid={(tried && !!startErr) || undefined} onChange={(e) => updCommon({ startDate: e.target.value })} />
                    {tried && startErr && <span className="fld__err" role="alert">{startErr}</span>}
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
                  <div className="chips">
                    {INCL_KEYS.map((k) => {
                      const on = common.includes.includes(k);
                      return <button key={k} type="button" className="chip" aria-pressed={on} disabled={readOnly} onClick={() => updCommon({ includes: on ? common.includes.filter((x) => x !== k) : [...common.includes, k] })}>{k}</button>;
                    })}
                  </div>
                </div>
                {orgCerts && (
                  <div className="fld">
                    <span className="fld__lab">보유 GLP 인증</span>
                    <span style={{ fontSize: 14, color: "var(--body)" }}>{orgCerts.length ? orgCerts.join(" · ") : "등록된 인증이 없어요."}</span>
                  </div>
                )}
                <div className="fld">
                  <label className="fld__lab" htmlFor="note">제외 항목 · 별도 옵션 · 의뢰자 전달 사항</label>
                  <textarea id="note" className="ta" rows={4} disabled={readOnly} value={note} onChange={(e) => { setNote(e.target.value); queueSave(items, e.target.value, common); }} placeholder="예: 영문 보고서 별도 +8,000,000원, 시험물질 보관 비용 미포함" aria-describedby="note-help" />
                  <span id="note-help" className="fld__help">이메일·전화번호·링크는 선정 전까지 의뢰자 화면에서 가려져요.</span>
                </div>
              </div>
            </section>
            <section className="lr-sec" id="lr-pay" tabIndex={-1} aria-labelledby="pay-lab">
              <div className="card card--pad lr-form">
                <PayScheduleField value={common.payTerms} disabled={readOnly} onChange={(payTerms, err) => { setPayErr(err); updCommon({ payTerms }); }} />
              </div>
            </section>
          </div>

          <section className="lr-sec" aria-label="전체 일정">
            <ScheduleCard rfq={rfq} items={items} steps={steps} startDate={common.startDate} disabled={readOnly} learned={!!data.draft?.prefilled && (steps.length > 0 || items.some((it) => it.reportWeeks || it.afterSeqs?.length))} onSteps={updSteps} />
          </section>
        </div>

        <aside className="lr-side" aria-label="요청 요약과 첨부">
          <section className="card lr-box" aria-labelledby="lr-sum-title">
            <h2 id="lr-sum-title" className="lr-box__h">요청 요약</h2>
            <dl className="lr-dl">
              {rfq.substance && <div><dt>시험물질</dt><dd>{rfq.substance}</dd></div>}
              <div><dt>의뢰자</dt><dd>{rfq.client}</dd></div>
              {rfq.authorities.length > 0 && <div><dt>제출처</dt><dd>{rfq.authorities.join(", ")}</dd></div>}
              <div><dt>회신 기한</dt><dd className="tnum">{md(rfq.replyBy)}{!readOnly && ddayText ? ` (${ddayText})` : ""}</dd></div>
            </dl>
            {rfq.ask.length > 0 && (
              <div>
                <h3 className="lr-box__k lr-box__k--ink">회신에서 설명해 주세요</h3>
                <ul className="lr-ul">{rfq.ask.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </section>
          <section className="card lr-box" aria-labelledby="lr-pdf-title">
            <h2 id="lr-pdf-title" className="lr-box__h">견적서 PDF (선택)</h2>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pickPdf(e.target.files?.[0] ?? null)} />
            {(pdf || pdfName) && (
              <div className="lr-frow">
                <span className="lr-frow__n">{pdf ? pdf.name : pdfName}</span>
                {pdf && <span className="lr-frow__s tnum">{(pdf.size / 1024 / 1024).toFixed(1)}MB</span>}
                {!readOnly && <button type="button" className="btxt" onClick={() => { if (pdf) setPdf(null); else fileRef.current?.click(); }}>{pdf ? "빼기" : "바꾸기"}</button>}
              </div>
            )}
            {pdfBad && (
              <div className="lr-frow lr-frow--bad" role="alert">
                <span className="lr-frow__n">{pdfBad.name}</span>
                <span className="lr-frow__s tnum">{(pdfBad.size / 1024 / 1024).toFixed(1)}MB</span>
                <span className="lr-frow__e">{pdfBad.err}</span>
                {!readOnly && <button type="button" className="btxt" onClick={() => fileRef.current?.click()}>다시 올리기</button>}
              </div>
            )}
            {!pdf && !pdfName && !pdfBad && !readOnly && <button type="button" className="b2 bsm" onClick={() => fileRef.current?.click()}>PDF 고르기</button>}
            <p className="lr-msg">PDF 1개 · 20MB 이하</p>
          </section>
          {docLink && !readOnly && (
            <section className="card lr-box" aria-labelledby="lr-doc-title">
              <h2 id="lr-doc-title" className="lr-box__h">견적서</h2>
              <Link href={docLink.href} onClick={leave}>{docLink.label}</Link>
            </section>
          )}
        </aside>
      </div>

      {!readOnly && (
        <div className="card reply-submit lr-bar">
          <div className="lr-bar__sum">
            <span className="lr-bar__v lr-bar__v--sm tnum">{leftText}</span>
            {allNo && <span className="lr-bar__state" role="status">모든 항목이 불가예요. 참여 철회로 처리해 주세요.</span>}
          </div>
          <div className="lr-bar__acts">
            {!isSubmitted && <WithdrawButton token={token} afterHref={backHref} />}
            {!isSubmitted && <button type="button" className="b2" onClick={saveNow} disabled={saved === "saving"}>임시 저장</button>}
            <button type="button" className="b1" onClick={submit}>{isSubmitted ? "고친 내용 제출" : "회신 제출"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
