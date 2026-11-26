import Link from "next/link";
import type { listAwardsForOrg } from "@/lib/data";
import { ContractReport } from "@/components/cro/ContractReport";
import { SubstanceForm } from "@/components/cro/SubstanceForm";
import { ymd, won } from "@/lib/format";
import { contractConfirmState } from "@/lib/status";
import { GAP_REASON_LABEL, isGapReason } from "@/lib/contract-gap";
import { contractReportDue } from "@/lib/contract-reminder";
import "./layout-quote.css";

export type AwardItem = Awaited<ReturnType<typeof listAwardsForOrg>>[number];

const NEXT = [
  ["의뢰자와 계약 협의", "계약 조건은 의뢰자와 직접 정해요."],
  ["계약 체결 보고", "체결일과 계약금액을 적어 주세요. 의뢰자가 확인하거나 7일 안에 다른 의견이 없으면 확정되고 요청을 마쳐요."],
  ["시험물질 필요량 안내", "의뢰자에게 시험물질 정보를 받아 필요량과 보낼 시점을 적어 주세요."],
];

/**
 * 수주 한 건 (/cro/awards). 제목 줄(번호·물질·상태·계약서) 아래에 왼쪽은 보고 양식, 오른쪽은 의뢰자 연락처와 할 일.
 * 화면만 그린다. 저장은 ContractReport · SubstanceForm 이 한다.
 */
export function AwardCard({ a }: { a: AwardItem }) {
  const reported = !!a.contract_reported_at;
  const confirm = reported ? contractConfirmState(a, { includeNote: false }) : null;
  const gap = a.contract_gap_reason && isGapReason(a.contract_gap_reason) ? ` · 차이 사유 ${GAP_REASON_LABEL[a.contract_gap_reason]}` : "";
  return (
    <section className="lq-aw" aria-labelledby={`aw-${a.id}`}>
      <header className="lq-aw__hd">
        <div className="lq-aw__t">
          <span className="lq-aw__no tnum">{a.rfq?.rfq_no} · 선정 {ymd(a.awarded_at)}{!reported && ` · 보고 기한 ${ymd(contractReportDue(a.awarded_at))}`}</span>
          <h2 id={`aw-${a.id}`}>{a.rfq?.substance}</h2>
          <span className="lq-aw__sub">{(a.rfq?.categories ?? []).join(" · ")}</span>
        </div>
        <div className="lq-aw__acts">
          <span className={`pill ${reported ? "pill--ok" : "pill--tint"}`}>{reported ? `계약 체결 · ${won(a.contract_amount ?? 0)}` : "계약 진행"}</span>
          {!reported && <Link href={`/cro/awards/${a.id}/contract`} className="b2 bsm">계약서(안)</Link>}
        </div>
      </header>

      <div className="lq-aw__body">
        <div className="lq-aw__main">
          {!reported && a.sponsor_contract_status === "signed" && (
            <p className="note note--warn" role="status">의뢰자가 계약했다고 알려 왔어요. 체결일과 계약금액을 보고해 주세요.</p>
          )}
          {reported ? (
            <dl className="lq-aw__rep">
              <div><dt>체결일</dt><dd className="tnum">{a.contract_date}</dd></div>
              <div><dt>계약금액</dt><dd className="tnum">{won(a.contract_amount ?? 0)}{gap}</dd></div>
              {a.contract_note && <div><dt>비고</dt><dd>{a.contract_note}</dd></div>}
              {confirm && <div><dt>확인</dt><dd>{confirm.label}</dd></div>}
            </dl>
          ) : (
            <ContractReport awardId={a.id} quoteAmount={a.quoteAmount} />
          )}
          <SubstanceForm awardId={a.id} qty={a.substance_qty ?? ""} when={a.substance_when ?? ""} note={a.substance_note ?? ""} updatedAt={a.substance_updated_at} />
        </div>

        <aside className="lq-aw__side">
          <div className="lq-aw__blk">
            <h3>의뢰자 연락처</h3>
            <dl className="lq-aw__kv">
              <div><dt>회사</dt><dd>{a.rfq?.company || "-"}</dd></div>
              <div><dt>담당</dt><dd>{a.rfq?.contact_name || "-"}</dd></div>
              <div><dt>이메일</dt><dd>{a.rfq?.email ? <a href={`mailto:${a.rfq.email}`}>{a.rfq.email}</a> : "-"}</dd></div>
              {a.rfq?.phone && <div><dt>전화</dt><dd className="tnum"><a href={`tel:${a.rfq.phone}`}>{a.rfq.phone}</a></dd></div>}
            </dl>
          </div>
          {!reported && (
            <div className="lq-aw__blk">
              <h3>할 일</h3>
              <ol className="lq-aw__steps">
                {NEXT.map(([t, d], i) => (
                  <li key={t} aria-current={i === 1 ? "step" : undefined}>
                    <b>{t}</b>
                    <small>{d}</small>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
