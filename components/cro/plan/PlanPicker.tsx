"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { PLANS, PLAN_IDS, inPilotPeriod, planChange, planDiff, planOn, type PlanId } from "@/lib/plans";

const vatOf = (n: number) => Math.round(n * 0.1);

type OrgPlan = { plan: PlanId; plan_next: PlanId | null; plan_next_from: string | null };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const day = (d: string) => `${Number(d.slice(0, 4))}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
const priceLabel = (id: PlanId) => (PLANS[id].price ? `${PLANS[id].price / 10_000}만 원/월` : "0원");

/**
 * 요금제 고르기 (기관 요금제·결제 화면). 줄을 고르면 변경 확인 창이 열린다: 차이 항목, 적용일, 월 요금.
 * 시범 운영 중에는 2028-01-01 예약이고, 정식 뒤 올리기는 오늘 차액, 내리기는 다음 달 1일부터 (lib/plans.ts)
 */
export function PlanPicker({ org, today, canEdit }: { org: OrgPlan; today: string; canEdit: boolean }) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const [pick, setPick] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  const pilot = inPilotPeriod(today);
  // 기준 요금제: 시범 운영 중에는 예약한 요금제(없으면 무료), 정식 뒤에는 오늘 요금제
  const base: PlanId = pilot ? org.plan_next ?? "free" : planOn(org, today);
  const reserved: PlanId | null = pilot ? org.plan_next : org.plan_next && org.plan_next_from && org.plan_next_from > today ? org.plan_next : null;
  const change = pick ? planChange(org, pick, today) : null;

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (pick && !d.open) d.showModal();
    if (!pick && d.open) d.close();
  }, [pick]);

  async function confirm() {
    if (!pick) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/cro/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: pick }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "요금제를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      setDone(j.message ?? "저장했어요.");
      setPick(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "요금제를 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const tag = (id: PlanId) => {
    if (pilot) return reserved === id ? <span className="pill pill--ok">선택</span> : null;
    if (planOn(org, today) === id) return <span className="pill pill--sf">이용 중</span>;
    if (reserved === id) return <span className="pill pill--warn">{day(org.plan_next_from!)}부터</span>;
    return null;
  };

  return (
    <>
      <div className="pln-opts" role="radiogroup" aria-label="요금제" aria-disabled={!canEdit || undefined}>
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const isBase = !pilot && planOn(org, today) === id && !reserved;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={pick === id}
              className={`pln-opt${(pilot ? reserved === id : planOn(org, today) === id) ? " pln-opt--on" : ""}`}
              disabled={!canEdit || (pilot ? reserved === id : isBase)}
              onClick={() => { setErr(""); setDone(""); setPick(id); }}
            >
              <span className="pln-opt__dot" aria-hidden="true" />
              <span className="pln-opt__b">
                <span className="pln-opt__n">{p.name}{tag(id)}</span>
                <span className="pln-opt__s">{p.items.join(", ")}</span>
              </span>
              <span className="pln-opt__p tnum">{priceLabel(id)}</span>
            </button>
          );
        })}
      </div>
      {!canEdit && <p className="pln-fine">요금제 변경은 기관 대표 담당자 전용</p>}
      {done && <p className="pln-done tnum" role="status">{done}</p>}

      <dialog ref={dlg} className="pln-dlg" aria-labelledby="pln-dlg-h" onClose={() => setPick(null)} onClick={(e) => { if (e.target === dlg.current) setPick(null); }}>
        {pick && change && change.kind !== "same" && (
          <div className="pln-dlg__in">
            <header className="pln-dlg__hd">
              <h2 id="pln-dlg-h">{change.kind === "cancel" ? `${PLANS[pick].name} 유지` : `${PLANS[pick].name}로 변경`}</h2>
              <button type="button" className="pln-x" aria-label="닫기" onClick={() => setPick(null)}><X size={20} aria-hidden="true" /></button>
            </header>
            {(() => {
              const from = change.kind === "cancel" ? reserved ?? base : base;
              const rows = planDiff(from, pick);
              return rows.length ? (
                <table className="pln-diff tnum">
                  <thead><tr><th scope="col">차이 항목</th><th scope="col">{change.kind === "cancel" ? "예약" : pilot && !org.plan_next ? "무료" : "현재"}</th><th scope="col">변경 후</th></tr></thead>
                  <tbody>
                    {rows.map((r) => <tr key={r.label}><th scope="row">{r.label}</th><td className="was">{r.from}</td><td className="chg">{r.to}</td></tr>)}
                  </tbody>
                </table>
              ) : null;
            })()}
            <dl className="pln-kv tnum">
              <div><dt>적용일</dt><dd>{change.kind === "cancel" ? "예약 취소" : day(change.from)}</dd></div>
              <div><dt>월 요금</dt><dd>{won(PLANS[pick].price)} <small>부가세 별도</small></dd></div>
              {change.kind === "upgrade" && (
                <div><dt>이번 달 차액 <small>{day(change.from)} ~ {day(change.periodEnd)}</small></dt><dd>{won(change.prorated + vatOf(change.prorated))} <small>부가세 포함</small></dd></div>
              )}
            </dl>
            {err && <p className="pln-err" role="alert">{err}</p>}
            <div className="pln-dlg__ft">
              <button type="button" className="btn btn--next" disabled={busy} onClick={confirm}>
                {busy ? "저장 중" : change.kind === "reserve" ? "요금제 예약" : change.kind === "cancel" ? "예약 취소" : "요금제 변경"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
