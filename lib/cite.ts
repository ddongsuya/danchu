/**
 * 화면에 보이는 가이드라인 근거 표기를 "어느 문서의 몇 번"까지만 줄인다.
 * 예: "ICH M3(R2) §9 · 고시 별표 4" → "ICH M3 · 식약처 독성시험기준"
 * 조항(§), 표, 별표, 주 번호 같은 세부는 화면에서 빼고, 필요하면 펼쳐서 원문 표기를 본다(components/Cite.tsx).
 * 원래 근거 문자열은 lib/advisor.ts 등 데이터에 그대로 남긴다.
 */

/** 긴 문서 이름 → 화면용 짧은 이름. 앞부분이 같으면 바꾼다(긴 이름을 먼저). */
const DOCS: [string, string][] = [
  ["식약처 「의약품등의 독성시험기준」", "식약처 독성시험기준"],
  ["의약품등의 독성시험기준", "식약처 독성시험기준"],
  ["의약품 임상시험 계획 승인에 관한 규정", "식약처 임상시험 승인 규정"],
  ["생물학적제제 등의 품목허가·심사 규정", "식약처 생물의약품 심사 규정"],
  ["의약품 품목허가·신고·심사 규정", "식약처 품목허가 규정"],
  ["품목허가·신고·심사 규정", "식약처 품목허가 규정"],
  ["동등생물의약품 평가 가이드라인", "식약처 동등생물의약품 가이드라인"],
  ["건강기능식품 기능성 원료 및 기준·규격 인정에 관한 규정", "식약처 건강기능식품 인정 규정"],
  ["같은 규정", "식약처 건강기능식품 인정 규정"],
  ["기능성화장품 심사에 관한 규정", "식약처 기능성화장품 심사 규정"],
  ["화장품 원료 사용금지 해제·변경 및 사용기준 지정·변경 심사에 관한 규정", "식약처 화장품 원료 심사 규정"],
  ["의료기기의 생물학적 안전에 관한 공통기준규격", "식약처 의료기기 생물학적 안전 기준"],
  ["농약 및 원제의 등록기준", "농약 등록기준"],
  ["화학물질의 등록 및 평가 등에 관한 법률 시행규칙", "화평법 시행규칙"],
  ["화학물질의 등록 및 평가 등에 관한 법률", "화평법"],
  ["비임상시험관리기준", "식약처 GLP 기준"],
  ["OECD GLP 원칙", "OECD GLP 원칙"],
];

/** 세부 위치를 나타내는 꼬리. 이 앞까지만 남긴다. */
const TAIL = /\s(?:§|별표|제\d|주\s?\d|주석|표\s?\d|부록|질의응답|해설|\d부|의사결정도|주요 검토|단서)|\s?\[|,\s|\s\(/;

/** 내부 참고용이라 화면에 낼 필요가 없는 표기 */
const DROP = /^(?:기술문서\s|제\d+조|질의응답\s)/;

function one(part: string): string[] {
  const p = part.trim();
  if (!p || DROP.test(p)) return [];
  if (/^고시(?!\s?요구)/.test(p)) return ["식약처 독성시험기준"];
  const ich = p.match(/^ICH\s+([A-Z]\d+[A-Z]?)(?:\(R\d\))?(?:[·/]\s?([A-Z]\d+[A-Z]?))?/);
  if (ich) return ich[2] ? [`ICH ${ich[1]}`, `ICH ${ich[2]}`] : [`ICH ${ich[1]}`];
  const oecd = p.match(/^OECD\s+(TG|GL)\s+([0-9A-Z]+(?:,\s?[0-9A-Z]+)*)/);
  if (oecd) return [`OECD ${oecd[1]} ${oecd[2]}`];
  for (const [long, short] of DOCS) if (p.startsWith(long)) return [short];
  const m = p.search(TAIL);
  return [m > 0 ? p.slice(0, m) : p];
}

/** 근거 문자열(여러 개는 " · "로 이어진 것)을 짧게. 같은 문서는 한 번만, 최대 2개. */
export function shortCite(basis: string | string[] | undefined | null, max = 2): string {
  if (!basis) return "";
  const parts = (Array.isArray(basis) ? basis.join(" · ") : basis).split(/\s·\s/);
  const out: string[] = [];
  for (const p of parts) for (const s of one(p)) if (s && !out.includes(s)) out.push(s);
  return out.slice(0, max).join(" · ");
}
