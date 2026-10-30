import { Site } from "@/components/site/Site";
import { StudyMark } from "@/components/site/StudyMark";
import { KINDS, type Kind } from "@/lib/study-kinds";

/**
 * 네 갈래에서 하나를 고른 뒤의 시작 화면. 네 화면이 같은 구성을 쓴다:
 * 머리(되돌아가기 · 이름 · 무엇을 확인하는 시험인지 · 상징 그래픽) → 요청서로 가는 길 → 다른 갈래가 맞는 경우
 */
export function KindStart({ kind }: { kind: Kind }) {
  const d = KINDS[kind];
  return (
    <Site cue={false}>
      <section className="tx" aria-labelledby="t">
        <div className="txhead">
          <div>
            <a className="rqback" href="/request"><span aria-hidden="true">←</span> 다른 시험 고르기</a>
            <h1 id="t">{d.name} <span>{d.tag}</span></h1>
            <p className="lead">{d.lead}</p>
          </div>
          <StudyMark kind={kind} className="txmark" />
        </div>
        <ul className={d.paths.length > 1 ? "txpick" : "txpick one"}>
          {d.paths.map((p) => (
            <li key={p.href}>
              <a href={p.href}>
                <h2>{p.title}<span className="ar" aria-hidden="true">→</span></h2>
                <p>{p.desc}</p>
                <p className="ex">{p.ex}</p>
              </a>
            </li>
          ))}
        </ul>
        <div className="txelse">
          <p className="h">이런 요청은 다른 갈래로 가세요</p>
          <ul>
            {d.elsewhere.map(([what, k]) => (
              <li key={k}>
                <a href={`/request/${k}`}><span>{what}</span><b>{KINDS[k].tag}<span className="ar" aria-hidden="true">→</span></b></a>
              </li>
            ))}
          </ul>
        </div>
        <p className="txfoot">로그인 없이 쓰고, 보내기 직전에 이메일만 확인해요. <a href="/login?next=%2Fapp%2Fnew">계정이 있다면 로그인</a></p>
      </section>
    </Site>
  );
}
