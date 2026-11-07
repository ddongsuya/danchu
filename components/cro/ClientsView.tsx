import Link from "next/link";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { NoteComposer } from "@/components/cro/NoteComposer";
import { NoteDelete } from "@/components/cro/NoteDelete";
import type { Client, ClientDoc, FeedEvent } from "@/lib/clients";
import { md } from "@/lib/format";

const TABS = [["log", "기록"], ["won", "수주"], ["info", "정보"]] as const;
export type ClientTab = (typeof TABS)[number][0];
const kday = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

/** 고객 화면 본문 (데이터는 app/cro/clients/page.tsx 가 읽는다). 디자인 검토 화면도 같은 컴포넌트를 쓴다 */
export function ClientsView({ clients, cur, active, tab, feed, docs, notesReady }: { clients: Client[]; cur: Client | null; active: Client | null; tab: ClientTab; feed: FeedEvent[]; docs: ClientDoc[]; notesReady: boolean }) {
  if (!clients.length) {
    return (
      <>
        <div className="ph"><div><h1>고객</h1><p>우리 기관을 선정한 의뢰자가 여기에 생겨요.</p></div></div>
        <div className="empty">
          <b>아직 고객이 없어요</b>
          의뢰자가 비교표에서 우리 기관을 고르면 회사와 연락처가 공개되고 여기에 기록이 쌓여요.
          <div style={{ marginTop: 14 }}><Link href="/cro" className="b2 bsm">견적 진행 보기</Link></div>
        </div>
      </>
    );
  }

  const href = (key: string, t?: ClientTab) => `/cro/clients?c=${encodeURIComponent(key)}${t && t !== "log" ? `&tab=${t}` : ""}`;
  let lastDay = "";

  return (
    <div className={`cl${cur ? " cl--sel" : ""}`} data-tab={tab}>
      <div className="cl__list">
        <div className="pl__head"><h1>고객</h1><p>선정된 의뢰자만 생겨요</p></div>
        <div className="pl__grp">
          {clients.map((x) => (
            <Link key={x.key} href={href(x.key)} scroll={false} className="pl__it" aria-current={active?.key === x.key ? "true" : undefined}>
              <span className="pl__a">{x.name}</span>
              <span className="pl__b">{[x.orgType, `수주 ${x.wins.length}건`, x.pending ? `계약 보고 ${x.pending}건 남음` : "계약 확정"].filter(Boolean).join(" · ")}</span>
              <span className={`pl__dd${x.pending ? " pl__dd--warn" : ""}`}>{x.pending ? "보고" : ""}</span>
            </Link>
          ))}
        </div>
        <p className="pl__guard"><LockSimple size={14} aria-hidden="true" /> 선정되기 전 의뢰자는 여기에 나오지 않아요. 견적 진행에서 "선정 시 공개"로만 보여요.</p>
      </div>

      {active && (
        <>
          <article className="cl__main" aria-labelledby="cl-title">
            <Link href="/cro/clients" className="pl__back only-narrow" scroll={false}>‹ 고객</Link>
            <header className="cl__head">
              <div>
                <h2 id="cl-title">{active.name}</h2>
                <p>{[active.orgType, `처음 선정 ${md(kday(active.firstAwardAt))}`, `수주 ${active.wins.length}건`].filter(Boolean).join(" · ")}</p>
              </div>
              <Link href="/cro/docs/new" className="b2 bsm only-wide">견적서 만들기</Link>
            </header>
            <nav className="cl__tabs only-narrow" aria-label="고객 화면">
              {TABS.map(([k, l]) => (
                <Link key={k} href={href(active.key, k)} scroll={false} aria-current={tab === k ? "page" : undefined}>{k === "won" ? `${l} ${active.wins.length}` : l}</Link>
              ))}
            </nav>
            <div className="cl__feed" data-pane="log">
              {!notesReady && <p className="pl__note">메모를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
              {feed.map((e, i) => {
                const day = kday(e.at);
                const head = day !== lastDay;
                lastDay = day;
                return (
                  <div key={i} className="cl__ev">
                    {head && <div className="cl__day">{md(day)}</div>}
                    {e.kind === "note" && e.note ? (
                      <div className="cl__memo">
                        <p>{e.note.body}</p>
                        <span>
                          {[e.note.author, e.note.remind_on ? (e.note.reminded_at ? `${md(e.note.remind_on)} 알림 보냄` : `${md(e.note.remind_on)}에 알려요`) : ""].filter(Boolean).join(" · ")}
                          <NoteDelete id={e.note.id} />
                        </span>
                      </div>
                    ) : (
                      <div className="cl__sys"><b>{e.title}</b><span>{e.sub}</span></div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="cl__fix" data-pane="log">
              <NoteComposer clientKey={active.key} disabled={!notesReady} />
            </div>
          </article>
          <aside className="cl__side">
            <section className="pl__blk" data-pane="won" aria-label="이 고객과의 수주">
              <h3>이 고객과의 수주</h3>
              <div className="cl__wins">
                {active.wins.map((w) => (
                  <Link key={w.awardId} href={w.inviteId ? `/cro?sel=${w.inviteId}` : "/cro/awards"}>
                    <b>{w.substance || w.no}</b>
                    <span><span className={`pill ${w.reported ? "pill--sf" : "pill--ink"}`}>{w.reported ? "계약 확정" : "계약 진행"}</span> <span className="tnum">{(w.reported ? w.contractAmount : w.quoteAmount)?.toLocaleString("ko-KR") ?? "-"}원 · {w.no}</span></span>
                  </Link>
                ))}
              </div>
            </section>
            <dl className="cl__info" data-pane="info">
              <div><dt>담당자</dt><dd>{active.contact.name || "-"}</dd></div>
              <div><dt>이메일</dt><dd className="tnum">{active.contact.email ? <a href={`mailto:${active.contact.email}`}>{active.contact.email}</a> : "-"}</dd></div>
              <div><dt>전화</dt><dd className="tnum">{active.contact.phone ? <a href={`tel:${active.contact.phone}`}>{active.contact.phone}</a> : "-"}</dd></div>
              <div><dt>보낸 견적서</dt><dd className="tnum">{docs.length ? docs.map((d) => <Link key={d.id} href={`/cro/docs/${d.id}`} style={{ marginRight: 8 }}>{d.doc_no}</Link>) : "-"}</dd></div>
            </dl>
          </aside>
        </>
      )}
    </div>
  );
}
