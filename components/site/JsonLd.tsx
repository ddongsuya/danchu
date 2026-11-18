import { jsonLdString } from "@/lib/structured-data";

/** 구조화 데이터(JSON-LD). 실행되는 스크립트가 아니라 데이터 블록이라 CSP script-src 의 대상이 아니다 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
