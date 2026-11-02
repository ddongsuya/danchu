import type { Metadata } from "next";
import { Site } from "@/components/site/Site";

export const metadata: Metadata = { title: "페이지를 찾지 못했어요 · 단추", robots: { index: false, follow: true } };

/** 없는 주소. 명함·QR·메일 링크를 잘못 쳤을 때 처음 보는 화면이라 단추 머리글과 다음 길을 함께 보여 준다 */
export default function NotFound() {
  return (
    <Site onescreen={false} cue={false}>
      <section className="close" aria-labelledby="nf">
        <div>
          <h1 id="nf" style={{ fontSize: "clamp(28px,3.2vw,44px)", margin: 0 }}>페이지를 찾지 못했어요</h1>
          <p className="lead" style={{ marginTop: 16 }}>주소가 바뀌었거나 잘못 입력됐을 수 있어요. 메일로 받은 링크라면 메일에서 다시 열어 보세요.</p>
        </div>
        <div className="ctas">
          <a className="btn solid" href="/request">견적 요청하기</a>
          <a className="btn ghost" href="/">홈으로</a>
        </div>
      </section>
    </Site>
  );
}
