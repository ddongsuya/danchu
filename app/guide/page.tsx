import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DurationCalc } from "@/components/guide/DurationCalc";
import { DESIGN_CARDS, DISCLAIMER, GLOSSARY, GUIDE_REVIEWED, M3_TABLE1, M3_TABLE2, PACKAGE_WHY } from "@/lib/design-guide";
import { PRESETS, presetItems } from "@/lib/presets";
import "../site.css";

export const metadata: Metadata = {
  title: "비임상 시험 가이드 · 의약품 · 단추",
  description: "임상 진입 전에 어떤 비임상 시험이 필요한지, 반복투여독성은 몇 주를 해야 하는지, 통상 어떻게 설계하는지 ICH·식약처 기준으로 정리했습니다.",
  robots: GUIDE_REVIEWED ? undefined : { index: false, follow: false },
};

export default function Guide() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <section className="ph">
          <div className="wrap ph__grid">
            <span className="ph__k">가이드 · 의약품</span>
            <h1>의약품 비임상, 무슨 시험을 어떤 설계로 해야 할까요</h1>
            <p className="ph__lead">처음 비임상을 준비하면 견적보다 먼저 막히는 곳이 시험 구성입니다. 공개된 가이드라인을 기준으로 출발점을 정리했습니다. 여기서 구성을 잡고 그대로 요청서를 만들 수 있습니다.</p>
            <p className="ph__note">{DISCLAIMER}</p>
            {!GUIDE_REVIEWED && <span className="ph__warn">검토 중인 초안입니다. 메뉴에는 아직 연결하지 않았습니다.</span>}
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>반복투여독성은 몇 주를 해야 할까요</h2>
              <p>임상에서 투여할 기간이 비임상 기간을 정합니다. ICH M3(R2)의 기간 대응표를 그대로 옮겼습니다.</p>
            </div>
            <div className="doc__body">
              <DurationCalc />
              <div className="gt2">
                {([["임상시험을 뒷받침하는 최소 기간 (표 1)", M3_TABLE1], ["품목허가 신청 시 권장 기간 (표 2)", M3_TABLE2]] as const).map(([cap, rows]) => (
                  <table key={cap} className="gt">
                    <caption>{cap}</caption>
                    <thead><tr><th>임상 투여기간</th><th>설치류</th><th>비설치류</th></tr></thead>
                    <tbody>{rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
                  </table>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>임상 1상 전에 필요한 시험 묶음</h2></div>
            <div className="doc__body">
              {PACKAGE_WHY.map((w) => {
                const p = PRESETS.find((x) => x.key === w.presetKey);
                if (!p) return null;
                const cats = [...new Set(presetItems(p).map((i) => i.category))];
                return (
                  <article key={w.presetKey} className="pack">
                    <header className="pack__head">
                      <h3>{p.name}</h3>
                      <p>{w.headline}</p>
                    </header>
                    <ol>
                      {w.blocks.map((b) => <li key={b.t}><b>{b.t}</b><span>{b.why}</span></li>)}
                    </ol>
                    <p className="pack__meta"><b>나중 단계에서 검토</b> · {w.later.join(" · ")}</p>
                    <p className="cite">근거 · {w.basis.join(" · ")}</p>
                    <div className="pack__cta">
                      <Link href={`/app/new?preset=${p.key}`} className="b b--line b--sm">이 구성으로 요청서 만들기</Link>
                      <span>{cats.join(" · ")} · {presetItems(p).length}개 항목이 요청서에 채워집니다</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>항목별 설계 예</h2>
              <p>단추가 정한 기준이 아니라 가이드라인에 근거한 예입니다. 세부는 기관마다 다릅니다.</p>
            </div>
            <div className="doc__body">
              <div className="cards">
                {DESIGN_CARDS.map((c) => (
                  <article key={c.title} className="card">
                    <h3>{c.title}</h3>
                    <p className="card__p">{c.purpose}</p>
                    <dl>
                      {c.rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}
                    </dl>
                    <p className="cite">근거 · {c.basis.join(" · ")}</p>
                  </article>
                ))}
              </div>
              <p className="small muted">요청서에서 "이 예로 채우기"를 누르면 조건이 채워지고, 기관은 자신의 방식을 회신에 설명합니다.</p>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>견적서에서 자주 만나는 말</h2></div>
            <div className="doc__body">
              <dl className="gloss">
                {GLOSSARY.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
              </dl>
              <p className="small muted">{DISCLAIMER} 건강기능식품, 의료기기, 화학물질 편은 준비 중입니다.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current="/guide" />
    </div>
  );
}
