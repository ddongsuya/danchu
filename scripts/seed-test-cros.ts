/**
 * 로컬 시험 서버 전용: 가짜 CRO 기관 20곳과 기관마다 시험 목록(cro_catalog)·효력 단가표(cro_price_items)를 채운다.
 *
 * - 단가·기간·설계 값은 모두 지어낸 가상 값이다. 실제 기관 단가나 사내 자료에서 가져온 값이 아니다.
 *   기관마다 배율·기간 차이를 둬서 비교표에서 서로 다르게 보이게 한다.
 * - 기관 이름은 "테스트 ○○ 랩", 계정은 test-cro01@test.local ~ test-cro20@test.local (비밀번호 Test1234!x).
 * - 운영 DB 보호: SUPABASE_URL 이 localhost/127.0.0.1 이 아니면 아무것도 하지 않고 멈춘다.
 *
 * 실행 (로컬 Supabase 를 띄우고 .env.local 에 로컬 URL·service 키가 있을 때):
 *   npx tsx scripts/seed-test-cros.ts            # 넣기 (이미 있으면 지우고 다시 넣는다)
 *   npx tsx scripts/seed-test-cros.ts --remove   # 지우기만
 *   npx tsx scripts/seed-test-cros.ts --list     # 계정 목록만 출력
 * 자세한 내용: docs/test-cros.md
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { catalogItems, type CondPrice } from "../lib/catalog";
import { modelsOf, EFFICACY_CAT } from "../lib/efficacy";
import { pdFrom, pdLanes, COST_KEYS, type Money5, type KindDesign } from "../lib/kind-design";
import type { PriceCat, PriceUnit } from "../lib/price-book";
import { PREREG_EXEMPT_BEFORE } from "../lib/prereg";

/* ── 환경 ─────────────────────────────────────────── */

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
let host = "";
try { host = new URL(URL_).hostname; } catch { /* 아래에서 멈춘다 */ }
if (!["localhost", "127.0.0.1"].includes(host)) {
  console.error(`멈춤: 로컬 시험 서버 전용이에요. 지금 SUPABASE_URL = ${URL_ || "(없음)"}`);
  process.exit(1);
}
if (!KEY) { console.error("멈춤: SUPABASE_SERVICE_ROLE_KEY 가 없어요 (.env.local)."); process.exit(1); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export const PASSWORD = "Test1234!x";
const OPEN_ACCOUNT_AT = new Date(new Date(PREREG_EXEMPT_BEFORE).getTime() - 864e5).toISOString();
const EMAIL_RE = /^test-cro\d{2}@test\.local$/;
const emailOf = (n: number) => `test-cro${String(n).padStart(2, "0")}@test.local`;

/* ── 결정적 난수 (매번 같은 값이 나오게) ─────────── */

function rng(seed: number) {
  // mulberry32: 가까운 seed 에서도 첫 값이 고르게 흩어진다
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 기관 20곳 ─────────────────────────────────────── */

type Profile = "tox" | "pd" | "pk" | "invitro" | "device" | "small";
const CAT_BY_PROFILE: Record<Profile, string[]> = {
  tox: ["일반독성", "발암성·종양원성", "유전독성", "생식발생독성", "항원성·면역독성", "국소내성", "안전성약리", "조제물분석", "PK/TK/ADME·생체시료분석", "기타(임상병리·조직병리 등)"],
  pd: [EFFICACY_CAT, "일반독성", "기타(임상병리·조직병리 등)"],
  pk: ["PK/TK/ADME·생체시료분석", "조제물분석", "기타(임상병리·조직병리 등)"],
  invitro: ["유전독성", "동물대체시험", "국소독성", "항원성·면역독성"],
  device: ["의료기기 생물학적 안전성", "환경유해성", "국소독성", "유전독성"],
  small: ["일반독성", EFFICACY_CAT, "PK/TK/ADME·생체시료분석", "조제물분석"],
};
const PROFILE_LABEL: Record<Profile, string> = { tox: "종합 독성", pd: "효력 전문", pk: "약동학·생체시료분석", invitro: "체외·대체시험", device: "의료기기·환경", small: "소규모 종합" };

const NAMES = ["은행나무", "느티나무", "소나무", "자작나무", "단풍나무", "버드나무", "동백", "목련", "해바라기", "민들레", "라일락", "수국", "진달래", "개나리", "코스모스", "백합", "튤립", "국화", "매화", "도라지"];
const PROFILES: Profile[] = ["tox", "tox", "tox", "tox", "pd", "pd", "pd", "pd", "pd", "pk", "pk", "pk", "pk", "invitro", "invitro", "invitro", "device", "device", "small", "small"];
const PLANS = ["free", "plus", "pro"] as const;

export type FakeOrg = { n: number; name: string; email: string; profile: Profile; mult: number; weekShift: number; coverage: number; plan: string };
export const ORGS: FakeOrg[] = NAMES.map((nm, i) => {
  const r = rng(1000 + i);
  return {
    n: i + 1,
    name: `테스트 ${nm} 랩`,
    email: emailOf(i + 1),
    profile: PROFILES[i],
    mult: Math.round((0.78 + r() * 0.54) * 100) / 100, // 0.78 ~ 1.32
    weekShift: Math.floor(r() * 6) - 2, // -2 ~ +3 주
    coverage: 0.55 + r() * 0.4,
    plan: PLANS[i % 3],
  };
});

/* ── 가상 기준값 (지어낸 값. 기관 배율로 바뀐다) ─── */

type Base = { price: number; weeks: number; perSex?: number; recovery?: boolean; species?: string[]; nonrodent?: boolean; unit?: "total" | "per_sample"; dosingDays?: number };
const IVT = ["in vitro(동물 없음)"];
function base(cat: string, item: string): Base {
  const M = 1_000_000;
  if (cat === "일반독성") {
    const t: Record<string, Base> = {
      "단회(급성)투여독성": { price: 9 * M, weeks: 8, perSex: 5, nonrodent: true, dosingDays: 1 },
      급성경피독성: { price: 10 * M, weeks: 8, perSex: 5, dosingDays: 1 },
      "용량결정(DRF) 1주": { price: 14 * M, weeks: 8, perSex: 3, nonrodent: true, dosingDays: 7 },
      "용량결정(DRF) 2주": { price: 20 * M, weeks: 10, perSex: 3, nonrodent: true, dosingDays: 14 },
      "용량결정(DRF) 4주": { price: 32 * M, weeks: 13, perSex: 5, nonrodent: true, dosingDays: 28 },
      "반복투여 1주": { price: 18 * M, weeks: 10, perSex: 5, dosingDays: 7 },
      "반복투여 2주": { price: 26 * M, weeks: 12, perSex: 5, nonrodent: true, dosingDays: 14 },
      "반복투여 4주": { price: 45 * M, weeks: 16, perSex: 10, recovery: true, nonrodent: true, dosingDays: 28 },
      "반복투여 13주": { price: 95 * M, weeks: 28, perSex: 10, recovery: true, nonrodent: true, dosingDays: 91 },
      "반복투여 26주": { price: 170 * M, weeks: 42, perSex: 15, recovery: true, nonrodent: true, dosingDays: 182 },
      "반복투여 39주": { price: 230 * M, weeks: 56, perSex: 15, recovery: true, nonrodent: true, dosingDays: 273 },
      "반복투여 52주": { price: 290 * M, weeks: 70, perSex: 20, recovery: true, dosingDays: 364 },
      "단회 흡입독성": { price: 25 * M, weeks: 10, perSex: 5, dosingDays: 1 },
      "반복 흡입 2주": { price: 60 * M, weeks: 14, perSex: 5, dosingDays: 14 },
      "반복 흡입 28일": { price: 90 * M, weeks: 18, perSex: 10, recovery: true, dosingDays: 28 },
      "반복 흡입 90일": { price: 180 * M, weeks: 30, perSex: 10, recovery: true, dosingDays: 90 },
      "발육기동물 독성": { price: 120 * M, weeks: 30, perSex: 10, recovery: true, dosingDays: 56 },
    };
    return t[item] ?? { price: 20 * M, weeks: 12, perSex: 5 };
  }
  if (cat === "발암성·종양원성") {
    const t: Record<string, Base> = {
      "장기발암성(2년)": { price: 900 * M, weeks: 130, perSex: 50 },
      "단기발암성(rasH2 Tg)": { price: 450 * M, weeks: 40, perSex: 25, species: ["rasH2 Tg 마우스"] },
      "종양원성 26주": { price: 250 * M, weeks: 42, perSex: 15, species: ["누드마우스"] },
      "종양원성 52주": { price: 380 * M, weeks: 70, perSex: 15, species: ["누드마우스"] },
    };
    return t[item] ?? { price: 300 * M, weeks: 60 };
  }
  if (cat === "유전독성") {
    const t: Record<string, Base> = {
      "복귀돌연변이(Ames, TG 471)": { price: 7 * M, weeks: 6, species: IVT },
      "염색체이상 in vitro(TG 473)": { price: 12 * M, weeks: 8, species: IVT },
      "소핵 in vitro(TG 487)": { price: 11 * M, weeks: 8, species: IVT },
      "소핵 in vivo(마우스)": { price: 14 * M, weeks: 8, perSex: 5, species: ["ICR 마우스"] },
      "소핵 in vivo(랫드)": { price: 16 * M, weeks: 9, perSex: 5 },
      "MLA 마우스림프종(TG 490)": { price: 18 * M, weeks: 10, species: IVT },
      "Comet(TG 489)": { price: 22 * M, weeks: 10, perSex: 5 },
      "Pig-a": { price: 28 * M, weeks: 12, perSex: 5 },
    };
    return t[item] ?? { price: 12 * M, weeks: 8, species: IVT };
  }
  if (cat === "생식발생독성") {
    const t: Record<string, number[]> = {
      "수태능·초기배발생(Seg. I)": [110, 26], "배·태자발생 예비(DRF)": [40, 14], "배·태자발생 예비(pEFD)": [60, 16],
      "배·태자발생(Seg. II)": [130, 24], "출생전후발생(Seg. III)": [180, 36], "생식발생 스크리닝": [120, 26], "확장 1세대·2세대 생식독성": [600, 80],
    };
    const [p, w] = t[item] ?? [100, 24];
    return { price: p * M, weeks: w, perSex: 20 };
  }
  if (cat === "항원성·면역독성") {
    const gp = /GPMT|Buehler/.test(item);
    const t: Record<string, number[]> = {
      "ASA(능동전신아나필락시스)": [14, 10], "PCA(수동피부아나필락시스)": [12, 10], "피부감작성 GPMT": [11, 10], "피부감작성 Buehler": [10, 10],
      "피부감작성 LLNA": [9, 8], "세포매개성 면역독성": [35, 14], "체액성 면역독성(TDAR)": [40, 14], "면역표현형(Immunophenotyping)": [18, 10], "사이토카인 방출": [22, 10],
    };
    const [p, w] = t[item] ?? [15, 10];
    return { price: p * M, weeks: w, perSex: 5, species: gp ? ["기니피그"] : /LLNA/.test(item) ? ["BALB/c 마우스"] : undefined };
  }
  if (cat === "국소독성") return { price: (/광/.test(item) ? 12 : /누적/.test(item) ? 9 : 5) * M, weeks: /광|누적/.test(item) ? 9 : 6, perSex: 3, species: /광/.test(item) ? ["기니피그"] : ["NZW 토끼"] };
  if (cat === "국소내성") return { price: 15 * M, weeks: 10, perSex: 3, species: ["NZW 토끼"] };
  if (cat === "안전성약리") {
    const t: Record<string, Base> = {
      "중추신경계(Irwin test)": { price: 12 * M, weeks: 8, perSex: 5 },
      "중추신경계(FOB)": { price: 15 * M, weeks: 8, perSex: 5 },
      "호흡기계(Whole body plethysmography)": { price: 16 * M, weeks: 8, perSex: 6 },
      "심혈관계(Telemetry)": { price: 70 * M, weeks: 14, perSex: 4, species: ["비글"] },
      "hERG(in vitro)": { price: 9 * M, weeks: 6, species: IVT },
    };
    return t[item] ?? { price: (/의존성/.test(item) ? 55 : 15) * M, weeks: /의존성/.test(item) ? 20 : 10, perSex: 6 };
  }
  if (cat === "동물대체시험") return { price: (/LLNA|h-CLAT|KeratinoSens/.test(item) ? 13 : /흡수/.test(item) ? 15 : 7) * M, weeks: /흡수/.test(item) ? 9 : 6, species: IVT };
  if (cat === "조제물분석") {
    const t: Record<string, number> = { 함량: 250_000, 균질성: 300_000, 안정성: 350_000, 검량선: 800_000 };
    return { price: t[item] ?? 300_000, weeks: 4, unit: "per_sample", species: IVT };
  }
  if (cat === "PK/TK/ADME·생체시료분석") {
    const lot = /분석법 개발|분석법 검증|물질수지|대사체/.test(item);
    const t: Record<string, number> = {
      "PK(약물동태)": 90_000, "TK(독성동태)": 70_000, ADME: 120_000, "체외 대사 안정성·종간 비교": 1_800_000, 혈장단백결합: 1_500_000,
      "CYP 반응 표현형": 3_000_000, "CYP 억제": 2_500_000, "CYP 유도": 6_000_000, "수송체(기질·억제)": 8_000_000, 물질수지: 60 * M,
      조직분포: 150_000, 배설: 100_000, "대사체 프로파일링": 25 * M, "생체시료 분석법 개발": 15 * M, "분석법 검증(Partial)": 12 * M,
      "분석법 검증(Full)": 28 * M, "검체 분석": 60_000, "항약물항체(ADA) 분석": 110_000,
    };
    return { price: t[item] ?? 100_000, weeks: lot ? 12 : 6, unit: lot ? "total" : "per_sample", species: /PK|TK|ADME|조직분포|배설|물질수지/.test(item) ? ["SD 랫드"] : IVT };
  }
  if (cat === EFFICACY_CAT) {
    const t: Record<string, number[]> = {
      항암: [55, 14], "대사·내분비": [48, 18], 간: [42, 14], "신장·비뇨생식": [45, 14], "심혈관·혈전": [60, 16], 호흡기: [38, 10],
      소화기: [30, 10], 중추신경: [52, 14], "통증·염증": [28, 8], "관절·뼈·면역": [46, 16], "피부·모발": [32, 10], 안과: [50, 12], 감염: [26, 8], "기타·체외": [20, 8],
    };
    const [p, w] = t[item] ?? [35, 12];
    return { price: p * M, weeks: w, perSex: 8 };
  }
  if (cat === "환경유해성") {
    const fish = /어류/.test(item);
    return { price: (/번식|초기생활/.test(item) ? 22 : /분배|가수|흡착|생분해/.test(item) ? 6 : 9) * M, weeks: /번식|초기생활/.test(item) ? 14 : 7, species: fish ? ["제브라피시"] : ["기타"] };
  }
  if (cat === "의료기기 생물학적 안전성") {
    const t: Record<string, number[]> = {
      "세포독성(10993-5)": [4, 5], "감작성(10993-10)": [10, 10], "자극성·피내반응(10993-23)": [7, 7], "급성전신독성(10993-11)": [6, 6],
      "아급성·아만성독성(10993-11)": [45, 16], "만성독성(10993-11)": [150, 40], "유전독성(10993-3)": [25, 10], "발암성(10993-3)": [600, 120],
      "생식발생독성(10993-3)": [140, 28], "이식(10993-6)": [35, 16], "혈액적합성(10993-4)": [12, 8], "발열성(10993-11)": [5, 5],
      "화학적 특성 분석(10993-18)": [18, 8], "허용가능한계 설정(10993-17)": [8, 6],
    };
    const [p, w] = t[item] ?? [10, 8];
    return { price: p * M, weeks: w, species: /세포독성|화학적|허용|혈액/.test(item) ? IVT : /감작/.test(item) ? ["기니피그"] : /자극|발열|이식/.test(item) ? ["NZW 토끼"] : ["SD 랫드"] };
  }
  // 기타(임상병리·조직병리 등)
  return { price: (/다지점|피어리뷰|교차반응/.test(item) ? 25 : /보관/.test(item) ? 2 : 8) * M, weeks: /보관/.test(item) ? 52 : 6, species: IVT };
}

const round = (n: number, unit: "total" | "per_sample") => (unit === "per_sample" || n < 1_000_000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100_000) * 100_000);

/* ── 시험 목록 한 줄 ─────────────────────────────── */

const INCLUDES_TOX = ["임상병리", "조직병리(검경 포함)", "통계분석", "QA 점검", "조제물분석", "TK 분석", "영문 보고서"];
const AMES_STRAINS = ["TA98", "TA100", "TA1535", "TA1537", "WP2 uvrA"];

function catalogRow(org: FakeOrg, cat: string, item: string, sort: number, r: () => number) {
  const b = base(cat, item);
  const unit = b.unit ?? "total";
  const noise = 0.88 + r() * 0.24;
  const price = round(b.price * org.mult * noise, unit);
  const weeks = Math.max(2, b.weeks + org.weekShift + (r() < 0.3 ? 1 : 0));
  const inVivo = !(b.species ?? []).includes("in vitro(동물 없음)") && !!b.perSex;
  let species = b.species ?? (cat === EFFICACY_CAT ? [r() < 0.7 ? "C57BL/6 마우스" : "SD 랫드"] : [r() < 0.8 ? "SD 랫드" : "Wistar 랫드"]);
  const cond: CondPrice[] = [];
  let routes = inVivo ? ["경구(PO)"] : ["해당 없음"];
  if (cat === "국소독성" || /경피/.test(item)) routes = ["경피·피부"];
  if (/흡입/.test(item)) routes = ["흡입"];
  if (cat === "일반독성" && b.nonrodent && org.profile !== "pd" && r() < 0.75) {
    species = [...species, "비글"];
    cond.push({ species: "비글", price: round(price * (2.4 + r() * 0.5), "total") });
  }
  if (inVivo && routes[0] === "경구(PO)" && r() < 0.6) {
    routes = [...routes, "정맥(IV)"];
    cond.push({ route: "정맥(IV)", price: round(price * (1.08 + r() * 0.12), unit) });
  }
  const glp = org.profile === "pd" ? "Non-GLP" : cat === EFFICACY_CAT ? "Non-GLP" : r() < 0.7 ? "both" : "GLP";
  const includes = inVivo && cat !== EFFICACY_CAT ? INCLUDES_TOX.filter(() => r() < 0.6) : [];
  const options = inVivo && cat !== EFFICACY_CAT
    ? [{ name: "TK 분석", amount: round(price * 0.12, "total") }, ...(r() < 0.6 ? [{ name: "영문 보고서", amount: round(price * 0.08, "total") }] : [])]
    : r() < 0.4 ? [{ name: "영문 보고서", amount: round(Math.max(price, 3_000_000) * 0.1, "total") }] : [];
  const extra: Record<string, unknown> = {};
  if (/Ames/.test(item)) { extra.strains = AMES_STRAINS; extra.s9 = "±S9 모두"; }

  let kd: KindDesign | undefined;
  let method: string | null = null;
  let groups_test = inVivo ? 3 : null;
  if (cat === EFFICACY_CAT) {
    const models = modelsOf(item);
    method = models[Math.floor(r() * models.length)] ?? null;
    groups_test = 2 + Math.floor(r() * 2);
    const pd = pdFrom({ groups_ctrl: 1, groups_test, per_sex: b.perSex ?? 8, method, dosing: null, weeks, extra: { induction: "", positiveControl: r() < 0.6 ? "양성대조물질" : "", endpoints: "체중, 임상 점수, 혈액생화학, 조직병리" } });
    const split = [0.3, 0.25, 0.2, 0.15, 0.1];
    const costs = Object.fromEntries(COST_KEYS.map((k, i) => [k, round(price * split[i], "total")])) as Money5;
    const perGroup = Object.fromEntries(COST_KEYS.map((k, i) => [k, round((price / pd.groups.length) * split[i], "total")])) as Money5;
    kd = { pd: { ...pd, lanes: pdLanes(), costs, perGroup, perAnimal: round((150_000 + r() * 250_000) * org.mult, "per_sample") } };
  }
  const std = kd?.pd ? COST_KEYS.reduce((a, k) => a + (kd!.pd!.costs[k] ?? 0), 0) : price;
  return {
    org_id: "", item_key: `${cat}::${item}`, category: cat, item,
    available: true, glp, species, route: routes[0], routes, cond_prices: cond, method,
    groups_ctrl: inVivo ? 1 : null, groups_test, per_sex: inVivo ? b.perSex! : null,
    recovery_weeks: b.recovery ? (r() < 0.5 ? 2 : 4) : null, recovery_per_sex: b.recovery ? 5 : null,
    dosing: inVivo && b.dosingDays ? (b.dosingDays === 1 ? "1회" : `${b.dosingDays}일 · 1일 1회`) : null,
    weeks, includes, options, unit, std_price: std, price_min: std, price_max: null,
    extra: kd ? { ...extra, kd } : extra, note: "테스트용 가상 값", source: "manual", sort,
  };
}

/* ── 효력 단가표 ─────────────────────────────────── */

type PI = { category: PriceCat; name: string; attrs: Record<string, string>; unit: PriceUnit; price: number };
const PRICE_BOOK: PI[] = [
  { category: "animal", name: "C57BL/6 마우스", attrs: { species: "마우스", strain: "C57BL/6", sex: "수컷", weeks: "6" }, unit: "head", price: 32_000 },
  { category: "animal", name: "BALB/c nude 마우스", attrs: { species: "마우스", strain: "BALB/c nude", sex: "암컷", weeks: "5" }, unit: "head", price: 58_000 },
  { category: "animal", name: "db/db 마우스", attrs: { species: "마우스", strain: "db/db", sex: "수컷", weeks: "6" }, unit: "head", price: 140_000 },
  { category: "animal", name: "SD 랫드", attrs: { species: "랫드", strain: "SD", sex: "수컷", weeks: "7" }, unit: "head", price: 45_000 },
  { category: "housing", name: "마우스 사육", attrs: { species: "마우스", condition: "SPF" }, unit: "head_day", price: 1_200 },
  { category: "housing", name: "랫드 사육", attrs: { species: "랫드", condition: "SPF" }, unit: "head_day", price: 2_000 },
  { category: "model", name: "종양 세포 접종", attrs: { model: "이종이식(Xenograft)", method: "세포 접종", reagent: "별도" }, unit: "head", price: 60_000 },
  { category: "model", name: "DSS 대장염 유발", attrs: { model: "대장염(DSS)", method: "화학 유발", reagent: "포함" }, unit: "lot", price: 1_800_000 },
  { category: "model", name: "고지방식이 유발", attrs: { model: "고지방식이 비만(DIO)", method: "식이 유발", reagent: "포함" }, unit: "lot", price: 2_500_000 },
  { category: "dosing", name: "경구 투여", attrs: { route: "경구", size: "소동물" }, unit: "head_time", price: 3_000 },
  { category: "dosing", name: "복강 투여", attrs: { route: "복강", size: "소동물" }, unit: "head_time", price: 3_500 },
  { category: "dosing", name: "정맥 투여", attrs: { route: "정맥", size: "소동물" }, unit: "head_time", price: 8_000 },
  { category: "observe", name: "체중 측정", attrs: { item: "체중" }, unit: "head_time", price: 800 },
  { category: "observe", name: "종양 크기 측정", attrs: { item: "종양 크기", method: "캘리퍼" }, unit: "head_time", price: 2_500 },
  { category: "observe", name: "채혈", attrs: { item: "채혈" }, unit: "head_time", price: 6_000 },
  { category: "observe", name: "부검", attrs: { item: "부검" }, unit: "head", price: 25_000 },
  { category: "molecular", name: "ELISA", attrs: { method: "ELISA", matrix: "혈청" }, unit: "sample_item", price: 28_000 },
  { category: "molecular", name: "혈액생화학", attrs: { method: "혈액생화학", matrix: "혈청" }, unit: "sample_panel", price: 45_000 },
  { category: "molecular", name: "qPCR", attrs: { method: "qPCR", matrix: "조직" }, unit: "sample_item", price: 35_000 },
  { category: "pathology", name: "H&E 염색·판독", attrs: { stain: "H&E", organs: "3", reading: "포함" }, unit: "head", price: 90_000 },
  { category: "pathology", name: "면역조직화학", attrs: { stain: "IHC", reading: "포함" }, unit: "slide", price: 120_000 },
  { category: "imaging", name: "생체 영상 촬영", attrs: { item: "IVIS", minutes: "20" }, unit: "head_time", price: 40_000 },
  { category: "report", name: "통계·결과 보고서", attrs: { item: "결과 보고서", lang: "국문" }, unit: "lot", price: 3_000_000 },
  { category: "report", name: "영문 보고서", attrs: { item: "번역", lang: "영문" }, unit: "lot", price: 2_000_000 },
];

/* ── 지우기 ──────────────────────────────────────── */

async function listAuthUsers() {
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email && EMAIL_RE.test(u.email)) out.push({ id: u.id, email: u.email });
    if (data.users.length < 200) break;
  }
  return out;
}

async function removeAll() {
  const { data: orgs, error } = await sb.from("cro_orgs").select("id, name, contact_email").like("contact_email", "test-cro%@test.local");
  if (error) throw error;
  const mine = (orgs ?? []).filter((o) => EMAIL_RE.test(o.contact_email ?? "") && o.name.startsWith("테스트 "));
  for (const u of await listAuthUsers()) {
    const { error: e } = await sb.auth.admin.deleteUser(u.id);
    if (e) console.error("계정 삭제 실패", u.email, e.message);
  }
  if (mine.length) {
    const { error: e } = await sb.from("cro_orgs").delete().in("id", mine.map((o) => o.id));
    if (e) throw e;
  }
  console.log(`지움: 기관 ${mine.length}곳 (시험 목록·단가표는 함께 지워져요)`);
}

/** 비교 견적을 시험하기 쉽게, 그 분야를 하는 기관이면 늘 넣는 흔한 항목 */
const CORE = new Set(["단회(급성)투여독성", "용량결정(DRF) 2주", "반복투여 4주", "반복투여 13주", "복귀돌연변이(Ames, TG 471)", "염색체이상 in vitro(TG 473)", "소핵 in vivo(랫드)", "hERG(in vitro)", "TK(독성동태)", "PK(약물동태)", "분석법 검증(Full)", "함량", "균질성", "안정성", "항암", "대사·내분비", "세포독성(10993-5)", "감작성(10993-10)"]);

/* ── 넣기 ────────────────────────────────────────── */

async function seed() {
  await removeAll();
  const all = catalogItems();
  let rows = 0, prices = 0;
  for (const org of ORGS) {
    const r = rng(5000 + org.n);
    const cats = CAT_BY_PROFILE[org.profile];
    const { data: o, error: oe } = await sb.from("cro_orgs").insert({
      name: org.name, status: "approved", approved_at: new Date().toISOString(),
      website: null, address: "가상시 테스트구 시험로 " + org.n, contact_name: `테스트 담당자 ${String(org.n).padStart(2, "0")}`,
      contact_email: org.email, contact_phone: null,
      glp_certs: org.profile === "pd" ? [] : r() < 0.6 ? ["식약처(KGLP)", "OECD GLP"] : ["식약처(KGLP)"],
      aaalac: r() < 0.5, categories: cats, plan: org.plan,
      intro: `테스트용 가상 기관이에요 (${PROFILE_LABEL[org.profile]}). 실제 기관이 아니고 단가·기간도 지어낸 값이에요.`,
    }).select("id").single();
    if (oe || !o) throw oe ?? new Error("기관 생성 실패");

    const { data: u, error: ue } = await sb.auth.admin.createUser({ email: org.email, password: PASSWORD, email_confirm: true, user_metadata: { name: `테스트 담당자 ${String(org.n).padStart(2, "0")}`, company: org.name } });
    if (ue || !u.user) throw ue ?? new Error("계정 생성 실패");
    const { error: pe } = await sb.from("profiles").update({ role: "cro", cro_org_id: o.id, pending_org_id: null, org_role: "owner",
      // 사전예약 대기 화면 대신 모든 기관 기능을 시험하려고, 사전예약 기준 시각(lib/prereg.ts PREREG_EXEMPT_BEFORE) 전 계정으로 둔다
      created_at: OPEN_ACCOUNT_AT, name: `테스트 담당자 ${String(org.n).padStart(2, "0")}`, company: org.name }).eq("id", u.user.id);
    if (pe) throw pe;

    // 시험 목록: 기관 분야 안에서 일부 항목을 고른다 (분야마다 최소 2개)
    const list: ReturnType<typeof catalogRow>[] = [];
    let sort = 0;
    for (const cat of cats) {
      const items = all.filter((i) => i.category === cat);
      const main = cat === cats[0] || org.profile === "tox";
      const keep = items.filter((it, idx) => idx < 2 || CORE.has(it.item) || r() < (main ? org.coverage : org.coverage * 0.45));
      for (const it of keep) list.push({ ...catalogRow(org, cat, it.item, sort++, r), org_id: o.id });
    }
    const { error: ce } = await sb.from("cro_catalog").insert(list as never);
    if (ce) throw ce;
    rows += list.length;

    if (cats.includes(EFFICACY_CAT)) {
      const book = PRICE_BOOK.filter((p, i) => i < 6 || r() < 0.85).map((p, i) => ({
        org_id: o.id, category: p.category, name: p.name, attrs: p.attrs, unit: p.unit,
        price: round(p.price * org.mult * (0.9 + r() * 0.2), "per_sample"), memo: "테스트용 가상 단가", sort: i,
      }));
      const { error: be } = await sb.from("cro_price_items").insert(book);
      if (be) throw be;
      const { error: se } = await sb.from("cro_price_settings").upsert({ org_id: o.id, margin_pct: 10 + Math.round(r() * 15) });
      if (se) throw se;
      prices += book.length;
    }
    console.log(`${org.email}  ${org.name}  ${PROFILE_LABEL[org.profile]}  시험 ${list.length}줄  배율 ${org.mult}`);
  }
  console.log(`\n완료: 기관 ${ORGS.length}곳, 시험 목록 ${rows}줄, 효력 단가표 ${prices}줄. 비밀번호 ${PASSWORD}`);
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--list") for (const o of ORGS) console.log(`${o.email}\t${o.name}\t${PROFILE_LABEL[o.profile]}\t${o.plan}`);
  else if (arg === "--remove") await removeAll();
  else await seed();
}
main().catch((e) => { console.error("실패:", e?.message ?? e); process.exit(1); });
