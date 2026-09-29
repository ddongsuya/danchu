export function quoteSelectable(
  q: {
    auto?: boolean | null;
    pdf_path?: string | null;
    start_date?: string | null;
    valid_until?: string | null;
  },
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
): boolean {
  return (
    !q.auto &&
    !!q.pdf_path &&
    !!q.start_date &&
    (!q.valid_until || q.valid_until >= today)
  );
}
