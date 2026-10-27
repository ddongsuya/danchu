import { Site } from "@/components/site/Site";
import { BUSINESS } from "@/lib/business";

/** 약관·개인정보처리방침 공통 레이아웃 (공개 사이트 골격, 한 화면 스냅은 쓰지 않는다) */
export function LegalLayout({
  title,
  effectiveDate,
  version,
  current,
  notice,
  noticeSummary,
  children,
}: {
  title: string;
  effectiveDate: string;
  version: string;
  current?: string;
  /** 개정 공지 (시행 전 공지 기간에 바뀌는 내용과 이전 판의 적용 기간을 알린다) */
  notice?: React.ReactNode;
  /** 개정 안내를 접어 둘 때 늘 보이는 한 줄 요약. 없으면 안내 전체를 펼쳐 보인다 */
  noticeSummary?: string;
  children: React.ReactNode;
}) {
  return (
    <Site current={current} onescreen={false} cue={false}>
      <div className="legal-main">
        <article className="legal">
          <h1 className="legal__title">{title}</h1>
          <p className="legal__meta">
            시행일 {effectiveDate} · {version}
          </p>
          {notice &&
            (noticeSummary ? (
              <details className="legal__notice">
                <summary>{noticeSummary}</summary>
                {notice}
              </details>
            ) : (
              <aside className="legal__notice">{notice}</aside>
            ))}
          {children}
          <div className="legal__back">
            <a href="/" className="btn ghost sm">
              홈으로
            </a>
          </div>
        </article>
      </div>
    </Site>
  );
}

/** 가로 스크롤 가능한 표 래퍼 */
export function LegalTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal__table-wrap">
      <table>{children}</table>
    </div>
  );
}

/** 문서 맨 아래 운영자 정보 한 줄. lib/business.ts 에서 채운 값만 보인다 */
export function BusinessNote() {
  const parts = [
    `운영: ${BUSINESS.name}`,
    BUSINESS.owner && `대표 ${BUSINESS.owner}`,
    BUSINESS.bizNo && `사업자등록번호 ${BUSINESS.bizNo}`,
    BUSINESS.address && `주소 ${BUSINESS.address}`,
  ].filter(Boolean);
  return (
    <p className="legal__note">
      {parts.join(" · ")} · 문의 <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
    </p>
  );
}
