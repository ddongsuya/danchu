export function quoteSelectable(
  q: {
    auto?: boolean | null;
    pdf_path?: string | null;
    start_date?: string | null;
    valid_until?: string | null;
  },
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
): boolean {
  // 견적서 PDF는 선택 첨부다(2026-11-18 사용자 결정, 웹·에이전트 같은 규칙). 선정 조건은 예비 견적이 아니고 착수일·유효기간이 맞는지만 본다.
  return (
    !q.auto &&
    !!q.start_date &&
    (!q.valid_until || q.valid_until >= today)
  );
}
