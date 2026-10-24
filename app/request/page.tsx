import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import "./page.css";

export const metadata: Metadata = {
  title: "견적 요청 시작 · 단추",
  description: "필요한 시험을 찾거나 시험 항목을 직접 골라 요청서를 시작하세요. 로그인 없이 작성하고 보내기 직전에 이메일만 확인합니다.",
};

export default function Page() {
  return (
    <Site  >
<section className="rq" aria-labelledby="t">
<p className="mono" style={{ marginBottom: "16px" }}>새 견적 요청</p>
<h1 id="t">어떤 시험이 필요하신가요?</h1>
<p className="lead">알고 있는 조건만 입력하세요. 나머지는 기관과 조율하세요.</p>
<div className="pick">
<a className="opt" href="/request/new?start=advisor">
<h2>필요한 시험 찾기</h2>
<p>개발 상황을 답하면 가이드라인 근거와 함께 시험을 제안해 드려요.</p>
<span className="q" aria-hidden="true"><span>개발 단계<i>예: 임상 1상 진입</i></span><span>자료 제출처<i>예: 식약처</i></span><span>임상 투여경로와 기간<i>예: 경구, 4주</i></span></span>
<span className="go">제안 받기 <span className="ar">→</span></span>
</a>
<a className="opt" href="/request/new?start=manual">
<h2>시험 항목 직접 선택</h2>
<p>필요한 시험을 알고 있다면 바로 요청서를 작성하세요.</p>
<span className="cats" aria-hidden="true"><span>일반독성</span><span>유전독성</span><span>안전성약리</span><span>생식발생독성</span><span>발암성·종양원성</span><span>항원성·면역독성</span><span>국소독성</span><span>국소내성</span><span>PK/TK/ADME·생체시료분석</span><span>조제물분석</span><span>효력시험(약효)</span><span>동물대체시험</span><span>환경유해성</span><span>의료기기 생물학적 안전성</span><span>기타(임상병리·조직병리 등)</span></span>
<span className="go">요청서 작성 <span className="ar">→</span></span>
</a>
</div>
<ol className="four" aria-label="요청서 작성 단계">
<li><b>시험과 물질</b><span>시험 항목과 상세 조건</span></li>
<li><b>일정과 요청 조건</b><span>착수 시기, 회신 희망일, 받을 견적 수</span></li>
<li><b>자료와 정보 공개</b><span>첨부와 기밀 등급</span></li>
<li><b>확인하고 보내기</b><span>이메일만 확인하면 접수됩니다</span></li>
</ol>
<div className="guest"><span>로그인 없이 작성하고, 보내기 직전에 이메일만 확인하세요.</span><a href="/login?next=%2Fapp%2Fnew">이미 계정이 있다면 로그인</a></div>
</section>
    </Site>
  );
}
