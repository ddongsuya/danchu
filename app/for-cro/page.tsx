import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../home.css";

export const metadata: Metadata = { title: "CRO 참여 안내 — 단추", description: "GLP 인증 비임상 CRO가 단추에 참여하는 방법과 회신 방식을 안내합니다." };

const STEPS = [
  ["가입 신청", "기관명, 보유 GLP 인증, 수행 가능 시험 분야를 등록합니다. 단추가 확인한 뒤 영업일 1~2일 안에 승인합니다."],
  ["요청서 수신", "수행 분야에 맞는 요청서만 메일과 포털로 받습니다. 기밀 등급이 CDA인 요청은 체결 후 회사명과 첨부가 열립니다."],
  ["표준 양식 회신", "요청서에서 자동 생성된 항목 행에 가능 여부·금액·기간만 채우고 정식 견적서 PDF를 첨부합니다. 항목 5개 기준 5분이면 됩니다."],
  ["선정 시 연락처 공개", "의뢰자가 선택하면 그 기관에만 연락처가 공개되고, 계약은 직접 진행합니다. 체결 후 계약 정보를 보고합니다."],
];

const RULES = [
  ["타사 견적 비열람", "비교표는 의뢰자에게만 전달됩니다. 다른 기관의 금액을 볼 수 없고, 단추도 특정 기관을 추천하지 않습니다."],
  ["정본은 PDF", "구조화 필드는 비교표 생성에만 쓰이고, 계약의 근거는 첨부한 정식 견적서입니다. 둘이 다르면 PDF가 우선합니다."],
  ["추가 제안 가능", "요청서에 없지만 규제상 필요한 시험은 제안 항목으로 별도 표시됩니다. 가격이 아니라 전문성으로 경쟁할 수 있는 장치입니다."],
];

export default function ForCro() {
  return (
    <div className="site">
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section className="sub">
          <p className="eyebrow">CRO 참여 안내</p>
          <h1 className="sub__title">요청서는 단추가 모으고, 회신은 5분이면 됩니다</h1>
          <p className="sub__lead">
            영업 문의를 따로 받지 않아도 수행 분야에 맞는 요청서가 정리되어 도착합니다. 항목별 금액과 기간만 채우면 의뢰자에게 같은 형식의 비교표로 전달됩니다.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "28px 0 0" }}>
            <Link href="/signup/cro" className="btn btn--pill btn--lg">CRO 가입 신청</Link>
            <Link href="/login" className="btn btn--outline" style={{ display: "inline-flex", alignItems: "center", padding: "0 20px" }}>이미 계정이 있어요</Link>
          </div>
        </section>

        <section className="sub" style={{ paddingTop: 0 }}>
          <h2 className="h2">참여 절차</h2>
          <ol className="steps">
            {STEPS.map(([t, p], i) => (
              <li key={t}>
                <span className="steps__no">0{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="band--dark">
          <div className="wrap">
            {RULES.map(([t, p], i) => (
              <div key={t} className="trust">
                <p className="trust__lab">원칙 {i + 1}</p>
                <h3 style={{ fontSize: 22 }}>{t}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="band--surface">
          <div className="cta__in">
            <h2>참여 기관으로 등록하세요</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>가입 신청 후 승인까지 영업일 1~2일</p>
            <Link href="/signup/cro" className="btn btn--pill btn--lg">CRO 가입 신청</Link>
            <a href="mailto:hello@danchu.kr?subject=%5B%EB%8B%A8%EC%B6%94%5D%20CRO%20%EC%B0%B8%EC%97%AC%20%EB%AC%B8%EC%9D%98" style={{ fontSize: 14, color: "var(--muted)" }}>문의 · hello@danchu.kr</a>
          </div>
        </section>
      </main>
      <SiteFooter current="/for-cro" />
    </div>
  );
}
