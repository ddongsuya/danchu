"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";
import { CONDS, itemOf, totalOf, weeksOf, second, type CompareCol, type CompareRowDef } from "@/lib/compare-board";
import { QUOTE_CHANGED_MESSAGE } from "@/lib/rpc";
import { eulReul, gwaWa } from "@/lib/josa";
import { md, payTerms } from "@/lib/format";
import { SELECTED_FLAG } from "./SelectedBanner";

const full = (n: number | null | undefined) => (n ? n.toLocaleString("ko-KR") : "미입력");
/** 패널 "조건"에서 뺄 줄: 금액·메모는 따로 보여 준다 */
const PANEL_CONDS = CONDS.filter((c) => c.label !== "별도 비용" && c.label !== "결제 조건");

/** 선정 확인창 본문. 동의 칸은 확인창이 실행할 때 읽는다 */
function SelectBody({ col, onAgree }: { col: CompareCol; onAgree: (v: boolean) => void }) {
  const s2 = second(col);
  return (
    <>
      <p>선정하면 회사명과 담당자 연락처를 {gwaWa(col.name)} 서로 주고받고, 선정하지 않은 기관에는 결과만 알립니다.</p>
      <dl className="qp-props">
        <div><dt>견적 총액</dt><dd className="tnum">{full(totalOf(col))} ({s2 ? "2차 · " : ""}VAT 별도)</dd></div>
        <div><dt>견적서</dt><dd className="tnum">{col.hasPdf ? `견적서 PDF${col.arrivedAt ? ` · ${md(s2?.at ?? col.arrivedAt)}` : ""}` : "견적서 PDF 없음"}</dd></div>
        <div><dt>소요 기간</dt><dd className="tnum">{weeksOf(col) ? `${weeksOf(col)}주` : "미입력"}</dd></div>
      </dl>
      <label className="qp-agree">
        <input type="checkbox" onChange={(e) => onAgree(e.currentTarget.checked)} />
        <span>견적서 원본(PDF)을 확인했고, 이 기관과 회사명·담당자 연락처를 계약 협의 목적으로 서로 주고받는 것에 동의합니다</span>
      </label>
    </>
  );
}

/**
 * 비교 보고서의 기관 상세 (2026-11-27 시안 r-quote). 넓은 화면은 표 옆 분할 패널, 휴대폰은 바닥 시트.
 * 내용은 패널 안에서 스크롤하고 아래 행동 줄은 늘 보인다. 선정은 확인창에서 바로 실행하고, 이 패널이 보여 준 견적 판(revision)으로만 선정한다 (0022).
 */
export function QuotePanel({ no, col, rows, canSelect, onClose, onPrev, onNext, onDoc }: {
  no: string; col: CompareCol; rows: CompareRowDef[]; canSelect: boolean;
  onClose: () => void; onPrev: () => void; onNext: () => void; onDoc: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const title = useRef<HTMLHeadingElement>(null);
  const agree = useRef(false);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const s2 = second(col);
  const pays = (payTerms(col.pay) || "").split(" · ").filter(Boolean);
  const revision = col.revision ?? 0;

  const select = async () => {
    agree.current = false;
    const ok = await confirm({
      title: `${eulReul(col.name)} 선정할까요?`,
      body: <SelectBody col={col} onAgree={(v) => { agree.current = v; }} />,
      confirmLabel: "선정",
      cancelLabel: "계속 비교",
      pendingLabel: "선정하는 중",
      action: async () => {
        if (!agree.current) throw new Error("동의 문장을 확인한 뒤 선정해 주세요.");
        const res = await fetch(`/api/rfq/${no}/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: col.id, revision }) });
        const d = (await res.json().catch(() => ({}))) as { code?: string };
        if (res.status === 409 && d.code === "quote_changed") {
          // 창을 연 사이 기관이 견적을 고쳤다. 패널은 새 내용으로 바뀌고, 이 창은 예전 판이라 다시 눌러도 막힌다
          router.refresh();
          throw new Error(QUOTE_CHANGED_MESSAGE);
        }
        if (!res.ok) throw new Error("선정을 저장하지 못했어요. 선정 상태는 바뀌지 않았어요.");
      },
    });
    if (!ok) return;
    try { sessionStorage.setItem(SELECTED_FLAG, no); } catch { /* 저장소가 막혀도 배너는 그대로 보인다 */ }
    router.refresh();
  };

  return (
    <>
      <button type="button" className="qp-scrim" aria-label="닫기" tabIndex={-1} onClick={onClose} />
      <aside className="qp" aria-labelledby="qp-title" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <header className="qp-h">
          <div className="qp-h__t">
            <h2 id="qp-title" ref={title} tabIndex={-1}>{col.name}</h2>
            <small className="tnum">{col.arrivedAt ? `${md(col.arrivedAt)} 회신` : "회신"} · {col.hasPdf ? "견적서 PDF" : "견적서 PDF 없음"}</small>
          </div>
          {col.selected && <span className="pill pill--ok">선정</span>}
          <span className="qp-h__nav">
            <button type="button" className="qp-ib" aria-label="이전 기관" onClick={onPrev}><CaretLeft size={16} /></button>
            <button type="button" className="qp-ib" aria-label="다음 기관" onClick={onNext}><CaretRight size={16} /></button>
            <button type="button" className="qp-ib" aria-label="닫기" onClick={onClose}><X size={16} /></button>
          </span>
        </header>

        <div className="qp-b">
          {col.auto && <p className="qp-msg">기관 확인 전 예비 견적이에요. 정식 견적서와 착수일을 확인한 뒤 선정할 수 있어요.</p>}
          <div className="qp-big">
            <b className="tnum">{full(totalOf(col))}</b>
            <span className="tnum">{s2 ? "2차 · " : ""}VAT 별도 · 소요 기간 {weeksOf(col) ? `${weeksOf(col)}주` : "미입력"}</span>
          </div>
          <section>
            <h3>시험별 금액</h3>
            <dl className="qp-props">
              {rows.map((r) => {
                const x = itemOf(col, r.seq);
                const it = col.items.find((i) => i.seq === r.seq);
                return (
                  <div key={r.seq}>
                    <dt>{r.name}{it?.design && <small>{it.design}</small>}</dt>
                    <dd className="tnum">{x.main}{x.sub && <small>{x.sub}</small>}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
          <section>
            <h3>조건</h3>
            <dl className="qp-props">
              {PANEL_CONDS.map((c) => <div key={c.label}><dt>{c.label}</dt><dd>{c.val(col)}{c.sub?.(col) && <small>{c.sub(col)}</small>}</dd></div>)}
            </dl>
          </section>
          <section>
            <h3>지급 조건</h3>
            {pays.length ? <ul className="qp-list">{pays.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="qp-msg">기재 없음</p>}
          </section>
          <section>
            <h3>기관 메모</h3>
            <p className="qp-memo">{col.note?.trim() || "없음"}</p>
          </section>
          {col.hasDoc && <p><Link href={`/app/r/${no}/q/${col.id}/doc`} className="qp-link">기관 견적서</Link></p>}
          {canSelect && col.blocked && <p className="qp-msg">{col.blocked} <Link href={`/app/support?rfq=${no}`} className="qp-link">문의</Link></p>}
        </div>

        <footer className="qp-f">
          {!col.selected && col.askHref && <Link href={col.askHref} className="b2 bsm">새 질의</Link>}
          <button type="button" className="b2 bsm" disabled={!col.hasPdf} onClick={onDoc}>견적서 PDF</button>
          {col.selected ? (
            <button type="button" className="b1 bsm" disabled>선정함</button>
          ) : canSelect ? (
            // 확인 창이 떠 있는 동안 이 버튼은 처리 중으로 보이지 않는다. 처리 중은 창 안의 "선정하는 중"
            <Button className="b1 bsm" disabled={!!col.blocked} onClick={() => { void select(); }}>이 기관 선정</Button>
          ) : null}
        </footer>
      </aside>
    </>
  );
}

/** 견적서 원본 분할 보기 (2026-11-27 시안 r-doc): 왼쪽 PDF, 오른쪽 상세 패널. PDF는 기관이 고르는 선택 첨부다 */
export function QuotePdf({ col, onBack }: { col: CompareCol; onBack: () => void }) {
  const [state, setState] = useState<{ url?: string; err?: boolean }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let url = "";
    let live = true;
    // 내려받기 링크(Content-Disposition: attachment)라 iframe 에 바로 걸지 않고 내용을 받아 화면 안에서 연다
    fetch(`/api/quotes/${col.id}/pdf`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then((b) => { url = URL.createObjectURL(new Blob([b], { type: "application/pdf" })); if (live) setState({ url }); })
      .catch(() => { if (live) setState({ err: true }); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [col.id, attempt]);

  return (
    <div className="qd">
      <div className="qd-bar">
        <button type="button" className="qp-ib" aria-label="뒤로" onClick={onBack}><ArrowLeft size={16} /></button>
        <b>{col.name} 견적서 PDF</b>
        <span className="cmp-tools__sp" />
        <a href={`/api/quotes/${col.id}/pdf`} className="b2 bsm">PDF 내려받기</a>
      </div>
      {state.url ? (
        <iframe className="qd-doc" src={state.url} title={`${col.name} 견적서 PDF`} />
      ) : state.err ? (
        <div className="empty ix-state" data-kind="error" role="alert">
          <b>견적서를 불러오지 못했어요</b>
          <div className="ix-state__act"><button type="button" className="b2 bsm" onClick={() => { setState({}); setAttempt((n) => n + 1); }}>다시 불러오기</button></div>
        </div>
      ) : (
        <DelayedSkeleton label="견적서 불러오는 중"><div className="qd-doc qd-doc--sk" /></DelayedSkeleton>
      )}
    </div>
  );
}
