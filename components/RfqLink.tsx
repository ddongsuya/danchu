import Link from "next/link";

/**
 * 견적 요청 진입점 — 항상 웹 폼(/rfq)으로 보낸다.
 * 앱 위자드(/app/new)는 계정에서 담당자 정보를 채우는 구조라, 로그인이 붙기 전에는
 * 실제 고객을 보내면 데모 인물 명의로 접수된다. 로그인 연동 후 기기 판정을 다시 넣는다.
 */
export function RfqLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link href="/rfq" className={className}>
      {children}
    </Link>
  );
}
