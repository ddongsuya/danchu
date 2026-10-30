import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import { StudyMark } from "@/components/site/StudyMark";
import "../page.css";

export const metadata: Metadata = {
  title: "독성시험 견적 요청 · 단추",
  description: "필요한 독성시험을 찾거나 시험 항목을 직접 골라 요청서를 시작하세요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인합니다.",
};

const TOX = ["일반독성", "유전독성", "안전성약리", "생식발생독성", "발암성·종양원성", "항원성·면역독성", "국소독성", "국소내성", "동물대체시험", "환경유해성", "의료기기 생물학적 안전성"];

/** 네 갈래에서 Tox를 고른 뒤의 시작 화면: 가이드라인에서 찾기 또는 직접 고르기 */
export default function Page() {
  return (
    <Site cue={false}>
      <section className="tx" aria-labelledby="t">
        <div className="txhead">
          <div>
            <a className="rqback" href="/request"><span aria-hidden="true">←</span> 다른 시험 고르기</a>
            <h1 id="t">독성시험, 어떻게 시작할까요?</h1>
            <p className="lead">알고 있는 조건만 입력하세요. 나머지는 기관과 조율하세요.</p>
          </div>
          <StudyMark kind="tox" className="txmark" />
        </div>
        <ul className="txpick">
          <li>
            <a href="/request/new?start=advisor">
              <h2>필요한 시험 찾아보기<span className="ar" aria-hidden="true">→</span></h2>
              <p>개발 상황을 고르면 해당하는 가이드라인 기준을 보여드려요.</p>
              <p className="ex">개발 단계, 자료 제출처, 임상 투여경로와 기간</p>
            </a>
          </li>
          <li>
            <a href="/request/new?start=manual">
              <h2>시험 직접 고르기<span className="ar" aria-hidden="true">→</span></h2>
              <p>필요한 시험을 알고 계시면 바로 요청서를 쓰세요.</p>
              <p className="ex">{TOX.join(" · ")}</p>
            </a>
          </li>
        </ul>
        <p className="txfoot">로그인 없이 쓰고, 보내기 직전에 이메일만 확인해요. <a href="/login?next=%2Fapp%2Fnew">계정이 있다면 로그인</a></p>
      </section>
    </Site>
  );
}
