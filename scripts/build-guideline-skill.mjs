#!/usr/bin/env node
/**
 * nonclinical-guideline 스킬의 참고 문서(01~06)를 단추 코드에서 다시 만든다.
 *
 * 스킬은 단추 제안 규칙(lib/advisor.ts)과 같은 내용이어야 한다. 규칙을 고친 뒤 이 스크립트를 돌려
 * 나온 references/ 파일로 스킬을 갱신한다. 07번(세포·유전자치료제 보충)은 사내 문서라 만들지 않는다.
 *
 * 사용:
 *   node scripts/build-guideline-skill.mjs [출력 폴더]          기본 출력: .guideline-skill/references
 *   node scripts/build-guideline-skill.mjs --check <스킬 references 폴더>
 *        지금 코드로 만든 결과와 스킬에 들어 있는 파일을 비교해, 다른 파일과 줄 수를 알려 준다 (다르면 종료 코드 1).
 *
 * 외부 패키지 없이 devDependencies의 typescript로 lib/*.ts를 임시 폴더에 옮겨 실행한다.
 */
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAMP = "> 생성: scripts/build-guideline-skill.mjs · 원천 코드가 바뀌면 다시 생성한다. 손으로 고치지 않는다.";
const RUNS_PER_PRODUCT = 2500;

/* ── 1. lib/*.ts 를 실행 가능한 .mjs 로 옮긴다 ───────────────────────── */

async function loadLib() {
  const out = mkdtempSync(join(tmpdir(), "danchu-guideline-"));
  for (const f of readdirSync(join(ROOT, "lib")).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(join(ROOT, "lib", f), "utf8");
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText;
    js = js.replace(/(from\s+["'])(\.\/[\w.-]+)(["'])/g, "$1$2.mjs$3");
    writeFileSync(join(out, f.replace(/\.ts$/, ".mjs")), js);
  }
  const imp = (n) => import(pathToFileURL(join(out, `${n}.mjs`)).href);
  try {
    const [advisor, guide, presets, efficacy, faq] = await Promise.all(["advisor", "design-guide", "presets", "efficacy", "faq"].map(imp));
    return { advisor, guide, presets, efficacy, faq };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/* ── 2. 도우미 ─────────────────────────────────────────────── */

const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");
const list = (xs) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (없음)");
const doc = (...parts) => [STAMP, "", ...parts].join("\n\n").replace(/\n{3,}/g, "\n\n") + "\n";
const ko = (a, b) => a.localeCompare(b, "ko");

/** 같은 시드면 같은 결과 (mulberry32) */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 3. 파일별 생성 ─────────────────────────────────────────── */

function build01({ guide }) {
  const rows = [];
  for (const stage of ["임상시험 진입", "품목허가 신청"]) {
    for (const clin of guide.CLIN_DURATIONS) {
      const d = guide.repeatDoseFor(clin, stage);
      rows.push([stage, clin, d.rodent, d.nonRodent, d.items.join(", "), d.note ?? ""]);
    }
  }
  return doc(
    "# 반복투여독성 기간 (ICH M3(R2) 표 1·표 2)",
    "임상에서 투여할 기간이 비임상 반복투여독성 기간을 정한다. 아래 두 표는 ICH M3(R2)를 그대로 옮긴 것이다.",
    "## 표 1. 임상시험을 뒷받침하는 최소 기간",
    table(["임상 투여기간", "설치류", "비설치류"], guide.M3_TABLE1),
    "## 표 2. 품목허가 신청 시 권장 기간",
    table(["임상 투여기간", "설치류", "비설치류"], guide.M3_TABLE2),
    "## 단추 요청서 선택지 기준 대응표",
    "요청서의 \"임상 예정 투여기간\" 선택지마다 단추가 제안하는 시험 항목이다.",
    table(["단계", "임상 투여기간", "설치류", "비설치류", "제안 항목", "비고"], rows),
    "## 바이오의약품 (ICH S6(R1))",
    "기간은 위 표 1·표 2를 그대로 따르되 다음이 다르다.",
    table(["항목", "바이오의약품", "근거"], [
      ["동물종", "약리 활성이 나타나는 관련 종에서만. 단기(1개월 이하)는 관련 종 2종, 두 종 소견이 비슷하면 장기 시험은 1종으로 축소 가능", "ICH S6(R1) 1부 §3.3, 2부 §2.1·§2.2"],
      ["만성 투여", "설치류·비설치류 모두 6개월로 충분. 9개월 시험은 요구하지 않음", "ICH S6(R1) 2부 §3.2"],
      ["함께 넣는 것", "TK와 항약물항체(ADA) 시료, 회복 평가(최소 1개 시험 1개 용량)", "ICH S6(R1) 1부 §4.4, 2부 §3.1·4장"],
      ["안전성약리", "독립 시험 대신 반복투여독성에 통합 가능", "ICH S6(R1) 1부 §4.1"],
      ["유전독성", "표준 배터리 통상 불필요. 링커·저분자 부분이 있는 ADC는 예외", "ICH S6(R1) 1부 §4.2"],
    ]),
    "## 주의",
    list([
      "임상 투여기간이 미정이면 1상에 흔한 4주를 제안한다. 1상이 2주 이내면 2주로 진입할 수 있지만 임상이 길어지면 시험을 다시 해야 한다 (ICH M3(R2) 표 1).",
      "진행암(ICH S9)은 기간을 임상 투여기간이 아니라 임상 일정과 단계로 정한다. 1상은 투여 일정에 맞춘 4주, 3상 전에는 3개월 시험이다.",
      "비설치류 9개월은 지역별 예외(6개월 인정 조건)가 있어 제출처와 확인이 필요하다.",
    ]),
    guide.DISCLAIMER,
  );
}

function build02({ guide }) {
  const cards = guide.DESIGN_CARDS.map((c) => [
    `## ${c.title}`,
    `적용 항목: ${c.items.join(", ")}`,
    c.purpose,
    table(["설계 요소", "통상 값"], c.rows),
    `근거: ${c.basis.join(" · ")}`,
    `표준 설계로 요청 시 채우는 값: ${Object.entries(c.fill).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ")}`,
  ].join("\n\n"));
  return doc(
    "# 항목별 표준 설계 (의약품 · 일반독성)",
    "동물 수·회복군·TK 같은 \"통상 어떻게 하는지\"를 묻는 질문에 답할 때 쓴다. 숫자는 식약처 「의약품등의 독성시험기준」과 ICH 기준의 최소값이며, 회복군 지정 방식·마릿수처럼 기관마다 다른 부분은 그렇게 적혀 있다. 그 부분은 값을 정해 주지 말고 \"기관마다 다르다\"고 답한다.",
    ...cards,
    "## 용어",
    table(["용어", "뜻"], guide.GLOSSARY),
    guide.DISCLAIMER,
  );
}

function build03({ guide, presets }) {
  const name = (key) => presets.PRESETS.find((p) => p.key === key)?.name ?? key;
  const why = guide.PACKAGE_WHY.map((w) => [
    `## ${name(w.presetKey)}`,
    w.headline,
    `근거: ${w.basis.join(" · ")}`,
    w.blocks.map((b) => `- **${b.t}**: ${b.why}`).join("\n"),
    `나중에 필요한 것: ${w.later.join(" · ")}`,
  ].join("\n\n"));
  const sets = presets.PRESETS.map((p) => [
    `## ${p.name} (${p.key})`,
    `대상: ${p.audience} · ${p.desc}`,
    table(["대분류", "세부 항목", "동물종(기관 기본)", "경로", "시험법", "비고"], p.items.map((it) => [it.category, it.item, (it.species ?? []).join(", "), it.route ?? "", it.method ?? "", it.note ?? ""])),
  ].join("\n\n"));
  return doc(
    "# 패키지 근거와 프리셋",
    "\"임상 1상 전에 무엇이 필요한가\" 같은 묶음 질문에 답할 때 쓴다. 1부는 왜 그 시험들이 묶이는지, 2부는 단추 요청서의 패키지 프리셋 구성이다.",
    "# 1부. 패키지의 근거",
    ...why,
    "# 2부. 프리셋 구성 (lib/presets.ts)",
    ...sets,
  );
}

/** advise() 를 선택지 무작위 조합으로 돌려 나온 결과의 합집합 */
function sampleAdvice({ advisor }) {
  const byProduct = new Map();
  advisor.PRODUCTS.forEach((product, i) => {
    const rand = rng(20261001 + i);
    const acc = { tests: new Map(), notes: new Map(), later: new Map(), askCro: new Set(), prereq: new Set(), message: "" };
    for (let n = 0; n < RUNS_PER_PRODUCT; n++) {
      const a = { product };
      for (let pass = 0; pass < 3; pass++) {
        for (const q of advisor.visibleQuestions(a)) {
          if (q.id === "product" || (a[q.id] !== undefined && pass > 0)) continue;
          if (q.multi) {
            const picked = q.options.filter(() => rand() < 0.35);
            a[q.id] = picked.length ? picked : [q.options[Math.floor(rand() * q.options.length)]];
          } else a[q.id] = q.options[Math.floor(rand() * q.options.length)];
        }
      }
      const adv = advisor.advise(a);
      if (!adv.supported) { acc.message = adv.message ?? ""; continue; }
      for (const t of adv.tests) acc.tests.set([t.rule, t.category, t.item, t.label, t.reason, t.basis].join("\u0000"), t);
      for (const x of adv.notes) acc.notes.set([x.rule, x.text, x.basis].join("\u0000"), x);
      for (const l of adv.later) acc.later.set([l.label, l.when, l.basis].join("\u0000"), l);
      adv.askCro.forEach((s) => acc.askCro.add(s));
      adv.prereq.forEach((s) => acc.prereq.add(s));
    }
    byProduct.set(product, acc);
  });
  return byProduct;
}

function build04(lib, sampled) {
  const { advisor } = lib;
  const anchor = (p) => `[${p}](#${p.replace(/[·\s]/g, "")})`;
  const sections = advisor.PRODUCTS.map((p) => {
    const s = sampled.get(p);
    const tests = [...s.tests.values()].sort((x, y) => ko(x.rule, y.rule) || ko(x.category, y.category) || ko(x.item, y.item) || ko(x.label, y.label) || ko(x.reason, y.reason));
    const notes = [...s.notes.values()].sort((x, y) => ko(x.rule, y.rule) || ko(x.text, y.text));
    const later = [...s.later.values()].sort((x, y) => ko(x.label, y.label));
    return [
      `# ${p}`,
      s.message && !tests.length ? `> ${s.message}` : "",
      `## 제안되는 시험 (${tests.length})`,
      "조건에 따라 제안되는 시험 항목과 그 이유, 근거 조항. 규칙 번호(R-…)는 원문 기술문서의 규칙 번호와 같다.",
      table(["규칙", "대분류", "세부 항목", "제안 문구", "이유", "근거"], tests.map((t) => [t.rule, t.category, t.item, t.label, t.reason, t.basis])),
      `## 안내 문구 (${notes.length})`,
      "제안과 함께 보여 주는 설명. 질문에 답할 때 이 문구와 근거를 그대로 인용할 수 있다.",
      table(["규칙", "분야", "안내", "근거"], notes.map((x) => [x.rule, x.topic ?? "", x.text, x.basis])),
      `## 나중 단계 (${later.length})`,
      table(["시험", "언제", "근거"], later.map((l) => [l.label, l.when, l.basis])),
      `## 기관에 확인할 것 (가이드라인이 정하지 않는 부분, ${s.askCro.size})`,
      list([...s.askCro].sort(ko)),
      `## 독성시험 착수 전에 끝나야 하는 것 (${s.prereq.size})`,
      list([...s.prereq].sort(ko)),
    ].join("\n\n");
  });
  return doc(
    "# 제안 규칙 전체 (lib/advisor.ts)",
    `제품 유형별로 "이 상황이면 이 시험이 필요하다"는 규칙과 근거 조항을 모은 것이다. advise() 를 질문 선택지의 무작위 조합 ${RUNS_PER_PRODUCT.toLocaleString("en-US")}회씩 돌려 나온 결과의 합집합이므로 코드에 있는 규칙은 사실상 전부 들어 있다.`,
    `목차: ${advisor.PRODUCTS.map(anchor).join(" · ")}`,
    advisor.ADVISOR_DISCLAIMER,
    ...sections,
  );
}

function build05({ advisor }) {
  return doc(
    "# 제안 받기 질문 흐름 (lib/advisor.ts QUESTIONS)",
    "의뢰자에게 무엇을 묻고 왜 묻는지. 어떤 정보가 있어야 시험 구성을 정할 수 있는지 설명할 때 쓴다.",
    table(["단계", "id", "질문", "보조 설명", "선택지", "복수"], advisor.QUESTIONS.map((q) => [q.step, q.id, q.q, q.sub ?? "", q.options.join(" / "), q.multi ? "예" : ""])),
    "조건부 질문(when)은 앞 답에 따라 숨는다. 예: 바이오의약품이면 bioType·bioSpecies, 건강기능식품이면 hf*, 화장품이면 cos*, 의료기기면 md*, 화학물질·농약이면 ch* 만 묻는다.",
  );
}

function build06({ efficacy, faq }) {
  return doc(
    "# 효력시험 영역과 서비스 FAQ",
    "## 효력시험(약효) 질환 영역과 공개 자료에서 확인된 모델 예",
    "단추가 정하는 것은 영역 분류와 비용 구분 틀까지다. 모델과 설계는 기관이 등록하고 제안한다. 아래 모델은 국내 기관 공개 자료에서 확인된 예시이며 단추가 권하는 모델이 아니다.",
    table(["질환 영역", "모델 예"], efficacy.AREAS.map(([n, ms]) => [n, ms.join(", ")])),
    `비용 구분: ${efficacy.COST_PARTS.map(([, label, desc]) => `${label}(${desc})`).join(" · ")}`,
    "## 서비스 FAQ (lib/faq.ts)",
    ...faq.FAQ.map((f) => [`### ${f.q}`, ...f.a].join("\n\n")),
  );
}

/* ── 4. 실행 ─────────────────────────────────────────────── */

export async function buildAll() {
  const lib = await loadLib();
  const sampled = sampleAdvice(lib);
  return {
    files: {
      "01-반복투여독성-기간.md": build01(lib),
      "02-항목별-표준설계.md": build02(lib),
      "03-패키지-근거와-프리셋.md": build03(lib),
      "04-제안규칙-전체.md": build04(lib, sampled),
      "05-질문흐름.md": build05(lib),
      "06-효력시험-FAQ.md": build06(lib),
    },
    sampled,
  };
}

/** 줄 단위 차이 개수 (순서 무시: 생성 순서가 바뀐 것은 차이로 보지 않는다) */
function lineDiff(a, b) {
  const skip = (l) => l.startsWith("> 생성:");
  const count = (s) => s.split("\n").filter((l) => !skip(l)).reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
  const A = count(a), B = count(b);
  let added = 0, removed = 0;
  for (const [l, n] of B) added += Math.max(0, n - (A.get(l) ?? 0));
  for (const [l, n] of A) removed += Math.max(0, n - (B.get(l) ?? 0));
  return { added, removed };
}

async function main() {
  const args = process.argv.slice(2);
  const { files } = await buildAll();
  if (args[0] === "--check") {
    const dir = args[1];
    if (!dir || !existsSync(dir)) { console.error("사용: node scripts/build-guideline-skill.mjs --check <스킬 references 폴더>"); process.exit(2); }
    let stale = 0;
    for (const [name, body] of Object.entries(files)) {
      const p = join(dir, name);
      if (!existsSync(p)) { console.log(`없음  ${name}`); stale++; continue; }
      const { added, removed } = lineDiff(readFileSync(p, "utf8"), body);
      if (added || removed) { console.log(`다름  ${name}  (코드에만 ${added}줄, 스킬에만 ${removed}줄)`); stale++; }
      else console.log(`같음  ${name}`);
    }
    console.log(stale ? `\n스킬 참고 문서가 코드와 다릅니다. 이 스크립트로 다시 만들어 스킬을 갱신하세요. (07번은 그대로 둡니다)` : "\n스킬 참고 문서가 코드와 같습니다.");
    process.exit(stale ? 1 : 0);
  }
  const out = resolve(args[0] ?? join(ROOT, ".guideline-skill", "references"));
  mkdirSync(out, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(out, name), body);
  console.log(`${Object.keys(files).length}개 파일을 만들었습니다: ${out}\n07-세포유전자치료제-보충.md 는 사내 문서라 만들지 않습니다. 스킬 폴더를 통째로 바꿀 때 07번을 따로 보존하세요.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
