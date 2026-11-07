import Link from "next/link";
import { LockSimple, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { COMPANY_FILTERS, EVENT_KIND, agoLabel, hmKst, mdW, wonKo, ymdKst, type CompanyFilter, type CompanyRow } from "@/lib/crm-shape";
import { CompanyForm, MergeButton, SheetButton } from "./forms";
import { qs, type CrmPaths } from "./opts";

type Dup = { a: { id: string; name: string }; b: { id: string; name: string } };

/**
 * 고객사 목록 (0038). 다음 일정이 가까운 곳, 열린 견적이 있는 곳이 위로 온다.
 * 넓은 화면: 다섯 칸 줄. 휴대폰: 이름 · 한 줄 요약 · 다음 일정. 추가 버튼은 바닥에 하나.
 */
export function CompanyList({ rows, total, filter, q, dups, paths, now = Date.now(), ready }: {
  rows: CompanyRow[]; total: { companies: number; contacts: number; openQuotes: number }; filter: CompanyFilter; q: string; dups: Dup[]; paths: CrmPaths; now?: number; ready: boolean;
}) {
  const add = <SheetButton label="고객사 추가" title="고객사 추가" className="b1"><CompanyForm /></SheetButton>;
  const today = ymdKst(new Date(now));

  if (!ready) {
    return (
      <div className="crm">
        <div className="ph"><div><h1>고객사</h1></div></div>
        <div className="empty"><b>고객사를 불러오지 못했어요</b>잠시 뒤 다시 열어 주세요. 계속 안 되면 운영자에게 알려 주세요.</div>
      </div>
    );
  }

  if (!total.companies) {
    return (
      <div className="crm">
        <div className="ph"><div><h1>고객사</h1><p>고객사 → 담당자 → 보낸 견적 → 미팅·통화 기록 → 할 일까지 한곳에 남겨요.</p></div></div>
        <div className="empty">
          <b>아직 고객사가 없어요</b>
          단추에서 우리 기관이 선정되면 그 회사와 담당자가 자동으로 들어와요. 단추 밖에서 만나는 고객사는 직접 추가해요.
          <div className="crm-empty__act">{add}</div>
        </div>
        <p className="crm-guard"><LockSimple size={14} aria-hidden="true" /> 선정되기 전 단추 의뢰자는 고객사로 만들 수 없어요. 여기 적은 내용은 우리 기관만 봐요.</p>
      </div>
    );
  }

  return (
    <div className="crm">
      <header className="crm-ph">
        <div>
          <h1>고객사</h1>
          <p className="tnum">고객사 {total.companies}곳 · 담당자 {total.contacts}명 · 열린 견적 {total.openQuotes}건</p>
        </div>
        <div className="only-wide">{add}</div>
      </header>

      <div className="crm-bar">
        <nav className="crm-filters" aria-label="고객사 거르기">
          {(Object.keys(COMPANY_FILTERS) as CompanyFilter[]).map((k) => (
            <Link key={k} href={qs(paths.clients, { f: k === "all" ? null : k, q })} aria-current={filter === k ? "page" : undefined} scroll={false}>{COMPANY_FILTERS[k]}</Link>
          ))}
        </nav>
        <form className="crm-search" action={paths.clients} role="search">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <MagnifyingGlass size={18} aria-hidden="true" />
          <label htmlFor="crm-q" className="sr-only">고객사 찾기</label>
          <input id="crm-q" name="q" className="inp" defaultValue={q} maxLength={60} placeholder="고객사, 담당자 이름" />
        </form>
      </div>

      {dups.length > 0 && (
        <section className="crm-dups" aria-label="같은 회사일 수 있는 고객사">
          <b>같은 회사일 수 있어요</b>
          {dups.slice(0, 3).map((d) => (
            <p key={`${d.a.id}-${d.b.id}`}>
              <span>{d.a.name} · {d.b.name}</span>
              <MergeButton keep={d.a.id} drop={d.b.id} label={`${d.a.name}에 합치기`} />
            </p>
          ))}
        </section>
      )}

      {rows.length ? (
        <div className="crm-tbl">
          <div className="crm-tbl__h only-wide" aria-hidden="true">
            <span>고객사</span><span>담당자</span><span>열린 견적</span><span>다음 일정</span><span>마지막 연락</span>
          </div>
          {rows.map((r) => {
            const next = r.nextAt ? `${mdW(ymdKst(r.nextAt))}${r.nextKind === "deadline" ? "" : ` ${hmKst(r.nextAt)}`}` : null;
            const soon = !!r.nextAt && ymdKst(r.nextAt) <= today;
            return (
              <Link key={r.company.id} href={`${paths.clients}/${r.company.id}`} className="crm-tbl__r">
                <span className="crm-c1">
                  <b>{r.company.name}</b>
                  {r.danchu && <span className="crm-tag">단추에서 선정</span>}
                  <small>{[r.company.industry, r.company.first_deal ? "첫 거래 전" : r.won ? `수주 ${r.won}건` : ""].filter(Boolean).join(" · ") || " "}</small>
                </span>
                <span className="crm-c2">{r.leadName ? `${r.leadName}${r.contacts > 1 ? ` 외 ${r.contacts - 1}명` : ""}` : "담당자 없음"}</span>
                <span className="crm-c3 tnum">{r.openQuotes ? `${r.openQuotes}건 · ${wonKo(r.openAmount)}` : "-"}</span>
                <span className="crm-c4">
                  {next ? <><time className={`tnum${soon ? " crm-hl" : ""}`}>{next}</time> <span>{r.nextTitle ?? EVENT_KIND[r.nextKind ?? ""]}</span></> : <span className="crm-mute">없음</span>}
                </span>
                <span className="crm-c5">{r.quiet ? <span className="crm-warn">{r.lastAt ? agoLabel(r.lastAt, now) : "연락 기록 없음"}</span> : agoLabel(r.lastAt, now)}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <b>조건에 맞는 고객사가 없어요</b>
          {q ? `"${q}"와 이름이 맞는 고객사가 없어요. 다른 이름이나 별칭으로 찾아보세요.` : "다른 조건을 골라 보세요."}
          <div className="crm-empty__act"><Link href={paths.clients} className="b2 bsm">전체 보기</Link></div>
        </div>
      )}

      <p className="crm-guard"><LockSimple size={14} aria-hidden="true" /> 선정되기 전 단추 의뢰자는 여기에 나오지 않아요. 여기 적은 내용은 우리 기관만 보고, 단추는 요청 전달·비교표에 쓰지 않아요.</p>
      <div className="crm-dock only-narrow">{add}</div>
    </div>
  );
}
