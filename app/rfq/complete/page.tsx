import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { addBusinessDays, formatKo, nowSeoul } from "@/lib/dates";

export const metadata: Metadata = { title: "접수 완료 — 단추" };
export const dynamic = "force-dynamic";

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ no?: string; upfail?: string; email?: string }> }) {
  const { no, upfail, email } = await searchParams;
  const signupHref = `/signup${email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `?email=${encodeURIComponent(email)}` : ""}`;
  const rfqNo = no && /^DC-\d{4}-\d{4,}$/.test(no) ? no : "DC-----";
  const failed = upfail && /^\d{1,2}$/.test(upfail) ? Number(upfail) : 0;
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
            {failed > 0 && (
              <p className="error" role="alert" style={{ marginTop: 16, textAlign: "left" }}>
                첨부 파일 {failed}개가 업로드되지 않았습니다. 접수는 완료되었으니, 파일은 RFQ 번호를 적어{" "}
                <a href={`mailto:hello@danchu.kr?subject=${encodeURIComponent(`[${rfqNo}] 첨부 파일`)}`}>hello@danchu.kr</a>로 보내주세요.
              </p>
            )}
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

          <section className="next-card" style={{ background: "var(--brand-tint)", borderColor: "var(--brand-line)" }}>
            <h2>진행 상황을 앱에서 보려면</h2>
            <p style={{ margin: 0, color: "var(--body)", fontSize: 15 }}>같은 이메일로 가입하면 이 요청이 계정에 연결되고, 견적 도착·비교표·CRO 선택까지 한곳에서 진행할 수 있습니다.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={signupHref} className="btn btn--pill btn--sm">가입하고 진행 상황 보기</Link>
              <Link href="/login" className="btn--outline" style={{ display: "inline-flex", alignItems: "center" }}>이미 계정이 있어요</Link>
            </div>
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
