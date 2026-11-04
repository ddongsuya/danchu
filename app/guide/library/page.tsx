import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Site } from "@/components/site/Site";
import { LIBRARY, PRODUCTS, TOPICS } from "@/lib/guideline-library";
import "./page.css";

export const metadata: Metadata = {
  title: "가이드라인 자료실 · 단추",
  description: "ICH, 식약처 고시, OECD 시험지침 등 비임상 시험 공개 가이드라인 원문을 시험 종류와 제품 유형별로 모았어요.",
};

/**
 * 공개 가이드라인 원문 목록. 원문은 발행 기관 사이트로 연결한다(파일을 올리지 않음).
 * 제품 유형 고르기는 FAQ와 같이 라디오 + CSS :has 로 거른다(자바스크립트 없이 동작).
 */
/** 주제에 들어 있는 제품 유형. 고른 유형이 없는 주제와 목차 줄은 숨긴다. */
function topicClass(topic: string) {
  return [...new Set(LIBRARY.filter((d) => d.topic === topic).flatMap((d) => d.products))].map((p) => `has-${p}`).join(" ");
}

export default function Page() {
  return (
    <Site current="/guide" onescreen={false} cue={false} next={{ href: "/guide", label: "시험 가이드" }}>
      <section className="libs" aria-labelledby="t">
        <div className="ph">
          <div><h1 id="t">가이드라인 자료실</h1></div>
          <div><p className="lead">시험 구성에 참고할 공개 가이드라인을 시험 종류별로 모았어요. 원문은 발행 기관 사이트에서 열려요.</p></div>
        </div>
        <div className="lib">
          <input type="radio" name="lp" id="p-all" defaultChecked />
          {PRODUCTS.map((p) => <input key={p.id} type="radio" name="lp" id={`p-${p.id}`} />)}
          <aside className="lside">
            <p className="lk" id="lk-p">제품 유형</p>
            <div className="lf" role="radiogroup" aria-labelledby="lk-p">
              <label htmlFor="p-all">전체</label>
              {PRODUCTS.map((p) => <label key={p.id} htmlFor={`p-${p.id}`}>{p.label}</label>)}
            </div>
            <p className="lk" id="lk-t">목차</p>
            <nav className="lt" aria-labelledby="lk-t">
              {TOPICS.map((t) => <a key={t.id} href={`#${t.id}`} className={topicClass(t.id)}>{t.title}</a>)}
            </nav>
          </aside>
          <div className="lbody">
            {TOPICS.map((t) => {
              const docs = LIBRARY.filter((d) => d.topic === t.id);
              if (!docs.length) return null;
              return (
                <section key={t.id} id={t.id} className={`ltopic ${topicClass(t.id)}`} aria-labelledby={`h-${t.id}`}>
                  <h2 id={`h-${t.id}`}>{t.title}</h2>
                  <ul>
                    {docs.map((d) => (
                      <li key={d.short} className={`ldoc ${d.products.map((p) => `p-${p}`).join(" ")}`}>
                        <b>{d.short}</b>
                        <div>
                          <p>{d.about}</p>
                          <small>{d.name} · {d.by}</small>
                        </div>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" aria-label={`${d.short} 원문 보기 (새 창)`}>
                          원문 보기 <ArrowUpRight size={15} aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className="ldisc">가이드라인은 개정될 수 있어요. 제출 전에는 원문 사이트에서 최신 개정판을 확인하세요. 최종 설계는 규제기관, 담당 기관과 함께 논의하세요.</p>
          </div>
        </div>
      </section>
    </Site>
  );
}
