import Link from "next/link";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { GROUP_LABEL, groupPipeline, type PipeItem } from "@/lib/pipeline";
import { dday } from "@/lib/format";

/**
 * 견적 진행 (2026-11-07). 넓은 화면: 왼쪽 목록 + 오른쪽 상세. 휴대폰: 목록 화면 → 누르면 상세 화면(?sel=).
 * 상세 맨 아래에는 그 요청에서 할 일 버튼 하나만 둔다.
 */
export type CroPaths = { pipe: string; clients: string };
export const CRO_PATHS: CroPaths = { pipe: "/cro", clients: "/cro/clients" };

export function Pipeline({ items, sel, paths = CRO_PATHS, companyOf = {} }: { items: PipeItem[]; sel: string | null; paths?: CroPaths; companyOf?: Record<string, string> }) {
  const groups = groupPipeline(items);
  const cur = items.find((x) => x.id === sel) ?? null;
  const active = cur ?? items[0] ?? null;
  const todo = items.filter((x) => x.group === "todo").length;
  const live = items.filter((x) => x.group !== "done").length;

  if (!items.length) {
    return (
      <>
        <div className="ph"><div><h1>견적 진행</h1></div></div>
        <div className="empty">
          <b>아직 받은 요청이 없어요</b>
          시험 목록의 분야와 맞는 요청이 오면 참여 안내를 메일과 알림으로 보내요.
          <div style={{ marginTop: 14 }}><Link href="/cro/catalog" className="b2 bsm">시험 목록 보기</Link></div>
        </div>
      </>
    );
  }

  return (
    <div className={`pl${cur ? " pl--sel" : ""}`}>
      <div className="pl__list">
        <div className="pl__head">
          <h1>견적 진행</h1>
          <p className="tnum">할 일 {todo}건 · 진행 중 {live}건</p>
        </div>
        {groups.map((g) => (
          <section key={g.group} className="pl__grp" aria-label={GROUP_LABEL[g.group]}>
            <h2><span>{GROUP_LABEL[g.group]}</span><span className="tnum">{g.items.length}</span></h2>
            {g.items.map((x) => (
              <Link key={x.id} href={`${paths.pipe}?sel=${x.id}`} scroll={false} className="pl__it" aria-current={active?.id === x.id ? "true" : undefined}>
                <span className="pl__a">{g.group === "todo" ? x.next : x.title}</span>
                <span className="pl__b">{g.group === "todo" ? x.title : x.next} · {x.client ?? "선정 시 공개"}</span>
                <Due item={x} />
              </Link>
            ))}
          </section>
        ))}
      </div>
      {active && <Detail item={active} paths={paths} companyOf={companyOf} />}
    </div>
  );
}

function Due({ item }: { item: PipeItem }) {
  if (!item.due) return item.group === "todo" ? <span className="pl__dd pl__dd--warn">지금</span> : <span className="pl__dd" />;
  const d = dday(item.due);
  const warn = item.group !== "done" && item.group !== "sent" && d.n <= 3;
  const label = d.n > 14 ? `${+item.due.slice(5, 7)}.${item.due.slice(8, 10)}` : d.label;
  return <span className={`pl__dd${warn ? " pl__dd--warn" : ""}`}>{label}</span>;
}

function Detail({ item, paths, companyOf }: { item: PipeItem; paths: CroPaths; companyOf: Record<string, string> }) {
  return (
    <article className="pl__detail" aria-labelledby="pl-title">
      <Link href={paths.pipe} className="pl__back only-narrow" scroll={false}>‹ 견적 진행</Link>
      <div className="pl__body">
        <header className="pl__rh">
          <div>
            <span className="pl__no tnum">{item.no}{item.cats ? ` · ${item.cats}` : ""}</span>
            <h2 id="pl-title">{item.title}</h2>
            <span className="pl__who">
              {item.client
                ? item.clientKey ? <Link href={companyOf[item.clientKey] ? `${paths.clients}/${companyOf[item.clientKey]}` : paths.clients}>{item.client}</Link> : item.client
                : <><LockSimple size={13} aria-hidden="true" /> 선정 시 공개 · {item.clientHint.replace(" · 이름은 선정 뒤 공개", "")}</>}
            </span>
          </div>
          <span className={`pill ${item.group === "done" ? "pill--sf" : item.group === "won" || item.stageLabel.startsWith("계약") ? "pill--ink" : "pill--sf"}`}>{item.stageLabel}</span>
        </header>
        <div className="pl__cols">
          <section className="pl__blk" aria-label="진행">
            <h3>진행</h3>
            <ol className="pl__steps">
              {item.steps.map((s, i) => (
                <li key={i} data-s={s.state}><span className="pl__dot" aria-hidden="true" /><span>{s.label}</span><time className="tnum">{s.at}</time></li>
              ))}
            </ol>
          </section>
          <section className="pl__blk" aria-label="금액">
            <h3>{item.group === "todo" && item.stageLabel === "참여 결정 전" ? "참여 조건" : "금액"}</h3>
            {item.money.length > 0 && (
              <dl className="pl__money">
                {item.money.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>))}
              </dl>
            )}
            <p className="pl__note">{item.note}</p>
          </section>
        </div>
        {!item.client && <p className="pl__guard"><LockSimple size={14} aria-hidden="true" /> 의뢰자 회사와 연락처는 이 기관이 선정되면 공개돼요.</p>}
      </div>
      <div className="pl__fix">
        <span>{item.next}{item.due ? ` · ${dday(item.due).label}` : ""}</span>
        {item.action && <Link href={item.action.href} className="b1">{item.action.label}</Link>}
      </div>
    </article>
  );
}
