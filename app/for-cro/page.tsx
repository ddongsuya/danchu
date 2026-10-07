import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { INCLUDE_KEYS } from "@/lib/catalog";
import "../site.css";

export const metadata: Metadata = {
  title: "기관 참여 안내 · 단추",
  description: "수행 분야에 맞는 요청서만 받고, 카탈로그로 채워진 초안에서 다른 부분만 확인해 회신합니다. 다른 기관의 회신은 볼 수 없습니다.",
};

const STEPS: [string, string][] = [
  ["참여 신청", "기관명, 사업자등록번호, 시험시설 소재지, 보유 GLP 인증, 수행 가능 시험 분야, 담당자를 적어 신청합니다. 단추가 기관 정보를 확인한 뒤 승인하며, 보통 영업일 1~2일이 걸립니다."],
  ["역량 카탈로그 등록", "동물종, 투여경로, 시험법 조합별로 금액과 기간, 기본 포함 항목을 등록합니다. 수행하지 않는 항목은 꺼 둡니다. 꺼 둔 항목만 있는 요청은 오지 않습니다."],
  ["요청서 수신", "수행 분야가 맞는 요청서가 메일 링크와 포털로 옵니다. 링크는 로그인 없이 열리고 회신 기한 후 7일까지 유효합니다. 기한 이틀 전과 당일에 알림이 갑니다."],
  ["회신 작성", "카탈로그를 등록해 두었다면 초안이 채워진 채 열립니다. 요청 조건이 카탈로그와 다른 항목에만 '확인 필요' 표시가 붙고, 그 항목만 보고 제출하면 됩니다. 기한 전까지 수정할 수 있습니다."],
  ["견적서 원본(PDF) 첨부 · 제출", "기관의 정식 견적서를 붙여 제출합니다. 제출한 금액은 카탈로그에 '최근 회신'으로 반영되어 다음 초안에 쓰입니다."],
  ["선정 · 계약 보고", "선정되면 의뢰자 회사명과 담당자 연락처를 받고 직접 계약합니다. 체결일과 계약금액(VAT 별도)을 보고하면 요청이 종료됩니다. 선정되지 않으면 결과만 안내받습니다."],
];

const FORM: [string, string][] = [
  ["항목별 수행 여부", "가능 · 조건부 가능 · 불가. 조건부는 조건과 기준 금액, 불가는 사유를 적습니다."],
  ["금액 · 예상 소요기간", "VAT 별도. 예상 소요기간은 동물 입고일부터 최종보고서(안) 발행일까지 주 단위. 검체 단가로 견적하는 분야(PK/TK, 조제물분석)는 검체당 단가와 검체 수."],
  ["설계 요약", "동물종·계통, 대조군·시험군 수, 군당 마릿수, 회복기간과 회복군, 투여경로·빈도·기간, 시험법·가이드라인."],
  ["기관마다 다른 부분 설명", "회복 동물 지정 방식, TK 채혈 방식과 시점, 조직병리 범위, 용량결정시험 포함 여부처럼 가이드라인이 정하지 않은 것. 비교표에 기관의 설명이 그대로 나란히 표시됩니다."],
  ["기본 포함 항목", INCLUDE_KEYS.join(", ") + ". 포함하지 않은 항목은 비교표에 취소선으로 표시됩니다."],
  ["공통 조건", "착수 가능일, 견적 유효기간(비우면 제출일 기준 30일), 결제 조건, 시험물질 필요량, 보고서 언어, 제외 항목과 별도 옵션."],
];

const RULES: [string, string][] = [
  ["다른 기관의 회신은 볼 수 없습니다", "비교표는 의뢰자에게만 전달됩니다. 선정되지 않은 기관에는 금액이나 다른 기관명 없이 결과만 안내합니다."],
  ["같은 요청서, 같은 기한", "배포된 기관은 같은 요청서를 같은 기한에 받습니다. 승인이 늦은 기관에도 열려 있는 요청은 같은 기한으로 갑니다."],
  ["정본은 PDF", "비교표와 PDF가 다르면 PDF가 우선합니다. 불일치가 발견되면 단추가 확인을 요청합니다."],
  ["의뢰자 정보 공개", "모든 요청에서 의뢰자 회사명과 담당자 연락처는 선정 전까지 보이지 않고 기관 유형·개발 단계·제출처·시험 조건만 보입니다. 의뢰자가 비교표에서 귀 기관을 선정하면 공개됩니다. CDA 필요 요청은 첨부도 비밀유지계약 체결을 운영자가 확인한 뒤 열립니다."],
  ["예비 견적 자동 제출", "기관 설정에서 켜면 기한까지 손대지 않은 초안을 예비 견적으로 제출합니다. 확인 필요 항목이 남아 있으면 제출하지 않습니다."],
  ["이용 조건", "의뢰자에게는 비용을 청구하지 않습니다. 기관 참여 조건은 이용약관 제5조에 따라 별도 계약으로 정합니다."],
];

export default function ForCro() {
  return (
    <div className="site">
      <SiteHeader />
      <main id="main-content">
        <section className="ph">
          <div className="wrap ph__grid">
            <span className="ph__k">기관 참여 안내</span>
            <h1>요청서는 단추가 모으고, 기관은 다른 부분만 채웁니다</h1>
            <p className="ph__lead">수행 분야가 맞는 요청서만 받습니다. 카탈로그를 등록해 두면 회신 초안이 채워진 채 열리고, 요청 조건과 다른 항목에만 '확인 필요' 표시가 붙습니다. 다른 기관의 회신은 볼 수 없습니다.</p>
            <p className="ph__note"><Link href="/signup/cro" className="b b--fill">기관 참여 신청</Link></p>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>참여 절차</h2></div>
            <div className="doc__body">
              <dl className="dl dl--num">
                {STEPS.map(([k, v], i) => <div key={k}><dt data-n={String(i + 1).padStart(2, "0")}>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside">
              <h2>회신 양식</h2>
              <p>행은 요청서의 항목에서 만들어집니다. 기관은 칸을 채웁니다.</p>
            </div>
            <div className="doc__body">
              <dl className="dl dl--wide">
                {FORM.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <p className="note">시험물질과 표준품은 의뢰자 제공이 원칙입니다. 의뢰자가 상세 조건을 비워 두면 기관의 설계로 견적하고, 그 내용을 설계 요약과 설명 칸에 적습니다.</p>
            </div>
          </div>
        </section>

        <section className="doc">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>규칙</h2></div>
            <div className="doc__body">
              <dl className="dl dl--wide">
                {RULES.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          </div>
        </section>

        <section className="doc doc--tight">
          <div className="wrap doc__grid">
            <div className="doc__aside"><h2>신청</h2></div>
            <div className="doc__body">
              <p>가입 신청서에는 기관명, 보유 GLP 인증, 수행 가능 시험 분야, 담당자 연락처가 필요합니다. 같은 기관의 담당자가 이미 있으면 담당자 추가로 접수됩니다.</p>
              <div className="hero__cta">
                <Link href="/signup/cro" className="b b--fill">기관 참여 신청</Link>
                <a href="mailto:hello@danchu.kr" className="b b--line">hello@danchu.kr</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter current="/for-cro" />
    </div>
  );
}
