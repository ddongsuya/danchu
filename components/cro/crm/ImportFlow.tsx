"use client";

/**
 * 엑셀 가져오기 (시안 v5 6번). ① 파일 ② 칸 맞추기 ③ 확인.
 * 파일은 브라우저에서 읽고(lib/xlsx-read), 서버는 같은 규칙(planImport)으로 다시 계산해 만든다. 만든 것은 24시간 안에 되돌릴 수 있다.
 */
import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileXls, UploadSimple } from "@phosphor-icons/react";
import { IMPORT_FIELDS, LOST_REASONS, STAGES, STAGE_LABEL, guessField, guessStage, planImport, type ImportField, type ImportMode, type StageValue } from "@/lib/crm-deals";
import { readCsv, readXlsx, type ReadSheet } from "@/lib/xlsx-read";
import { Err } from "./forms";

type Co = { id: string; name: string; aliases: string[]; biz_no: string };
type Mem = { id: string; name: string };
const MAX = 3000;
const MODES: Record<ImportMode, { t: string; s: string }> = {
  merge: { t: "기존 고객사에 합치기", s: "이름이나 사업자번호가 같으면 그 고객사에 담당자와 안건을 더해요." },
  skip: { t: "겹치는 줄 건너뛰기", s: "이미 있는 고객사의 줄은 가져오지 않아요." },
  new: { t: "모두 새로 만들기", s: "이름이 같아도 새 고객사로 만들어요." },
};
/** 진행상태 값 고르기: 단계 다섯 + 수주 + 실패 */
const VAL_OPTS: { key: string; label: string; v: StageValue | null }[] = [
  ...STAGES.map((s) => ({ key: `${s}:open`, label: `${STAGE_LABEL[s]} (진행)`, v: { stage: s, status: "open" as const } })),
  { key: "contract:won", label: "수주", v: { stage: "contract", status: "won" } },
  ...LOST_REASONS.map((r) => ({ key: `quote:lost:${r}`, label: `실패 · ${r}`, v: { stage: "quote" as const, status: "lost" as const, reason: r } })),
];
const keyOf = (v: StageValue | null) => (v ? (v.status === "lost" ? `quote:lost:${v.reason ?? "기타"}` : `${v.stage}:${v.status}`) : "");
const isMemoHeader = (h: string) => /비고|메모|특이|note|memo/i.test(h);

export function ImportFlow({ companies, members, me, paths }: { companies: Co[]; members: Mem[]; me: string; paths: { deals: string; clients: string } }) {
  const hid = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<{ name: string; sheets: string[]; sheet: ReadSheet; bytes?: Uint8Array } | null>(null);
  const [map, setMap] = useState<ImportField[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<ImportMode>("merge");
  const [owner, setOwner] = useState(me);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; companies: number; merged: number; contacts: number; deals: number; skipped: number; undone?: boolean } | null>(null);

  const header = useMemo(() => (file?.sheet.rows[0] ?? []).map((h) => String(h ?? "").trim()), [file]);
  const body = useMemo(() => (file?.sheet.rows.slice(1) ?? []).filter((r) => r.some((x) => String(x ?? "").trim())), [file]);
  const stageCol = map.indexOf("stage");
  const stageValues = useMemo(() => {
    if (stageCol < 0) return [] as { v: string; n: number }[];
    const m = new Map<string, number>();
    for (const r of body) { const s = String(r[stageCol] ?? "").trim(); if (s) m.set(s, (m.get(s) ?? 0) + 1); }
    return [...m.entries()].map(([v, n]) => ({ v, n })).sort((x, y) => y.n - x.n).slice(0, 40);
  }, [body, stageCol]);
  const stageMap = useMemo(() => {
    const o: Record<string, StageValue> = {};
    for (const { v } of stageValues) {
      const k = vals[v] ?? keyOf(guessStage(v));
      const opt = VAL_OPTS.find((x) => x.key === k);
      if (opt?.v) o[v] = opt.v;
    }
    return o;
  }, [stageValues, vals]);
  const plan = useMemo(() => (file && map.includes("company") ? planImport({ header, rows: body, map, stageMap, mode, companies, members, defaultOwner: owner || null }) : null), [file, header, body, map, stageMap, mode, companies, members, owner]);
  const needMap = header.filter((h, i) => map[i] === "memo" && !isMemoHeader(h)).length;
  const unsetVals = stageValues.filter(({ v }) => !stageMap[v]).length;

  async function pick(f: File | undefined) {
    setErr("");
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return setErr("8MB보다 큰 파일은 가져올 수 없어요. 필요한 시트만 남겨 저장해 주세요.");
    try {
      const isCsv = /\.(csv|tsv|txt)$/i.test(f.name);
      const bytes = new Uint8Array(await f.arrayBuffer());
      const got = isCsv ? { sheets: ["CSV"], sheet: readCsv(new TextDecoder(detectEnc(bytes)).decode(bytes)) } : await readXlsx(bytes);
      apply({ name: f.name, ...got, bytes: isCsv ? undefined : bytes });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "파일을 읽지 못했어요. .xlsx 나 .csv 로 저장한 파일을 골라 주세요.");
    }
  }
  function apply(f: { name: string; sheets: string[]; sheet: ReadSheet; bytes?: Uint8Array }) {
    const hs = (f.sheet.rows[0] ?? []).map((h) => String(h ?? "").trim());
    const rows = f.sheet.rows.length - 1;
    if (!hs.length || rows < 1) return setErr("머리줄과 내용이 있는 시트를 찾지 못했어요. 첫 줄에 열 이름이 있는지 확인해 주세요.");
    if (rows > MAX) return setErr(`한 번에 ${MAX.toLocaleString("ko-KR")}줄까지 가져올 수 있어요. 지금 파일은 ${rows.toLocaleString("ko-KR")}줄이에요.`);
    // 같은 칸에 두 열이 맞춰지면 뒤 열은 메모로
    const seen = new Set<ImportField>();
    setMap(hs.map((h) => { const g = guessField(h); if (g !== "memo" && g !== "skip" && seen.has(g)) return "memo"; seen.add(g); return g; }));
    setVals({});
    setFile(f);
    setStep(2);
  }
  async function pickSheet(i: number) {
    if (!file?.bytes) return;
    try { const got = await readXlsx(file.bytes, i); apply({ ...file, ...got }); } catch (x) { setErr(x instanceof Error ? x.message : "시트를 읽지 못했어요."); }
  }
  async function run() {
    if (!file || !plan) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/cro/crm/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file_name: file.name, header, rows: body, map, stage_map: stageMap, mode, owner }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      setDone(j);
    } catch (x) {
      setErr(x instanceof Error && x.message !== "Failed to fetch" ? x.message : "연결이 끊겼어요. 다시 눌러 주세요.");
    } finally { setBusy(false); }
  }
  async function undo() {
    if (!done) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/cro/crm/import", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: done.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "되돌리지 못했어요.");
      setDone({ ...done, undone: true });
    } catch (x) { setErr(x instanceof Error ? x.message : "되돌리지 못했어요."); } finally { setBusy(false); }
  }

  const Steps = (
    <ol className="cx-steps" aria-label="가져오기 단계">
      {(["파일", "칸 맞추기", "확인"] as const).map((t, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const st = done ? "done" : n < step ? "done" : n === step ? "on" : "next";
        return <li key={t} data-state={st} aria-current={st === "on" ? "step" : undefined}><i className="tnum">{st === "done" ? <Check size={12} weight="bold" aria-hidden="true" /> : n}</i>{t}</li>;
      })}
    </ol>
  );

  if (done) {
    return (
      <div className="cx-imp cx-imp--done">
        {Steps}
        <section className="cx-panel" aria-live="polite">
          {done.undone ? (
            <>
              <h2>가져온 것을 되돌렸어요</h2>
              <p className="cx-cap">이번 가져오기로 새로 만든 고객사·담당자·안건을 지웠어요. 원래 있던 고객사는 그대로예요.</p>
              <div className="cx-ph__acts"><button type="button" className="b2" onClick={() => { setDone(null); setFile(null); setStep(1); }}>다른 파일 가져오기</button></div>
            </>
          ) : (
            <>
              <h2>가져왔어요</h2>
              <dl className="cx-result">
                <div><dt>새 고객사</dt><dd className="tnum">{done.companies}곳</dd></div>
                <div><dt>기존 고객사에 합침</dt><dd className="tnum">{done.merged}곳</dd></div>
                <div><dt>담당자</dt><dd className="tnum">{done.contacts}명</dd></div>
                <div><dt>안건</dt><dd className="tnum">{done.deals}건</dd></div>
                {done.skipped > 0 && <div><dt>건너뛴 줄</dt><dd className="tnum">{done.skipped}줄</dd></div>}
              </dl>
              <div className="cx-ph__acts">
                <Link className="b1" href={paths.deals}>안건 보드 보기</Link>
                <Link className="b2" href={paths.clients}>고객사 보기</Link>
                <button type="button" className="btxt" disabled={busy} onClick={undo}>{busy ? "되돌리는 중" : "되돌리기"}</button>
              </div>
              <p className="cx-cap">잘못 가져왔으면 24시간 안에 되돌릴 수 있어요. 새로 만든 것만 지우고, 원래 있던 고객사는 건드리지 않아요.</p>
            </>
          )}
          <Err msg={err} />
        </section>
      </div>
    );
  }

  return (
    <div className="cx-imp">
      {Steps}
      {step === 1 && (
        <section className="cx-panel cx-drop">
          <FileXls size={36} aria-hidden="true" />
          <h2>지금 쓰는 고객 엑셀을 골라 주세요</h2>
          <p className="cx-cap">.xlsx 나 .csv 파일, 첫 줄에 열 이름이 있는 시트. 한 번에 {MAX.toLocaleString("ko-KR")}줄까지 가져와요. 파일은 이 브라우저에서만 읽고 올리지 않아요.</p>
          <label className="b1 cx-file" htmlFor={`${hid}-f`}><UploadSimple size={16} aria-hidden="true" />파일 고르기</label>
          <input id={`${hid}-f`} type="file" className="sr-only" accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => pick(e.target.files?.[0])} />
          <Err msg={err} />
        </section>
      )}

      {step >= 2 && file && (
        <div className="cx-impcols">
          <div className="cx-center">
            <div className="cx-filebar">
              <span className="cx-filebar__f"><FileXls size={20} aria-hidden="true" /><b>{file.name}</b><span className="cx-muted tnum">{body.length.toLocaleString("ko-KR")}줄 · 열 {header.length}개</span></span>
              <span className="cx-ph__acts">
                {file.sheets.length > 1 && (
                  <label className="cx-mini">시트
                    <select value={file.sheets.indexOf(file.sheet.name)} onChange={(e) => pickSheet(+e.target.value)}>{file.sheets.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
                  </label>
                )}
                <button type="button" className="btxt" onClick={() => { setFile(null); setStep(1); }}>다른 파일</button>
              </span>
            </div>

            {step === 2 && (
              <>
                <div className="cx-sec__h"><h2>칸 맞추기</h2><span className="cx-muted">{needMap ? `${needMap}개 열은 맞는 칸을 못 찾아 메모로 보관해요. 확인해 주세요.` : "열 이름을 보고 모두 맞췄어요."}</span></div>
                <div className="cx-tablewrap">
                  <table className="cx-table cx-map">
                    <thead><tr><th>엑셀 열</th><th>예시 값</th><th aria-hidden="true" /><th>단추 CRM 칸</th></tr></thead>
                    <tbody>
                      {header.map((h, i) => {
                        const ex = body.find((r) => String(r[i] ?? "").trim())?.[i];
                        const need = map[i] === "memo" && !isMemoHeader(h);
                        return (
                          <tr key={i} data-need={need ? "1" : "0"}>
                            <td><b>{h || `열 ${i + 1}`}</b></td>
                            <td className="cx-map__ex">{ex == null ? "" : String(ex)}</td>
                            <td className="cx-muted" aria-hidden="true"><ArrowRight size={14} /></td>
                            <td>
                              <label className="sr-only" htmlFor={`${hid}-m${i}`}>{h} 열을 맞출 칸</label>
                              <select id={`${hid}-m${i}`} className="sel cx-map__to" value={map[i]} onChange={(e) => setMap(map.map((x, j) => (j === i ? (e.target.value as ImportField) : x)))}>
                                {(Object.keys(IMPORT_FIELDS) as ImportField[]).map((f) => <option key={f} value={f} disabled={f !== "memo" && f !== "skip" && map.includes(f) && map[i] !== f}>{IMPORT_FIELDS[f]}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!map.includes("company") && <p className="crm-err" role="alert">고객사 이름 칸을 하나 골라 주세요. 고객사 없이 가져올 수는 없어요.</p>}
              </>
            )}

            {step === 3 && plan && (
              <>
                <div className="cx-sec__h"><h2>가져올 내용</h2><span className="cx-muted">앞 20줄</span></div>
                <div className="cx-tablewrap">
                  <table className="cx-table">
                    <thead><tr><th className="tnum">줄</th><th>고객사</th><th>담당자</th><th>안건</th><th>단계</th></tr></thead>
                    <tbody>
                      {plan.rows.slice(0, 20).map((r) => (
                        <tr key={r.line} data-past={r.skip ? "1" : "0"}>
                          <td className="tnum cx-muted">{r.line}</td>
                          <td>{r.company.name || "-"}{r.company.match && !r.skip && <small className="cx-muted"> · 기존에 합침</small>}</td>
                          <td>{r.contact?.name ?? <span className="cx-muted">-</span>}</td>
                          <td>{r.skip ? <span className="cx-muted">{r.skip}</span> : r.deal?.title ?? <span className="cx-muted">안건 없음</span>}</td>
                          <td>{r.deal ? (r.deal.status === "open" ? STAGE_LABEL[r.deal.stage] : r.deal.status === "won" ? "수주" : `실패 · ${r.deal.reason}`) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <aside className="cx-rail" aria-label="가져오기 설정">
            {step === 2 && stageCol >= 0 && stageValues.length > 0 && (
              <section className="cx-panel">
                <div><h2>진행상태 값을 단계로</h2><p className="cx-cap">&quot;{header[stageCol]}&quot; 열에 있는 값이에요. 맞지 않으면 바꿔 주세요.</p></div>
                <ul className="cx-valmap">
                  {stageValues.map(({ v, n }) => {
                    const k = vals[v] ?? keyOf(guessStage(v));
                    return (
                      <li key={v} data-need={!k ? "1" : "0"}>
                        <span className="cx-valmap__ex">{v}</span>
                        <ArrowRight size={13} aria-hidden="true" className="cx-muted" />
                        <label className="sr-only" htmlFor={`${hid}-v${v}`}>{v}을 맞출 단계</label>
                        <select id={`${hid}-v${v}`} className="sel" value={k} onChange={(e) => setVals({ ...vals, [v]: e.target.value })}>
                          <option value="">골라 주세요 (문의로 들어가요)</option>
                          {VAL_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                        <span className="cx-muted tnum">{n}줄</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {step === 2 && (
              <section className="cx-panel">
                <h2>이미 있는 고객사와 겹치면</h2>
                <div className="cx-opts" role="radiogroup" aria-label="겹칠 때">
                  {(Object.keys(MODES) as ImportMode[]).map((m) => (
                    <label key={m} data-on={mode === m ? "1" : "0"}>
                      <input type="radio" name={`${hid}-mode`} checked={mode === m} onChange={() => setMode(m)} />
                      <span><b>{MODES[m].t}</b><small>{MODES[m].s}</small></span>
                    </label>
                  ))}
                </div>
                {members.length > 1 && (
                  <label className="fld">
                    <span className="fld__lab">담당 영업 칸이 비면</span>
                    <select className="sel" value={owner} onChange={(e) => setOwner(e.target.value)}>
                      <option value="">정하지 않음</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </label>
                )}
              </section>
            )}
            {plan && (
              <section className="cx-panel cx-sum">
                <h2>{step === 3 ? "이대로 가져올까요?" : "가져오면"}</h2>
                <dl className="cx-result">
                  <div><dt>새 고객사</dt><dd className="tnum">{plan.newCompanies}곳</dd></div>
                  <div><dt>기존 고객사에 합침</dt><dd className="tnum">{plan.mergedCompanies}곳</dd></div>
                  <div><dt>담당자</dt><dd className="tnum">{plan.contacts}명</dd></div>
                  <div><dt>안건</dt><dd className="tnum">{plan.deals}건</dd><dd className="cx-cap tnum">진행 {plan.open} · 수주 {plan.won} · 실패 {plan.lost}</dd></div>
                  {plan.skipped > 0 && <div><dt>건너뛰는 줄</dt><dd className="tnum">{plan.skipped}줄</dd></div>}
                </dl>
                {unsetVals > 0 && step === 2 && <p className="cx-cap cx-warnline">진행상태 값 {unsetVals}개를 아직 고르지 않았어요. 고르지 않으면 문의 단계로 들어가요.</p>}
                {step === 2 ? (
                  <button type="button" className="b1 cx-wide" disabled={!map.includes("company")} onClick={() => setStep(3)}>다음</button>
                ) : (
                  <>
                    <button type="button" className="b1 cx-wide" disabled={busy || (!plan.deals && !plan.newCompanies && !plan.contacts)} onClick={run}>{busy ? "가져오는 중" : "가져오기"}</button>
                    <button type="button" className="btxt cx-wide" onClick={() => setStep(2)}>칸 다시 맞추기</button>
                    <p className="cx-cap">24시간 안에 한 번 되돌릴 수 있어요.</p>
                  </>
                )}
                <Err msg={err} />
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** 한국 엑셀이 내보낸 CSV 는 EUC-KR 인 경우가 많다. UTF-8 로 읽어 깨지면 EUC-KR 로 */
function detectEnc(b: Uint8Array): string {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return "utf-8";
  try { new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, 64 * 1024), { stream: true }); return "utf-8"; } catch { return "euc-kr"; }
}
