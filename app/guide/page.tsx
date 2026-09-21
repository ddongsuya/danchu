import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Motion } from "@/components/Motion";
import { DurationCalc } from "@/components/guide/DurationCalc";
import { DESIGN_CARDS, DISCLAIMER, GLOSSARY, GUIDE_REVIEWED, M3_TABLE1, M3_TABLE2, PACKAGE_WHY } from "@/lib/design-guide";
import { PRESETS, presetItems } from "@/lib/presets";
import "../home.css";

export const metadata: Metadata = {
  title: "비임상 시험 가이드 · 의약품 — 단추",
  description: "임상 진입 전에 어떤 비임상 시험이 필요한지, 반복투여독성은 몇 주를 해야 하는지, 표준 설계는 어떤지 ICH·식약처 기준으로 정리했습니다.",
  robots: GUIDE_REVIEWED ? undefined : { index: false, follow: false },
};

type RV = React.CSSProperties;

export default function Guide() {
  return (
    <div className="site">
      <Motion />
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section className="sub">
          <p className="eyebrow">비임상 시험 가이드 · 의약품</p>
          <h1 className="sub__title">무슨 시험을, 어떤 설계로 해야 할까요</h1>
          <p className="sub__lead">
            처음 비임상을 준비하면 견적보다 먼저 막히는 곳이 시험 구성입니다. 공개된 가이드라인을 기준으로 출발점을 정리했습니다. 여기서 구성을 잡고, 그대로 견적을 요청할 수 있습니다.
          </p>
          <p className="guide__disc">{DISCLAIMER}</p>
          {!GUIDE_REVIEWED && <p className="guide__draft">검토 중인 초안입니다. 메뉴에는 아직 연결하지 않았습니다.</p>}
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">1 · 기간</p>
            <h2 className="h2">반복투여독성은 몇 주를 해야 할까요</h2>
            <p className="sub__lead">임상에서 투여할 기간이 비임상 기간을 정합니다. ICH M3(R2)의 기간 대응표를 그대로 옮겼습니다.</p>
            <DurationCalc />
            <div className="guide__tables">
              {([["임상시험을 뒷받침하는 최소 기간 (표 1)", M3_TABLE1], ["품목허가 신청 시 권장 기간 (표 2)", M3_TABLE2]] as const).map(([cap, rows]) => (
                <div key={cap} className="rv" data-rv style={{ "--ry": "14px" } as RV}>
                  <table className="gtbl">
                    <caption>{cap}</caption>
                    <thead><tr><th>임상 투여기간</th><th>설치류</th><th>비설치류</th></tr></thead>
                    <tbody>{rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sub">
          <p className="eyebrow">2 · 구성</p>
          <h2 className="h2">임상 1상 전에 필요한 시험 묶음</h2>
          {PACKAGE_WHY.map((w) => {
            const p = PRESETS.find((x) => x.key === w.presetKey);
            if (!p) return null;
            const cats = [...new Set(presetItems(p).map((i) => i.category))];
            return (
              <article key={w.presetKey} className="gpack rv" data-rv style={{ "--ry": "16px" } as RV}>
                <header>
                  <h3>{p.name}</h3>
                  <p>{w.headline}</p>
                </header>
                <ol className="gpack__why">
                  {w.blocks.map((b) => (
                    <li key={b.t}>
                      <b>{b.t}</b>
                      <span>{b.why}</span>
                    </li>
                  ))}
                </ol>
                <p className="gpack__later"><b>나중 단계에서 검토</b> {w.later.join(" · ")}</p>
                <p className="gpack__basis">근거 · {w.basis.join(" · ")}</p>
                <div className="gpack__cta">
                  <Link href={`/app/new?preset=${p.key}`} className="btn btn--pill" style={{ height: 44, padding: "0 20px" }}>이 구성으로 견적 요청</Link>
                  <span>{cats.join(" · ")} · {presetItems(p).length}개 항목이 요청서에 채워집니다</span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="band--soft">
          <div className="sub" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <p className="eyebrow">3 · 설계</p>
            <h2 className="h2">항목별 표준 설계</h2>
            <p className="sub__lead">기관마다 세부는 다르지만, 가이드라인이 요구하는 최소 구성은 같습니다. 요청서에서 "표준 설계로 요청"을 누르면 아래 기준으로 조건이 채워지고, 모르는 칸은 기관 제안으로 남습니다.</p>
            <div className="gcards">
              {DESIGN_CARDS.map((c, i) => (
                <article key={c.title} className="gcard rv" data-rv style={{ "--ry": "16px", "--rd": `${(i % 2) * 0.08}s` } as RV}>
                  <h3>{c.title}</h3>
                  <p className="gcard__purpose">{c.purpose}</p>
                  <dl>
                    {c.rows.map(([k, v]) => (
                      <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                  <p className="gpack__basis">근거 · {c.basis.join(" · ")}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sub">
          <p className="eyebrow">용어</p>
          <h2 className="h2">견적서에서 자주 만나는 말</h2>
          <dl className="gloss">
            {GLOSSARY.map(([t, d]) => (
              <div key={t} className="rv" data-rv style={{ "--ry": "10px" } as RV}><dt>{t}</dt><dd>{d}</dd></div>
            ))}
          </dl>
          <p className="guide__disc" style={{ marginTop: 28 }}>{DISCLAIMER} 건강기능식품, 의료기기, 화학물질 편은 준비 중입니다.</p>
        </section>

        <section className="band--surface">
          <div className="cta__in">
            <h2>구성이 잡혔다면, 같은 양식으로 견적을 받아보세요</h2>
            <Link href="/app/new" className="btn btn--pill btn--lg">무료로 견적 요청</Link>
          </div>
        </section>
      </main>
      <SiteFooter current="/guide" />
    </div>
  );
}
