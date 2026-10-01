/**
 * 비임상 가이드라인 스킬의 참고 문서를 코드에서 생성한다.
 *
 *   node --experimental-strip-types --import ./scripts/ts-register.mjs scripts/build-guideline-skill.mjs
 *
 * 원천은 lib/design-guide.ts, lib/advisor.ts, lib/presets.ts, lib/efficacy.ts, lib/faq.ts 다.
 * 코드가 바뀌면 이 스크립트를 다시 돌려 .claude/skills/nonclinical-guideline/references/ 를 갱신한다.
 * advisor.ts 의 규칙은 조건부로만 나오므로, 질문 선택지를 무작위로 조합해 advise() 를 여러 번 돌리고
 * 나온 제안·안내·확인사항을 규칙 번호와 근거별로 모은다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { CLIN_DURATIONS, DESIGN_CARDS, DISCLAIMER, GLOSSARY, M3_TABLE1, M3_TABLE2, PACKAGE_WHY, repeatDoseFor } from "../lib/design-guide.ts";
import { ADVISOR_DISCLAIMER, PRODUCTS, QUESTIONS, advise, visibleQuestions } from "../lib/advisor.ts";
import { PRESETS } from "../lib/presets.ts";
import { AREAS, COST_PARTS } from "../lib/efficacy.ts";
import { FAQ } from "../lib/faq.ts";

const OUT = new URL("../.claude/skills/nonclinical-guideline/references/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const stamp = `> 생성: scripts/build-guideline-skill.mjs · ${new Date().toISOString().slice(0, 10)} · 원천 코드가 바뀌면 다시 생성한다. 손으로 고치지 않는다.\n\n`;
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
const write = (name, body) => {
  writeFileSync(new URL(name, OUT), stamp + body.trim() + "\n");
  console.log("wrote", name, body.length);
};

/* ── 1. 반복투여독성 기간 ───────────────────────────────── */
{
  const rows = [];
  for (const stage of ["임상시험 진입", "품목허가 신청"]) {
    for (const c of CLIN_DURATIONS) {
      const r = repeatDoseFor(c, stage);
      rows.push([stage, c, r.rodent, r.nonRodent, r.items.join(", "), r.note ?? ""]);
    }
  }
  write(
    "01-반복투여독성-기간.md",
    `# 반복투여독성 기간 (ICH M3(R2) 표 1·표 2)

임상에서 투여할 기간이 비임상 반복투여독성 기간을 정한다. 아래 두 표는 ICH M3(R2)를 그대로 옮긴 것이다.

## 표 1. 임상시험을 뒷받침하는 최소 기간

${table(["임상 투여기간", "설치류", "비설치류"], M3_TABLE1)}

## 표 2. 품목허가 신청 시 권장 기간

${table(["임상 투여기간", "설치류", "비설치류"], M3_TABLE2)}

## 단추 요청서 선택지 기준 대응표

요청서의 "임상 예정 투여기간" 선택지마다 단추가 제안하는 시험 항목이다.

${table(["단계", "임상 투여기간", "설치류", "비설치류", "제안 항목", "비고"], rows)}

## 바이오의약품 (ICH S6(R1))

기간은 위 표 1·표 2를 그대로 따르되 다음이 다르다.

| 항목 | 바이오의약품 | 근거 |
|---|---|---|
| 동물종 | 약리 활성이 나타나는 관련 종에서만. 단기(1개월 이하)는 관련 종 2종, 두 종 소견이 비슷하면 장기 시험은 1종으로 축소 가능 | ICH S6(R1) 1부 §3.3, 2부 §2.1·§2.2 |
| 만성 투여 | 설치류·비설치류 모두 6개월로 충분. 9개월 시험은 요구하지 않음 | ICH S6(R1) 2부 §3.2 |
| 함께 넣는 것 | TK와 항약물항체(ADA) 시료, 회복 평가(최소 1개 시험 1개 용량) | ICH S6(R1) 1부 §4.4, 2부 §3.1·4장 |
| 안전성약리 | 독립 시험 대신 반복투여독성에 통합 가능 | ICH S6(R1) 1부 §4.1 |
| 유전독성 | 표준 배터리 통상 불필요. 링커·저분자 부분이 있는 ADC는 예외 | ICH S6(R1) 1부 §4.2 |

## 주의

- 임상 투여기간이 미정이면 1상에 흔한 4주를 제안한다. 1상이 2주 이내면 2주로 진입할 수 있지만 임상이 길어지면 시험을 다시 해야 한다 (ICH M3(R2) 표 1).
- 진행암(ICH S9)은 기간을 임상 투여기간이 아니라 임상 일정과 단계로 정한다. 1상은 투여 일정에 맞춘 4주, 3상 전에는 3개월 시험이다.
- 비설치류 9개월은 지역별 예외(6개월 인정 조건)가 있어 제출처와 확인이 필요하다.

${DISCLAIMER}`,
  );
}

/* ── 2. 항목별 표준 설계 카드 ───────────────────────────── */
{
  const parts = DESIGN_CARDS.map((c) =>
    `## ${c.title}

적용 항목: ${c.items.join(", ")}

${c.purpose}

${table(["설계 요소", "통상 값"], c.rows)}

근거: ${c.basis.join(" · ")}

표준 설계로 요청 시 채우는 값: ${Object.entries(c.fill).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ")}`,
  );
  write(
    "02-항목별-표준설계.md",
    `# 항목별 표준 설계 (의약품 · 일반독성)

동물 수·회복군·TK 같은 "통상 어떻게 하는지"를 묻는 질문에 답할 때 쓴다. 숫자는 식약처 「의약품등의 독성시험기준」과 ICH 기준의 최소값이며, 회복군 지정 방식·마릿수처럼 기관마다 다른 부분은 그렇게 적혀 있다. 그 부분은 값을 정해 주지 말고 "기관마다 다르다"고 답한다.

${parts.join("\n\n")}

## 용어

${table(["용어", "뜻"], GLOSSARY)}

${DISCLAIMER}`,
  );
}

/* ── 3. 패키지 근거 + 프리셋 ───────────────────────────── */
{
  const why = PACKAGE_WHY.map((w) => {
    const p = PRESETS.find((x) => x.key === w.presetKey);
    return `## ${p ? p.name : w.presetKey}

${w.headline}

근거: ${w.basis.join(" · ")}

${w.blocks.map((b) => `- **${b.t}**: ${b.why}`).join("\n")}

나중에 필요한 것: ${w.later.join(" · ")}`;
  });
  const presets = PRESETS.map(
    (p) => `## ${p.name} (${p.key})

대상: ${p.audience} · ${p.desc}

${table(["대분류", "세부 항목", "동물종(기관 기본)", "경로", "시험법", "비고"], p.items.map((i) => [i.category, i.item, (i.species ?? []).join("/"), i.route ?? "", i.method ?? "", i.note ?? ""]))}`,
  );
  write(
    "03-패키지-근거와-프리셋.md",
    `# 패키지 근거와 프리셋

"임상 1상 전에 무엇이 필요한가" 같은 묶음 질문에 답할 때 쓴다. 1부는 왜 그 시험들이 묶이는지, 2부는 단추 요청서의 패키지 프리셋 구성이다.

# 1부. 패키지의 근거

${why.join("\n\n")}

# 2부. 프리셋 구성 (lib/presets.ts)

${presets.join("\n\n")}`,
  );
}

/* ── 4. 제안 규칙 (advise 를 무작위 조합으로 돌려 수집) ─────────── */
{
  let seed = 20260929;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const sample = (q) => {
    if (!q.multi) return pick(q.options);
    if (q.id === "prior") {
      const n = Math.floor(rnd() * 4);
      return n === 0 ? ["없음"] : Array.from({ length: n }, () => pick(q.options.filter((o) => o !== "없음")));
    }
    const n = 1 + Math.floor(rnd() * Math.min(3, q.options.length));
    return [...new Set(Array.from({ length: n }, () => pick(q.options)))];
  };
  const answersFor = (product) => {
    const a = { product };
    for (let i = 0; i < 6; i++) for (const q of visibleQuestions(a)) if (a[q.id] === undefined) a[q.id] = sample(q);
    return a;
  };

  const sections = [];
  for (const product of PRODUCTS) {
    const tests = new Map(), notes = new Map(), later = new Map(), ask = new Set(), pre = new Set();
    let msg = "";
    for (let i = 0; i < 2500; i++) {
      const adv = advise(answersFor(product));
      if (!adv.supported) { msg = adv.message ?? ""; continue; }
      for (const t of adv.tests) tests.set(`${t.rule}|${t.item}|${t.reason}`, t);
      for (const n of adv.notes) notes.set(`${n.rule}|${n.text}`, n);
      for (const l of adv.later) later.set(`${l.label}|${l.when}`, l);
      for (const x of adv.askCro) ask.add(x);
      for (const x of adv.prereq) pre.add(x);
    }
    const byRule = (a, b) => (a.rule || "~").localeCompare(b.rule || "~", "ko") || a.label?.localeCompare(b.label ?? "", "ko") || 0;
    const T = [...tests.values()].sort(byRule);
    const N = [...notes.values()].sort(byRule);
    sections.push(`# ${product}

${msg ? `> ${msg}\n` : ""}
## 제안되는 시험 (${T.length})

조건에 따라 제안되는 시험 항목과 그 이유, 근거 조항. 규칙 번호(R-…)는 저장소 밖 기술문서의 규칙 번호와 같다.

${table(["규칙", "대분류", "세부 항목", "제안 문구", "이유", "근거"], T.map((t) => [t.rule, t.category, t.item, t.label, t.reason, t.basis]))}

## 안내 문구 (${N.length})

제안과 함께 보여 주는 설명. 질문에 답할 때 이 문구와 근거를 그대로 인용할 수 있다.

${table(["규칙", "분야", "안내", "근거"], N.map((n) => [n.rule, n.topic ?? "", n.text, n.basis]))}

## 나중 단계 (${later.size})

${table(["시험", "언제", "근거"], [...later.values()].map((l) => [l.label, l.when, l.basis]))}

## 기관에 확인할 것 (가이드라인이 정하지 않는 부분, ${ask.size})

${[...ask].map((x) => `- ${x}`).join("\n") || "- (없음)"}

## 독성시험 착수 전에 끝나야 하는 것 (${pre.size})

${[...pre].map((x) => `- ${x}`).join("\n") || "- (없음)"}`);
  }
  write(
    "04-제안규칙-전체.md",
    `# 제안 규칙 전체 (lib/advisor.ts)

제품 유형별로 "이 상황이면 이 시험이 필요하다"는 규칙과 근거 조항을 모은 것이다. advise() 를 질문 선택지의 무작위 조합 2,500회씩 돌려 나온 결과의 합집합이므로 코드에 있는 규칙은 사실상 전부 들어 있다.

목차: ${PRODUCTS.map((p) => `[${p}](#${p.replace(/[·]/g, "")})`).join(" · ")}

${ADVISOR_DISCLAIMER}

${sections.join("\n\n")}`,
  );
}

/* ── 5. 질문 흐름 ───────────────────────────────────────── */
{
  write(
    "05-질문흐름.md",
    `# 제안 받기 질문 흐름 (lib/advisor.ts QUESTIONS)

의뢰자에게 무엇을 묻고 왜 묻는지. 어떤 정보가 있어야 시험 구성을 정할 수 있는지 설명할 때 쓴다.

${table(["단계", "id", "질문", "보조 설명", "선택지", "복수"], QUESTIONS.map((q) => [q.step, q.id, q.q, q.sub ?? "", q.options.join(" / "), q.multi ? "예" : ""]))}

조건부 질문(when)은 앞 답에 따라 숨는다. 예: 바이오의약품이면 bioType·bioSpecies, 건강기능식품이면 hf*, 화장품이면 cos*, 의료기기면 md*, 화학물질·농약이면 ch* 만 묻는다.`,
  );
}

/* ── 6. 효력시험 · FAQ ─────────────────────────────────── */
{
  write(
    "06-효력시험-FAQ.md",
    `# 효력시험 영역과 서비스 FAQ

## 효력시험(약효) 질환 영역과 공개 자료에서 확인된 모델 예

단추가 정하는 것은 영역 분류와 비용 구분 틀까지다. 모델과 설계는 기관이 등록하고 제안한다. 아래 모델은 국내 기관 공개 자료에서 확인된 예시이며 단추가 권하는 모델이 아니다.

${table(["질환 영역", "모델 예"], AREAS.map(([a, m]) => [a, m.join(", ")]))}

비용 구분: ${COST_PARTS.map(([, n, d]) => `${n}(${d})`).join(" · ")}

## 서비스 FAQ (lib/faq.ts)

${FAQ.map((f) => `### ${f.q}\n\n${f.a.join("\n\n")}`).join("\n\n")}`,
  );
}
