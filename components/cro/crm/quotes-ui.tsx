/**
 * 견적·계약 표 (와이어프레임 v7 c-deal-quotes · c-client-quotes · 담당자 화면). 서버 컴포넌트.
 * 줄은 lib/crm-analysis.ts 의 quoteRows: 안건 안의 차수, 받은 사람, 보낸 날, 금액, 결과(선정·실패와 이유), 계약.
 */
import Link from "next/link";
import { dealOutcome, type QuoteRow } from "@/lib/crm-analysis";
import { amountLabel, type DanchuSrc } from "@/lib/crm-deals";
import { mdW, wonKo, ymdKst, type CrmDeal, type DealHistory } from "@/lib/crm-shape";

const ymdDot = (iso: string) => ymdKst(iso).replaceAll("-", ".");

export function QuoteTable({ rows, people, personHref, deals, empty }: {
  rows: QuoteRow[];
  people: Map<string, string>;
  personHref?: (contactId: string) => string;
  /** 안건 칸을 보일 때: 안건 id → [이름, 주소] */
  deals?: Map<string, [string, string]>;
  empty: React.ReactNode;
}) {
  if (!rows.length) return <p className="cx-none">{empty}</p>;
  return (
    <div className="cx-tablewrap cx-tablewrap--flat">
      <table className="cx-table cx-table--qt">
        <thead>
          <tr><th>견적서</th>{deals && <th>안건</th>}<th>받은 사람</th><th>보낸 날</th><th className="r">금액</th><th>결과</th><th className="r">계약</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const who = r.contactId ? people.get(r.contactId) ?? null : null;
            const dl = r.dealId ? deals?.get(r.dealId) : undefined;
            return (
              <tr key={r.key} data-past={r.result.tone === "old" ? "1" : "0"}>
                <td><Link href={r.href} className="cx-tlink tnum">{r.docNo}</Link>{r.version && <small className="cx-muted"> · {r.version}</small>}</td>
                {deals && <td>{dl ? <Link href={dl[1]} className="cx-lk">{dl[0]}</Link> : <span className="cx-muted">안건 없음</span>}</td>}
                <td>{who ? personHref && r.contactId ? <Link href={personHref(r.contactId)} className="cx-lk">{who}</Link> : who : <span className="cx-muted">-</span>}</td>
                <td className="tnum">{r.sentAt ? ymdDot(r.sentAt) : <span className="cx-muted">보내기 전</span>}</td>
                <td className="r tnum">{amountLabel(r.amount)}</td>
                <td><Result r={r} /></td>
                <td className="r tnum">{r.contract ? r.contract.amount != null ? wonKo(r.contract.amount) : <span className="cx-muted">{r.contract.label}</span> : <span className="cx-muted">-</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Result({ r }: { r: QuoteRow }) {
  const t = r.result.tone;
  if (t === "old" || t === "none") return <span className="cx-muted">{r.result.label}</span>;
  return (
    <span className="cx-qt__res">
      <span className={t === "open" ? "cx-st" : `cx-st cx-st--${t}`}>{r.result.label}</span>
      {r.result.reason && <small className="cx-muted">{r.result.reason}</small>}
    </span>
  );
}

/** 안건의 계약 (단추 요청이면 rfq_awards 의 계약 보고) */
export function ContractBox({ deal: d, src, history }: { deal: CrmDeal; src: DanchuSrc | null; history: Pick<DealHistory, "deal_id" | "to_stage">[] }) {
  const o = dealOutcome(d, src, history);
  const aw = src?.award ?? null;
  const amount = aw?.contractAmount ?? (d.status === "won" ? d.won_amount ?? d.amount : null);
  return (
    <section className="cx-grp" aria-labelledby="d-ct">
      <div className="cx-grp__h"><h2 id="d-ct">계약</h2>{o.contracted && <span className="cx-grp__end"><span className="cx-st cx-st--won">계약</span></span>}</div>
      {o.selected || d.status === "lost" ? (
        <dl className="cx-props">
          <div><dt>상태</dt><dd>{d.status === "lost" ? `실패 · ${d.lost_reason || "기타"}` : o.contracted ? "계약" : aw?.contractStatus === "not_signed" ? "계약 안 함" : "선정, 계약 전"}</dd></div>
          {o.contracted && <div><dt>계약 금액</dt><dd className="tnum">{amountLabel(amount)}</dd></div>}
          {d.status === "won" && <div><dt>수주 이유</dt><dd>{d.won_reason || <span className="cx-muted">적지 않음</span>}</dd></div>}
          {d.lost_note && d.status === "lost" && <div><dt>메모</dt><dd className="cx-pre">{d.lost_note}</dd></div>}
          {aw && <div><dt>선정일</dt><dd className="tnum">{ymdDot(aw.awardedAt)}</dd></div>}
          {aw?.contractReportedAt && <div><dt>계약 보고</dt><dd className="tnum">{mdW(ymdKst(aw.contractReportedAt))} · 단추</dd></div>}
          {aw && !aw.contractReportedAt && d.status !== "lost" && <div><dt>계약 보고</dt><dd><Link href="/cro/awards" className="cx-lk">계약 결과 보고하기</Link></dd></div>}
        </dl>
      ) : <p className="cx-none">아직 계약 전이에요. 수주로 바꾸거나 단추에서 선정되면 여기에 붙어요.</p>}
    </section>
  );
}
