import type { Metadata } from "next";
import { pageMeta } from "@/lib/share-meta";
import { Site } from "@/components/site/Site";
import { JsonLd } from "@/components/site/JsonLd";
import { FAQ_ITEMS } from "@/lib/faq-page";
import { faqPageJsonLd } from "@/lib/structured-data";
import "./page.css";

export const metadata: Metadata = pageMeta(
  "비임상시험 견적 자주 묻는 질문 · 단추",
  "비임상시험 견적 요청부터 비임상 CRO 회신, 비교표, 기밀, 계약까지 자주 묻는 질문을 모았어요.",
  "/faq",
  ["비임상 시험 견적", "비임상시험 견적", "비임상 CRO 견적", "CRO 견적 비교"],
);

export default function Page() {
  return (
    <Site current="/faq" cue={false}>
{/* 제목과 질문 목록은 한 장면. 제목만 한 화면을 차지하면 첫 화면에 질문이 하나도 안 보인다. */}
<section className="faqs" aria-labelledby="t">
<div className="ph">
<div><h1 id="t">자주 묻는 질문</h1></div>
</div>
<div className="faq">
<input type="radio" name="fc" id="f-all" defaultChecked /><input type="radio" name="fc" id="f-plan" /><input type="radio" name="fc" id="f-time" /><input type="radio" name="fc" id="f-conf" /><input type="radio" name="fc" id="f-cmp" /><input type="radio" name="fc" id="f-deal" /><input type="radio" name="fc" id="f-cro" />
<div className="fc" role="radiogroup" aria-label="분류"><label htmlFor="f-all">전체</label><label htmlFor="f-plan">시험 구성</label><label htmlFor="f-time">기한</label><label htmlFor="f-conf">기밀</label><label htmlFor="f-cmp">비교표</label><label htmlFor="f-deal">계약</label><label htmlFor="f-cro">기관</label></div>
<div className="qs">

{FAQ_ITEMS.map((f, i) => (
<details key={f.q} className={`q c-${f.cat}`} open={i === 0}><summary>{f.q}</summary><div className="ans"><p className="al">{f.lead}</p><ul>{f.points.map((p) => <li key={p}>{p}</li>)}</ul></div></details>
))}
</div>
</div>
</section>
<section className="close" aria-labelledby="go">
<h2 id="go">견적 요청과<br /><span>문의</span></h2>
<div className="ctas"><a className="btn solid" href="/request">견적 요청</a><a className="btn ghost" href="mailto:support@danchu.kr">support@danchu.kr</a></div>
</section>
{/* 구조화 데이터는 맨 끝에 둔다: main > :first-child 규칙(site.css)이 첫 장면에 걸려 있다 */}
<JsonLd data={faqPageJsonLd()} />
    </Site>
  );
}
