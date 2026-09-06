import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { addBusinessDays, formatKo, nowSeoul } from "@/lib/dates";

export const metadata: Metadata = { title: "접수 완료 — 단추" };
export const dynamic = "force-dynamic";

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ no?: string }> }) {
  const { no } = await searchParams;
  const rfqNo = no && /^DC-\d{4}-\d{4,}$/.test(no) ? no : "DC-----";
  const now = nowSeoul();
  const d1 = formatKo(addBusinessDays(now, 1));
  const d2 = formatKo(addBusinessDays(now, 5));
  const d3 = formatKo(addBusinessDays(now, 7));

  return (
    <div className="done">
      <header className="done__head">
        <div className="fm__head-in">
          <Logo />
          <LangToggle />
        </div>
      </header>
      <main className="done__main">
        <div className="done__wrap">
          <section className="done__card">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="20" fill="var(--brand)" />
              <path d="M14 22.5l5.5 5.5L30 17" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1>접수되었습니다</h1>
            <p>요청 내용을 확인한 뒤 참여 CRO에 배포합니다. 접수 확인 메일을 입력하신 주소로 보냈습니다.</p>
            <div className="rfq-no">
              <span>RFQ 번호</span>
              <span>{rfqNo}</span>
            </div>
          </section>

          <section className="next-card">
            <h2>다음 단계</h2>
            <ol>
              <li>
                <span className="step-no on">1</span>
                <div>
                  <b>참여 CRO에 배포</b>
                  <small>{d1} · CDA 필요 시 체결 후 전달</small>
                </div>
              </li>
              <li>
                <span className="step-no">2</span>
                <div>
                  <b>CRO 견적 회신</b>
                  <small>{d2}까지 · 같은 양식으로 회신</small>
                </div>
              </li>
              <li>
                <span className="step-no">3</span>
                <div>
                  <b>비교표 발송</b>
                  <small>{d3} 예정 · 이메일로 발송</small>
                </div>
              </li>
            </ol>
          </section>

          <p className="done__contact">
            문의 <a href="mailto:hello@danchu.kr">hello@danchu.kr</a>
          </p>
          <div className="done__home">
            <Link href="/">홈으로</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
