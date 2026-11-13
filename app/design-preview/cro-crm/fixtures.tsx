import type { NavItem } from "@/components/shell/Shell";
import { type CroPaths } from "@/components/cro/Pipeline";
import type { CrmPaths } from "@/components/cro/crm/opts";
import type { CrmCtx } from "@/components/cro/crm/ctx";
import type { Session } from "@/lib/auth";
import type { CrmData } from "@/lib/crm";
import { STAGES, danchuPatch, danchuSrcOf, danchuTarget, type DanchuSrc, type Stage } from "@/lib/crm-deals";
import { addDaysYmd, kstToIso, mondayOf, todayKst, type CrmActivity, type CrmCompany, type CrmContact, type CrmDeal, type CrmEvent, type CrmQuote, type CrmTask, type DealHistory } from "@/lib/crm-shape";

const B = "/design-preview/cro-crm";
export const PATHS: CroPaths = { pipe: `${B}/requests`, clients: `${B}/clients` };
export const CPATHS: CrmPaths = {
  today: B, deals: `${B}/deals`, clients: `${B}/clients`, reports: `${B}/reports`, import: `${B}/import`, calendar: `${B}/calendar`, log: `${B}/log`,
  docs: "/cro/docs", newDoc: "/cro/docs/new", ics: "/api/cro/crm/ics", exportXlsx: "/api/cro/crm/export",
};
export const NAV: NavItem[] = [
  { href: B, label: "오늘", icon: "today", exact: true },
  { href: CPATHS.deals, label: "안건", icon: "deals" },
  { href: CPATHS.clients, label: "고객사", icon: "clients" },
  { href: CPATHS.reports, label: "보고서", icon: "report" },
  { href: PATHS.pipe, label: "받은 요청", icon: "inbox", group: "견적" },
  { href: "/cro/docs", label: "견적서", icon: "quote", group: "견적" },
  { href: "/design-preview/catalog", label: "시험 목록", icon: "list", group: "견적" },
  { href: CPATHS.calendar, label: "캘린더", icon: "calendar", group: "견적" },
  { href: "/cro/notifications", label: "알림", icon: "bell", group: "견적" },
  { href: "/cro/org", label: "기관", icon: "org", group: "설정" },
  { href: "/cro/billing", label: "요금제·결제", icon: "receipt", group: "설정" },
];
export const TABS: NavItem[] = [
  { href: B, label: "오늘", icon: "today", exact: true },
  { href: CPATHS.deals, label: "안건", icon: "deals" },
  { href: CPATHS.log, label: "기록", icon: "note" },
  { href: "/cro/more", label: "더보기", icon: "more" },
];

const DAY = 864e5;
const at = (now: number, d: number) => new Date(now + d * DAY).toISOString();
const ymd = (now: number, d: number) => new Date(now + d * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ME = "crm-preview";
const OH = id(901);
const CHOI = id(902);
const MEMBERS = [{ id: ME, name: "김 책임" }, { id: OH, name: "오 연구원" }, { id: CHOI, name: "최 박사" }];

/**
 * 단추 쪽 예시: 한 기관이 받은 요청 7건. 참여 결정 전 2, 작성 중 1(회신 기한 내일), 제출 뒤 비교 대기 1, 선정 2(하나는 계약 보고 끝), 다른 기관 선정 1.
 * 회사·사람·금액은 실제 값이 아니다.
 */
export function sample(now = Date.now()) {
  const rfq = (n: number, o: Record<string, unknown> = {}) => ({
    rfq_no: `R-2611-01${n}`, substance: "", categories: ["일반독성"], org_type: "제약사", company: `예시 의뢰사 ${String.fromCharCode(64 + n)}`,
    status: "distributed", selected_quote_id: null, compared_at: null, join_by: ymd(now, 3), user_id: `u${n}`, contact_name: "담당자", email: `contact${n}@example.invalid`, phone: "", ...o,
  });
  const inv = (n: number, o: Record<string, unknown>) => ({
    id: id(800 + n), rfq_id: `r${n}`, rfq_no: `R-2611-01${n}`, status: "sent", sent_at: at(now, -4), reply_by: ymd(now, 12), expires_at: at(now, 30),
    joined_at: null, withdrawn_at: null, revoked_at: null, join_user_id: ME, quote: null, rfq: rfq(n), ...o,
  });
  const q = (qid: string, amount: number, o: Record<string, unknown> = {}) => ({ id: qid, status: "submitted", total_amount: amount, submitted_at: at(now, -6), first_submitted_at: at(now, -6), valid_until: ymd(now, 40), revision: 1, ...o });
  const invites = [
    inv(1, { rfq: rfq(1, { categories: ["일반독성", "유전독성"], join_by: ymd(now, 1) }) }),
    inv(2, { rfq: rfq(2, { categories: ["안전성약리"], join_by: ymd(now, 11) }), reply_by: ymd(now, 20) }),
    inv(3, { joined_at: at(now, -2), status: "draft", reply_by: ymd(now, 1), quote: q("q3", 42_000_000, { status: "draft", submitted_at: null, first_submitted_at: null }), rfq: rfq(3, { categories: ["반복투여독성"], substance: "펩타이드" }) }),
    inv(4, { joined_at: at(now, -12), status: "submitted", quote: q("q4", 86_000_000, { first_submitted_at: at(now, -8), submitted_at: at(now, -8) }), rfq: rfq(4, { categories: ["생식독성"], substance: "합성의약품", compared_at: at(now, -1) }) }),
    inv(5, {
      joined_at: at(now, -20), sent_at: at(now, -21), status: "submitted", quote: q("q5", 214_500_000, { first_submitted_at: at(now, -18), submitted_at: at(now, -18), valid_until: ymd(now, 26) }),
      rfq: rfq(5, { categories: ["반복투여독성"], substance: "합성의약품", status: "selected", selected_quote_id: "q5", company: "가람바이오", contact_name: "박 팀장", email: "park@garambio.example" }),
    }),
    inv(6, { joined_at: at(now, -200), sent_at: at(now, -201), status: "submitted", quote: q("q6", 64_000_000, { first_submitted_at: at(now, -196), submitted_at: at(now, -196) }), rfq: rfq(6, { categories: ["단회투여독성"], substance: "합성의약품", status: "contracting", selected_quote_id: "q6", company: "가람바이오", contact_name: "박 팀장", user_id: "u5", email: "park@garambio.example" }) }),
    inv(7, { joined_at: at(now, -26), status: "submitted", quote: q("q7", 55_000_000, { first_submitted_at: at(now, -22), submitted_at: at(now, -22) }), rfq: rfq(7, { categories: ["유전독성"], substance: "천연물", status: "selected", selected_quote_id: "other" }) }),
  ];
  const award = (n: number, i: (typeof invites)[number], amount: number, o: Record<string, unknown>) => ({
    id: `a${n}`, invite_id: i.id, rfq_id: i.rfq_id, awarded_at: at(now, -16), contract_reported_at: null, contract_status: "", contract_amount: null, substance_updated_at: null, quoteAmount: amount,
    rfq: i.rfq, ...o,
  });
  const awards = [
    award(5, invites[4], 214_500_000, {}),
    award(6, invites[5], 64_000_000, { awarded_at: at(now, -190), contract_reported_at: at(now, -180), contract_status: "signed", contract_amount: 61_500_000 }),
  ];
  return { invites, awards };
}

export const SESSION: Session = {
  userId: ME, email: "preview@example.invalid", org: null, pendingOrg: null,
  profile: { id: ME, email: "preview@example.invalid", role: "cro", name: "김 책임", company: null, dept: null, phone: null, org_type: null, cro_org_id: null },
};

export function previewEnabled() {
  return process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && process.env.DANCHU_DESIGN_PREVIEW === "1");
}

/** 검토 화면의 "이번 주": 주말이면 다음 주 월요일 (예시 일정이 비어 보이지 않게) */
export function previewMonday(now = Date.now()) {
  const t = todayKst(now);
  const wd = new Date(`${t}T12:00:00+09:00`).getUTCDay();
  return wd === 0 || wd === 6 ? mondayOf(addDaysYmd(t, 2)) : mondayOf(t);
}

/**
 * CRM 화면 설명용 예시 (0038). 날짜는 오늘 기준으로 움직인다.
 * 가람바이오: 단추에서 선정된 고객사 (협의 중 안건 + 지난해 수주 1, 실패 1). 나머지는 기관이 직접 받은 문의와 엑셀에서 가져온 안건.
 * 보고서가 비어 보이지 않게 지난 6개월 끝난 안건 30건을 규칙적으로 만든다.
 */
export function crmSample(now = Date.now()): { data: CrmData; danchu: Map<string, DanchuSrc> } {
  const t = todayKst(now);
  const d = (n: number) => addDaysYmd(t, n);
  const iso = (n: number, hm = "10:00") => kstToIso(d(n), hm);
  const co = (n: number, name: string, o: Partial<CrmCompany> = {}): CrmCompany => ({
    id: id(n), org_id: "org", name, aliases: [], industry: "바이오텍", biz_no: "", address: "", website: "", email_domain: "", memo: "", owner: ME, source: "manual", first_deal_on: null,
    created_by: ME, created_at: iso(-200), updated_at: iso(-3), ...o,
  });
  const companies = [
    co(1, "가람바이오", { source: "danchu", first_deal_on: d(-190), biz_no: "000-00-00000", aliases: ["Garam Bio", "㈜가람바이오"], email_domain: "garambio.example", address: "서울 본사 3층" }),
    co(2, "나래제약", { industry: "제약사", email_domain: "narae.example" }),
    co(3, "다온메디칼", { industry: "의료기기", source: "import" }),
    co(4, "라온코스메틱", { industry: "화장품" }),
    co(5, "마루테라퓨틱스", { owner: OH }),
    co(6, "소담제약", { industry: "제약사" }),
    co(7, "(주)나래제약", { industry: "제약사", created_at: iso(-10) }),
  ];
  const ct = (n: number, c: number, name: string, o: Partial<CrmContact> = {}): CrmContact => ({
    id: id(100 + n), org_id: "org", company_id: id(c), name, dept: "", title: "", role: null, email: `contact${n}@example.invalid`, phone: "", mobile: "", memo: "", source: "manual", danchu_key: null,
    created_by: ME, created_at: iso(-60), updated_at: iso(-3), ...o,
  });
  const contacts = [
    ct(1, 1, "박 팀장", { dept: "비임상개발팀", title: "팀장", role: "decision", email: "park@garambio.example", mobile: "010-0000-0000", source: "danchu", danchu_key: "u5" }),
    ct(2, 1, "윤 연구원", { dept: "독성 담당", title: "연구원", role: "user", email: "yoon@garambio.example" }),
    ct(3, 1, "서 이사", { dept: "구매", title: "이사", role: "contract", email: "seo@garambio.example", source: "mail" }),
    ct(4, 2, "이 수석", { title: "수석", role: "decision", email: "lee@narae.example", phone: "02-000-0001" }),
    ct(5, 3, "최 책임", { title: "책임", role: "decision" }),
    ct(6, 4, "정 대리", { title: "대리" }),
    ct(7, 5, "한 이사", { title: "이사", role: "decision" }),
    ct(8, 6, "문 팀장", { title: "팀장", role: "decision" }),
  ];

  // ─ 단추 안건: 동기화 규칙(danchuTarget·danchuPatch)을 그대로 돌려 만든다
  const { invites, awards } = sample(now);
  const awardBy = new Map(awards.map((a) => [a.invite_id, a]));
  const danchu = new Map(invites.map((i) => [i.id, danchuSrcOf(i as never, (awardBy.get(i.id) ?? null) as never)]));
  const deals: CrmDeal[] = [];
  const history: DealHistory[] = [];
  let hn = 0;
  const base = (n: number, o: Partial<CrmDeal>): CrmDeal => ({
    id: id(1000 + n), org_id: "org", company_id: null, contact_ids: [], title: "", kind: "tox", substance: "", submit_to: "", report_lang: "", amount: null, expected_on: null,
    stage: "inquiry", status: "open", stage_at: iso(-1), lost_reason: "", lost_note: "", won_amount: null, closed_at: null, owner: ME, source: "manual", invite_id: null, rfq_no: "",
    memo: "", import_id: null, created_by: ME, created_at: iso(-30), updated_at: iso(-1), ...o,
  });
  const danchuDeal = (n: number, inv: (typeof invites)[number], o: Partial<CrmDeal> = {}) => {
    const tg = danchuTarget(danchu.get(inv.id)!, now);
    if (!tg) return;
    const p = danchuPatch(null, tg);
    const deal = base(n, { invite_id: inv.id, rfq_no: inv.rfq_no, created_at: tg.steps[0].at, ...(p.patch as Partial<CrmDeal>), ...o });
    deals.push(deal);
    for (const h of p.history) history.push({ id: id(5000 + hn++), deal_id: deal.id, created_by: null, ...h });
  };
  danchuDeal(1, invites[2]);
  danchuDeal(2, invites[3], { title: "생식독성 · 합성의약품" });
  danchuDeal(3, invites[4], { title: "13주 반복투여독성 · 랫드", company_id: id(1), contact_ids: [id(101), id(102)], substance: "합성의약품", submit_to: "식약처", report_lang: "국문", expected_on: `${d(40).slice(0, 7)}-01` });
  danchuDeal(4, invites[5], { title: "단회투여독성 · 랫드", company_id: id(1), contact_ids: [id(101)] });
  danchuDeal(5, invites[6], { title: "유전독성 3종 · 천연물" });

  // ─ 직접 받은 문의 · 엑셀에서 가져온 안건
  const manual = (n: number, o: Partial<CrmDeal>, moves: [Stage, number][], end?: { status: "won" | "lost"; at: number; reason?: string }) => {
    const created = moves[0][1];
    const deal = base(n, { created_at: iso(created, "09:30"), stage: moves.at(-1)![0], stage_at: iso(moves.at(-1)![1], "09:30"), ...o });
    let prev: Stage | null = null;
    for (const [s, dd] of moves) {
      history.push({ id: id(5000 + hn++), deal_id: deal.id, from_stage: prev, to_stage: s, from_status: prev ? "open" : null, to_status: "open", reason: "", actor: o.source === "import" && !prev ? "import" : "member", created_by: deal.owner, at: iso(dd, "09:30") });
      prev = s;
    }
    if (end) {
      Object.assign(deal, { status: end.status, closed_at: iso(end.at, "17:00"), lost_reason: end.reason ?? "", won_amount: end.status === "won" ? deal.amount : null, stage: end.status === "won" ? "contract" : deal.stage });
      history.push({ id: id(5000 + hn++), deal_id: deal.id, from_stage: prev, to_stage: deal.stage, from_status: "open", to_status: end.status, reason: end.reason ?? "", actor: "member", created_by: deal.owner, at: iso(end.at, "17:00") });
    }
    deals.push(deal);
  };
  manual(11, { title: "단회·반복 독성 패키지", company_id: id(2), contact_ids: [id(104)], amount: 120_000_000, expected_on: `${d(30).slice(0, 7)}-01` }, [["inquiry", -20], ["quote", -11]]);
  manual(12, { title: "의료기기 생물학적 안전성 5종", kind: "other", company_id: id(3), contact_ids: [id(105)], amount: 48_000_000, source: "import" }, [["inquiry", -40], ["quote", -25], ["negotiation", -6]]);
  manual(13, { title: "피부 자극·감작", company_id: id(4), contact_ids: [id(106)], amount: 29_000_000 }, [["inquiry", -9]]);
  manual(14, { title: "유전독성 3종", company_id: id(5), contact_ids: [id(107)], amount: 33_000_000, owner: OH }, [["inquiry", -30], ["quote", -22], ["negotiation", -15]]);
  manual(15, { title: "안전성약리 핵심 3종", company_id: id(6), contact_ids: [id(108)], amount: 62_000_000 }, [["inquiry", -45], ["quote", -38], ["negotiation", -25], ["intake", -12], ["contract", -3]]);
  manual(16, { title: "효력 · 마우스 종양 모델", kind: "pd", company_id: id(5), contact_ids: [id(107)], amount: 87_000_000, owner: CHOI }, [["inquiry", -12], ["quote", -5]]);
  manual(17, { title: "급성독성 · 랫드", company_id: id(2), contact_ids: [id(104)], amount: 29_000_000 }, [["inquiry", -35], ["quote", -28], ["negotiation", -14]], { status: "won", at: -3 });
  manual(18, { title: "PK · 비글 단회", kind: "pk", company_id: id(5), contact_ids: [id(107)], amount: 41_000_000, owner: OH }, [["inquiry", -50], ["quote", -40]], { status: "lost", at: -6, reason: "일정" });
  manual(19, { title: "유전독성 3종", company_id: id(1), contact_ids: [id(102)], amount: 29_000_000, created_at: iso(-80) }, [["inquiry", -80], ["quote", -70]], { status: "lost", at: -60, reason: "가격" });
  // 지난 6개월 끝난 안건 (보고서용)
  const titles = ["단회투여독성 · 랫드", "4주 반복투여 · 비글", "유전독성 3종", "피부 감작 LLNA", "안전성약리 핵심 3종", "효력 · 당뇨 모델", "PK · 랫드 반복", "생식독성 배·태자"];
  const reasons = ["가격", "다른 기관 선정", "가격", "일정", "다른 기관 선정", "의뢰자 계획 변경", "가격", "응답 없음", "다른 기관 선정", "일정"];
  for (let k = 0; k < 30; k++) {
    const startD = -170 + k * 5;
    const reach = [1, 2, 4, 1, 3, 2, 4, 0, 2, 3][k % 10];
    const won = reach >= 3 && k % 7 !== 0;
    const moves: [Stage, number][] = STAGES.slice(0, (won ? 4 : reach) + 1).map((s, i) => [s, startD + [0, 3, 12, 26, 32][i]]);
    const endAt = moves.at(-1)![1] + (won ? 8 : 5);
    if (endAt >= -1) continue;
    manual(100 + k, {
      title: titles[k % titles.length], kind: k % 5 === 2 ? "pd" : k % 7 === 3 ? "pk" : "tox", company_id: id(2 + (k % 5)), amount: (25 + ((k * 37) % 160)) * 1_000_000,
      source: k % 3 === 0 ? "danchu" : k % 3 === 1 ? "manual" : "import", owner: [ME, OH, CHOI][k % 3], rfq_no: k % 3 === 0 ? `R-26${String(5 + Math.floor(k / 6)).padStart(2, "0")}-00${k}` : "",
    }, moves, won ? { status: "won", at: endAt } : { status: "lost", at: endAt, reason: reasons[k % reasons.length] });
  }

  const ev = (n: number, deal: number | null, c: number | null, title: string, starts: string, ends: string | null, o: Partial<CrmEvent> = {}): CrmEvent => ({
    id: id(200 + n), org_id: "org", company_id: c ? id(c) : null, deal_id: deal ? id(1000 + deal) : null, contact_id: null, quote_doc_id: null, kind: "meeting", title, starts_at: starts, ends_at: ends, all_day: false, mode: "in_person", location: "",
    attendee_contacts: [], attendee_members: [ME], attendees_extra: "", requests: "", remind: true, reminded_at: null, done_at: null, created_by: ME, created_at: iso(-5), updated_at: iso(-5), ...o,
  });
  const events = [
    ev(1, 11, 2, "나래제약 이 수석 통화", iso(0, "10:00"), iso(0, "10:30"), { kind: "call", mode: "phone", contact_id: id(104), attendee_contacts: [id(104)], requests: "견적 유효기간 전 확인" }),
    ev(2, 15, 6, "소담제약 화상 미팅", iso(0, "14:00"), iso(0, "15:00"), { mode: "video", location: "https://meet.example.invalid/sodam", requests: "계약서 검토", attendee_contacts: [id(108)] }),
    ev(3, 3, 1, "박 팀장, 윤 연구원 미팅", iso(1, "14:00"), iso(1, "15:30"), { location: "가람바이오 본사", requests: "회복군 4주 제외안 일정표 가져가기", contact_id: id(101), attendee_contacts: [id(101), id(102)], attendee_members: [ME, CHOI] }),
    ev(4, 16, 5, "마루테라퓨틱스 종양 모델 설명", iso(3, "11:00"), iso(3, "12:00"), { mode: "video", attendee_contacts: [id(107)], attendee_members: [CHOI] }),
    ev(5, 12, 3, "다온메디칼 시설 방문", iso(2, "10:00"), iso(2, "12:00"), { attendee_contacts: [id(105)] }),
  ];
  const act = (n: number, deal: number | null, c: number | null, kind: string, when: string, title: string, body: string, o: Partial<CrmActivity> = {}): CrmActivity => ({
    id: id(400 + n), org_id: "org", company_id: c ? id(c) : null, deal_id: deal ? id(1000 + deal) : null, contact_id: null, quote_doc_id: null, event_id: null, kind, occurred_at: when, duration_min: null, title, body,
    attendee_contacts: [], attendee_members: [ME], created_by: ME, created_at: when, updated_at: when, ...o,
  });
  const activities = [
    act(1, 3, 1, "email", iso(0, "09:12"), "회복군 제외 시 일정 문의", "회복군 4주를 빼면 최종보고서(안)을 언제 받을 수 있는지 궁금합니다. 내일 미팅 때 일정표로 설명 부탁드립니다.", { contact_id: id(101) }),
    act(2, 3, 1, "call", iso(-3, "16:40"), "", "회복군을 빼면 일정을 2주 당길 수 있는지 문의. 시험책임자와 확인한 뒤 미팅에서 답하기로 함.", { contact_id: id(101), attendee_contacts: [id(101)], duration_min: 12 }),
    act(3, 3, 1, "meeting", iso(-10, "10:00"), "", "TK 채혈 시점을 1·13주로 조정. 회복군을 둘지 의뢰자 내부 검토 중.", { contact_id: id(101), attendee_contacts: [id(101), id(102)], attendee_members: [ME, CHOI], duration_min: 50 }),
    act(4, 11, 2, "call", iso(-4, "11:20"), "", "4주 반복 군만 먼저 진행할 수 있는지 문의. 유효기간 전에 다시 통화하기로.", { contact_id: id(104), attendee_contacts: [id(104)], duration_min: 9 }),
    act(5, 12, 3, "meeting", iso(-6, "14:00"), "", "시설 방문 희망. 견적은 5종 묶음으로 다시 받기로.", { contact_id: id(105), duration_min: 40 }),
    act(6, 14, 5, "memo", iso(-15, "18:00"), "", "예산 확정 전까지 대기. 담당 이사가 다음 분기에 다시 연락 준다고 함.", { created_by: OH, attendee_members: [OH] }),
    act(8, 17, 2, "call", iso(-5, "15:00"), "", "계약 조건 확인. 이번 주 안에 계약서 회신.", { contact_id: id(104), duration_min: 6 }),
  ];
  const tk = (n: number, deal: number | null, c: number | null, title: string, due: string | null, o: Partial<CrmTask> = {}): CrmTask => ({
    id: id(500 + n), org_id: "org", company_id: c ? id(c) : null, deal_id: deal ? id(1000 + deal) : null, contact_id: null, quote_doc_id: null, activity_id: null, title, memo: "", category: "contact", due_on: due, assignee: ME,
    done_at: null, done_by: null, created_by: ME, created_at: iso(-3), updated_at: iso(-3), actions: [], ...o,
  });
  const tasks = [
    tk(1, 12, 3, "다온 최 책임에게 방문 일정 확정 메일", d(0), { contact_id: id(105) }),
    tk(2, 3, 1, "미팅 자료 준비 · 회복군 제외안 일정표", d(1), { category: "material" }),
    tk(3, 16, 5, "종양 모델 군 구성안 보내기", d(-1), { assignee: CHOI, contact_id: id(107) }),
    tk(4, 3, 1, "TK 시점 변경안 공유", d(-9), { done_at: iso(-8, "11:00"), done_by: ME }),
  ];
  const qd = (n: number, deal: number | null, c: number | null, doc: string, title: string, supply: number, o: Partial<CrmQuote> = {}): CrmQuote => ({
    id: id(300 + n), doc_no: doc, title, client: c ? companies[c - 1].name : "", supply, status: "sent", sent_at: iso(-11, "10:05"), valid_until: d(22),
    deal_id: deal ? id(1000 + deal) : null, company_id: c ? id(c) : null, contact_id: null, rfq_no: null, updated_at: iso(-8), created_at: iso(-11), issued_on: d(-11), invite_id: null, ...o,
  });
  const quotes = [
    qd(1, 11, 2, "Q-2611-002", "단회·반복 독성 패키지", 120_000_000, { contact_id: id(104), valid_until: d(3) }),
    qd(2, 12, 3, "Q-2610-031", "생물학적 안전성 5종", 52_000_000, { contact_id: id(105), sent_at: iso(-25), created_at: iso(-25) }),
    qd(3, 12, 3, "Q-2611-007", "생물학적 안전성 5종 (묶음)", 48_000_000, { contact_id: id(105), sent_at: iso(-5), created_at: iso(-5) }),
    qd(4, 15, 6, "Q-2610-018", "안전성약리 핵심 3종", 62_000_000, { contact_id: id(108), sent_at: iso(-38), created_at: iso(-38) }),
    qd(5, 16, 5, "Q-2611-009", "효력 · 마우스 종양 모델", 87_000_000, { contact_id: id(107), sent_at: iso(-5), created_at: iso(-5) }),
  ];
  return {
    data: { ready: true, companies, contacts, deals, history, events, activities, tasks, quotes, members: MEMBERS },
    danchu,
  };
}

/** 검토 화면이 함께 쓰는 묶음 */
export function previewCtx(now = Date.now()): CrmCtx {
  const { data, danchu } = crmSample(now);
  return { data, danchu, me: ME, paths: CPATHS, now, preview: true };
}
