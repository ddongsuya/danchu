import Link from "next/link";
import { closedMessage, type Loaded } from "@/lib/quote-load";
import { md, won } from "@/lib/format";
import { seatsLabel } from "@/lib/request-policy";
import { JoinPanel } from "./JoinPanel";
import { WithdrawButton } from "./Participation";
import { Ban, CroStory, testsLine, type DetailCue, type QnaCue } from "./CroStory";

/**
 * 기관이 보는 요청서 (시안 검토판 c-r · c-join · q-view · q-expired, 2026-11-27). 토큰 링크(/q)와 기관 포털(/cro/r) 양쪽에서 쓴다.
 * 참여 전(got.joined false, 0023): 요청 시험 항목과 참여 전 요약, 오른쪽에 참여 결정(JoinPanel)만.
 * 참여 뒤: 요청서 · 시험 항목 · 공통 조건 · 첨부, 오른쪽에 기한과 참여 자리. 제출 전에는 참여 철회(되돌릴 수 없음).
 * 회사명과 연락처는 선정된 기관에만, 첨부 내용은 CDA 요청이면 운영자가 체결을 확인한 뒤 열린다.
 * portal: 기관 포털이면 시험 목록으로 회신 초안을 채운다는 안내를 붙인다. afterWithdrawHref: 철회한 뒤 갈 곳
 */
export function RequestView({ got, replyHref, fileToken, afterDeclineHref, afterWithdrawHref, declineEndpoint, detail, qna, portal = false }: { got: Loaded; replyHref: string; fileToken?: string; afterDeclineHref: string; afterWithdrawHref?: string; declineEndpoint?: string; detail?: DetailCue | null; qna?: QnaCue | null; portal?: boolean }) {
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";
  const total = draft?.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0) ?? 0;
  const summary = !rfq.full;
  const ended = got.closed || got.declined || got.expired;
  const deciding = summary && !ended;
  const open = !summary && !ended;
  const joinBy = got.joinBy ? md(got.joinBy) : "";
  const tail = testsLine(rfq.rows.map((r) => r.name));
  const sub = [!summary && !got.declined ? "참여함" : "", rfq.client].filter(Boolean).join(" · ");
  const replyLabel = submitted ? (got.locked ? "제출한 회신 보기" : "회신 고치기") : "회신 쓰기";
  const qnaLabel = qna?.pending ? `질의응답 · 답변 대기 ${qna.pending}` : "질의응답";

  const actions = (
    <>
      {qna && <Link href={qna.href} className="b2">{qnaLabel}</Link>}
      {open && !submitted && afterWithdrawHref && !got.operator && <WithdrawButton token={got.token} afterHref={afterWithdrawHref} />}
      {open && <Link href={replyHref} className="b1">{replyLabel}</Link>}
    </>
  );

  const bans = (
    <>
      {detail?.open && <Ban action={<Link href={detail.href} className="b1">2차 견적 쓰기</Link>}>상세 견적 요청이 도착했어요 · 2차 회신 기한 {md(detail.replyBy)}</Ban>}
      {!detail?.open && detail && detail.status !== "sent" && <Ban tone="end" action={<Link href={detail.href} className="b2">2차 회신 보기</Link>}>2차 회신을 보냈어요</Ban>}
      {got.expired && !got.closed && (
        <Ban tone="bad" action={fileToken ? <Link href="/login" className="b2">로그인</Link> : undefined}>
          {fileToken ? `만료된 링크예요. 회신 기한 ${md(rfq.replyBy)}에서 7일이 지나 볼 수만 있어요.` : "회신 기한이 지나 이 요청에는 더 회신할 수 없어요."}
        </Ban>
      )}
      {got.closed && !detail && <Ban tone="end">{closedMessage(got.closedReason, { submitted })}</Ban>}
      {got.withdrawn && !got.closed && <Ban tone="end">이 요청의 참여를 철회했어요. 철회한 요청은 청구하지 않아요.</Ban>}
      {summary && got.declined && !got.withdrawn && !got.canRejoin && !got.closed && <Ban tone="end">참여 결정 기한이 지나 이 요청에는 참여할 수 없어요.</Ban>}
      {open && !submitted && (
        <Ban>참여했어요 · 회신 기한 {md(rfq.replyBy)}{rfq.masked ? " · 첨부는 CDA 체결 확인 뒤 열려요" : ""}</Ban>
      )}
      {open && submitted && <Ban>회신을 제출했어요 · {got.locked ? "회신 기한이 지나 고칠 수 없어요" : "비교표가 열리기 전까지 고칠 수 있어요"}</Ban>}
    </>
  );

  const testsTable = (
    <section className="lr-sec" aria-labelledby="lr-rows-title">
      <div className="lr-sec__head"><h2 id="lr-rows-title">{summary ? "요청 시험 항목" : "시험 항목"}</h2></div>
      <div className="card tbl-wrap">
        <table className="tbl tbl--stack lr-tbl">
          <thead>
            <tr><th scope="col">시험</th><th scope="col">조건</th></tr>
          </thead>
          <tbody>
            {rfq.rows.map((r) => (
              <tr key={r.seq}>
                <td><b className="lr-tbl__name">{r.name}</b></td>
                <td data-label="조건" className="lr-tbl__cond">{r.cond || "-"}</td>
              </tr>
            ))}
          </tbody>
          {submitted && (
            <tfoot>
              <tr><td>제출 총액 · VAT 별도</td><td className="lr-num tnum">{won(total)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );

  const props = (title: string, id: string, rows: [string, string][]) => (
    <section className="lr-sec" aria-labelledby={id}>
      <div className="lr-sec__head"><h2 id={id}>{title}</h2></div>
      <div className="card card--rows">
        {rows.map(([k, v]) => (
          <div key={k} className="kv">
            <span className="kv__k">{k}</span>
            <span className="kv__v" style={{ whiteSpace: "pre-wrap" }}>{v}</span>
          </div>
        ))}
      </div>
    </section>
  );

  const main = summary ? (
    <>
      {testsTable}
      {props("참여 전 요약", "lr-ov-title", rfq.overview)}
      <p className="lr-msg">시험물질명, 의뢰 목적, 공통 조건, 첨부 목록은 참여한 뒤에 열려요. 회사명과 연락처는 선정된 기관에만 공개돼요.</p>
    </>
  ) : (
    <>
      {props("요청서", "lr-ov-title", [...(rfq.substance ? ([["시험물질", rfq.substance]] as [string, string][]) : []), ...rfq.overview])}
      {testsTable}
      {rfq.common.length > 0 && props("공통 조건", "lr-common-title", rfq.common)}
      {(rfq.situation.length > 0 || rfq.ask.length > 0) && (
        <section className="lr-sec" aria-labelledby="lr-ask-title">
          <div className="lr-sec__head"><h2 id="lr-ask-title">의뢰자 설명</h2></div>
          <div className="card lr-box">
            {rfq.situation.length > 0 && <ul className="lr-ul">{rfq.situation.map((x) => <li key={x}>{x}</li>)}</ul>}
            {rfq.ask.length > 0 && (
              <div>
                <h3 className="lr-box__k lr-box__k--ink">회신에서 설명해 주세요</h3>
                <ul className="lr-ul">{rfq.ask.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        </section>
      )}
      <section className="lr-sec" aria-labelledby="lr-files-title">
        <div className="lr-sec__head"><h2 id="lr-files-title">첨부</h2></div>
        {rfq.files.length > 0 ? (
          <ul className="card card--rows lr-files">
            {rfq.files.map((f) => (
              <li key={f.id}>
                <a href={`/api/files/${f.id}${fileToken ? `?token=${fileToken}` : ""}`}>{f.name}</a>
                <span className="tnum">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
              </li>
            ))}
          </ul>
        ) : rfq.masked && rfq.attachments ? (
          <ul className="card card--rows lr-files"><li><span>{rfq.attachments}</span><span>CDA 체결 확인 뒤 열람</span></li></ul>
        ) : (
          <p className="lr-empty lr-empty--line">첨부가 없어요.</p>
        )}
      </section>
    </>
  );

  const side = deciding ? (
    <JoinPanel token={got.token} seats={seatsLabel(got.seats)} afterDeclineHref={afterDeclineHref} operator={got.operator} declineEndpoint={declineEndpoint} joinBy={joinBy} prefill={portal} />
  ) : got.canRejoin && !got.withdrawn ? (
    // 불참 되돌리기 (2026-10-20 결정 3): 참여 전 불참만, 참여 결정 기한 전, 자리가 남았을 때. 참여와 같은 동의·같은 길(join_offer)
    <JoinPanel token={got.token} seats={seatsLabel(got.seats)} afterDeclineHref={afterDeclineHref} operator={got.operator} rejoinBy={joinBy} prefill={portal} />
  ) : summary ? null : (
    <>
      <section className="card lr-box" aria-label="기한">
        <dl className="lr-dl">
          {joinBy && <div><dt>참여 결정 기한</dt><dd className="tnum">{joinBy}</dd></div>}
          <div><dt>회신 기한</dt><dd className="tnum">{md(rfq.replyBy)}{!ended && rfq.ddayLabel ? ` (${rfq.ddayLabel === "회신 D-0" ? "오늘 마감" : rfq.ddayLabel.replace("회신 ", "")})` : ""}</dd></div>
          {detail && <div><dt>2차 회신 기한</dt><dd className="tnum">{md(detail.replyBy)}</dd></div>}
          {rfq.confid && rfq.confid !== "일반" && <div><dt>CDA</dt><dd>{rfq.masked ? "체결 확인 대기" : "체결 확인"}</dd></div>}
          {submitted && <div><dt>제출 총액</dt><dd className="tnum">{won(total)}</dd></div>}
        </dl>
      </section>
      {open && !submitted && <p className="lr-msg">제출 전에는 참여를 철회할 수 있고, 철회하면 이 요청에 다시 참여할 수 없어요. 철회한 요청은 청구하지 않아요.</p>}
    </>
  );

  return <CroStory no={rfq.no} tail={tail} sub={sub} actions={actions} bans={bans} main={main} side={side} />;
}
