import Link from "next/link";
import type { Loaded } from "@/lib/quote-load";
import { Lock } from "@/components/app/ui";
import { md, won } from "@/lib/format";
import { seatsLabel } from "@/lib/request-policy";
import { JoinPanel } from "./JoinPanel";
import { CroStory, type DetailCue, type QnaCue } from "./CroStory";

/**
 * CRO가 보는 요청서. 토큰 링크(/q)와 CRO 포털(/cro/r) 양쪽에서 쓴다.
 * 참여 전(got.joined false, 0023): 요약(설계 규칙표 "참여 전에 보이는 것")과 참여 결정(JoinPanel)만 보인다.
 * 참여 뒤: 요청 시험 항목(항목마다 회신) · 의뢰 개요 · 공통 조건 · 첨부와 회신 작성, 제출 전 참여 철회.
 * 틀(제목 줄 · 상태 줄 · 오른쪽 열)은 CroStory 가 그린다.
 */
export function RequestView({ got, replyHref, withdrawHref, fileToken, afterDeclineHref, declineEndpoint, detail, qna }: { got: Loaded; replyHref: string; withdrawHref?: string; fileToken?: string; afterDeclineHref: string; declineEndpoint?: string; detail?: DetailCue | null; qna?: QnaCue | null }) {
  const { rfq, draft } = got;
  const submitted = draft?.status === "submitted";
  const total = draft?.items.reduce((a, it) => a + (it.avail !== "불가" && it.amount ? Number(it.amount) : 0), 0) ?? 0;
  const summary = !rfq.full;
  // 참여 결정을 받을 수 있는 상태: 참여 전이고 닫히지 않음
  const deciding = summary && !got.closed && !got.declined && !got.expired;
  const joinByLabel = got.joinBy ? md(new Date(got.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })) : "";
  const mine = rfq.rows.some((r) => draft?.items.find((x) => x.seq === r.seq)?.avail);

  const notices = (
    <>
      {summary && got.declined && !got.withdrawn && !got.canRejoin && !got.closed && <div className="note note--tint lr-note">이 요청에는 불참으로 처리했어요.{joinByLabel ? ` 참여 결정 기한(${joinByLabel})이 지나 다시 참여할 수 없어요.` : ""}</div>}
      {got.withdrawn && !got.closed && <div className="note note--tint lr-note">이 요청의 참여를 철회했어요. 청구하지 않으며, 작성 중이던 내용은 의뢰자에게 보이지 않아요. 철회는 되돌릴 수 없어요.</div>}
      {!summary && rfq.identityMasked && !rfq.masked && (
        <div className="note note--tint lr-note">
          <Lock />
          <span>의뢰자 회사명과 담당자 연락처는 의뢰자가 비교표에서 이 기관을 선정하면 공개돼요. 요청 내용에 대한 질문은 질의응답으로 보내 주세요. 요청서 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오.</span>
        </div>
      )}
      {!summary && rfq.masked && (
        <div className="note note--tint lr-note">
          <Lock />
          <span>
            기밀 등급 <b style={{ fontWeight: 600 }}>CDA 필요</b>. 요청에 맞는 CDA를 양측이 체결하고 운영자가 확인한 뒤 첨부 자료가 열려요. 단추 화면의 회사명과 연락처는 선정 시 공개되며, CDA 문서에 당사자로 적힌 정보는 체결 과정에서 알게 될 수 있어요. 요청서 내용은 이 요청의 견적 산출과 회신에만 써 주시고, 다른 목적으로 쓰거나 다른 곳에 공개하지 말아 주십시오.{" "}
            <a href={`mailto:support@danchu.kr?subject=${encodeURIComponent(`[${rfq.no}] CDA 서명 요청`)}`}>CDA 서명 요청 →</a>
          </span>
        </div>
      )}
    </>
  );

  const side = (
    <>
      {deciding && <JoinPanel token={got.token} seats={seatsLabel(got.seats)} afterDeclineHref={afterDeclineHref} operator={got.operator} declineEndpoint={declineEndpoint} />}
      {/* 불참 되돌리기 (2026-10-20 결정 3): 참여 전 불참만, 참여 결정 기한 전, 자리가 남았을 때. 참여와 같은 동의·같은 길(join_offer) */}
      {got.canRejoin && !got.withdrawn && <JoinPanel token={got.token} seats={seatsLabel(got.seats)} afterDeclineHref={afterDeclineHref} operator={got.operator} rejoinBy={joinByLabel} />}
    </>
  );

  const sideEnd = !summary && !submitted && !got.closed && !got.declined && !got.expired && withdrawHref ? (
    <div className="lr-withdraw">
      <Link href={withdrawHref} className="btxt">참여 철회</Link>
      <p>제출 전에는 언제든 철회할 수 있고, 철회하면 청구하지 않아요. 철회한 뒤에는 다시 참여할 수 없어요.</p>
    </div>
  ) : null;

  const main = (
    <>
      <section className="lr-sec" aria-labelledby="lr-rows-title">
        <div className="lr-sec__head">
          <h2 id="lr-rows-title">요청 시험 항목 <span className="lr-sec__n tnum">{rfq.rows.length}</span></h2>
          <span className="lr-sec__aside">{summary ? "종 · 회복 기간 · GLP 여부" : "항목마다 견적을 적어요"}</span>
        </div>
        <div className="card tbl-wrap">
          <table className="tbl tbl--stack lr-tbl">
            <thead>
              <tr>
                <th scope="col">시험</th>
                <th scope="col">조건</th>
                {mine && <th scope="col">내 회신</th>}
                {mine && <th scope="col" className="lr-num">금액 (원)</th>}
                {mine && <th scope="col" className="lr-num">기간</th>}
              </tr>
            </thead>
            <tbody>
              {rfq.rows.map((r) => {
                const it = draft?.items.find((x) => x.seq === r.seq);
                return (
                  <tr key={r.seq}>
                    <td>
                      <b className="lr-tbl__name">{r.name}</b>
                      {r.category !== r.name && <span className="lr-tbl__cat">{r.category}</span>}
                    </td>
                    <td data-label="조건" className="lr-tbl__cond">{r.cond || "-"}</td>
                    {mine && <td data-label="내 회신">{it?.avail || "-"}</td>}
                    {mine && <td data-label="금액 (원)" className="lr-num tnum">{it?.amount && it.avail !== "불가" ? Number(it.amount).toLocaleString("ko-KR") : "-"}</td>}
                    {mine && <td data-label="기간" className="lr-num tnum">{it?.weeks && it.avail !== "불가" ? `${it.weeks}주` : "-"}</td>}
                  </tr>
                );
              })}
            </tbody>
            {submitted && (
              <tfoot>
                <tr>
                  <td colSpan={mine ? 3 : 1}>제출 총액 · VAT 별도</td>
                  <td className="lr-num tnum" colSpan={mine ? 2 : 1}>{won(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="lr-sec" aria-labelledby="lr-ov-title">
        <div className="lr-sec__head"><h2 id="lr-ov-title">{summary ? "참여 전 요약" : "의뢰 개요"}</h2></div>
        <div className="card card--rows">
          {rfq.overview.map(([k, v]) => (
            <div key={k} className="kv">
              <span className="kv__k">{k}</span>
              <span className="kv__v">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {(rfq.situation.length > 0 || rfq.ask.length > 0) && (
        <section className="lr-sec" aria-labelledby="lr-ask-title">
          <div className="lr-sec__head"><h2 id="lr-ask-title">의뢰자 설명</h2></div>
          <div className="card lr-box">
            {rfq.situation.length > 0 && (
              <div>
                <h3 className="lr-box__k">의뢰자 상황</h3>
                <ul className="lr-ul">{rfq.situation.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {rfq.ask.length > 0 && (
              <div>
                <h3 className="lr-box__k lr-box__k--ink">회신에서 설명해 주세요</h3>
                <ul className="lr-ul">{rfq.ask.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        </section>
      )}

      {!summary && (
        <section className="lr-sec" aria-labelledby="lr-common-title">
          <div className="lr-sec__head"><h2 id="lr-common-title">공통 조건</h2></div>
          <div className="card card--rows">
            {rfq.common.length === 0 && <p className="lr-empty">의뢰자가 상세 조건을 입력하지 않았어요. 기관의 설계로 견적하고 회신에 설명해 주세요.</p>}
            {rfq.common.map(([k, v]) => (
              <div key={k} className="kv">
                <span className="kv__k">{k}</span>
                <span className="kv__v" style={{ whiteSpace: "pre-wrap" }}>{v}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!summary && (
        <section className="lr-sec" aria-labelledby="lr-files-title">
          <div className="lr-sec__head">
            <h2 id="lr-files-title">첨부</h2>
            <span className="lr-sec__aside">{rfq.attachments}</span>
          </div>
          {rfq.files.length > 0 ? (
            <ul className="card card--rows lr-files">
              {rfq.files.map((f) => (
                <li key={f.id}>
                  <a href={`/api/files/${f.id}${fileToken ? `?token=${fileToken}` : ""}`}>{f.name}</a>
                  <span className="tnum">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lr-empty lr-empty--line">열람할 수 있는 첨부가 없어요.</p>
          )}
        </section>
      )}
    </>
  );

  return <CroStory got={got} replyHref={replyHref} detail={detail} qna={qna} notices={notices} main={main} side={side} sideEnd={sideEnd} />;
}
