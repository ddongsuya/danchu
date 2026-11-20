import type { ContractDraft, ContractParty } from "@/lib/contract-draft";

const won = (n: number) => n.toLocaleString("ko-KR");
const ymdKo = (s: string) => `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;

function Party({ role, p }: { role: string; p: ContractParty }) {
  return (
    <div>
      <dt>{role}</dt>
      <dd>
        {p.name}
        {p.bizNo && <span>사업자등록번호 {p.bizNo}</span>}
        <span className={p.address ? undefined : "ct__blank"}>{p.address || "주소"}</span>
        {p.contact && <span>담당 {p.contact}</span>}
      </dd>
    </div>
  );
}

/** 계약서(안) 본문. 기관 화면·의뢰자 화면이 같은 것을 그린다 */
export function ContractPages({ draft }: { draft: ContractDraft }) {
  const d = draft;
  return (
    <div className="ctp">
      <article className="ct" aria-label={d.title}>
        <span className="ct__draft">초안</span>
        <h1 className="ct__title">{d.title}</h1>
        <p className="ct__meta">
          단추 요청 {d.rfqNo}{d.substance ? `, ${d.substance}` : ""}, 선정 {ymdKo(d.awardedOn)}
        </p>
        <dl className="ct__parties">
          <Party role="위탁자(갑)" p={d.sponsor} />
          <Party role="수탁자(을)" p={d.cro} />
        </dl>

        {d.articles.map((a) => (
          <section key={a.no} className="ct__art">
            <h2>
              제{a.no}조({a.title})
            </h2>
            {a.body.length === 1 ? (
              <p>{a.body[0]}</p>
            ) : (
              <ol>
                {a.body.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ol>
            )}
          </section>
        ))}

        {d.special.length > 0 && (
          <section className="ct__art">
            <h2>특약</h2>
            <ol>
              {d.special.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ol>
          </section>
        )}

        <section className="ct__art">
          <h2>별표. 시험 목록</h2>
          <table className="ct__tbl">
            <thead>
              <tr>
                <th>시험</th>
                <th className="r">기간</th>
                <th className="r">금액(원)</th>
              </tr>
            </thead>
            <tbody>
              {d.tests.map((t) => (
                <tr key={t.seq}>
                  <td>{t.name}</td>
                  <td className="r">{t.weeks ? `${t.weeks}주` : "-"}</td>
                  <td className="r">{won(t.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>공급가액</td>
                <td />
                <td className="r">{won(d.supply)}</td>
              </tr>
              <tr>
                <td>부가가치세</td>
                <td />
                <td className="r">{won(d.vat)}</td>
              </tr>
              <tr>
                <td>합계</td>
                <td />
                <td className="r">{won(d.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* 맺음말·날짜·서명란은 한 쪽에 함께 (인쇄에서 서명란만 다음 쪽으로 넘어가지 않게) */}
        <div className="ct__close">
          <p>이 계약을 증명하기 위하여 계약서 2부를 작성하여 갑과 을이 서명 또는 날인한 뒤 각 1부씩 보관한다.</p>
          <p className="ct__blank" style={{ marginTop: 8 }}>
            년 월 일
          </p>
          <div className="ct__sign">
            <div>
              <b>갑 {d.sponsor.name}</b>
              <span className="ct__blank">대표자 (인)</span>
            </div>
            <div>
              <b>을 {d.cro.name}</b>
              <span className="ct__blank">대표자 (인)</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
